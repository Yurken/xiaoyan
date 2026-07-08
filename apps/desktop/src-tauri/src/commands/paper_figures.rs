use crate::commands::paper_artifacts::paper_figures_dir;
use crate::commands::paper_figure_images::{extract_pdf_images, is_likely_paper_figure_image};
use crate::commands::paper_figure_pages::{
    crop_page_region, extract_rendered_figure_crops, render_pdf_pages,
};
use crate::llm::LlmClient;
use crate::state::AppState;
use base64::{engine::general_purpose, Engine as _};
use serde_json::json;
use sqlx::Row;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use tauri::{Manager, State};

#[derive(Debug, Clone, Eq, PartialEq, Hash)]
pub(crate) enum FigureKind {
    Figure,
    Table,
}

impl FigureKind {
    pub(crate) fn as_str(&self) -> &'static str {
        match self {
            Self::Figure => "figure",
            Self::Table => "table",
        }
    }

    fn reference_label(&self, index: u32) -> String {
        match self {
            Self::Figure => format!("Figure {index}"),
            Self::Table => format!("Table {index}"),
        }
    }

    pub(crate) fn from_str(value: &str) -> Option<Self> {
        let normalized = value.trim().to_ascii_lowercase();
        if matches!(normalized.as_str(), "figure" | "fig" | "图") {
            Some(Self::Figure)
        } else if matches!(normalized.as_str(), "table" | "tab" | "表") {
            Some(Self::Table)
        } else {
            None
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct PaperFigureContext {
    pub kind: String,
    pub index: u32,
    pub caption: Option<String>,
}

impl PaperFigureContext {
    pub(crate) fn reference_label(&self) -> String {
        let kind = FigureKind::from_str(&self.kind).unwrap_or(FigureKind::Figure);
        kind.reference_label(self.index)
    }
}

pub(crate) type CaptionMap = HashMap<(FigureKind, u32), String>;

#[derive(Debug, Clone)]
pub(crate) struct NormalizedBBox {
    pub(crate) x: f32,
    pub(crate) y: f32,
    pub(crate) width: f32,
    pub(crate) height: f32,
}

#[derive(Debug, Clone)]
struct VisionFigureCandidate {
    kind: FigureKind,
    index: u32,
    bbox: NormalizedBBox,
    caption: Option<String>,
}

pub(crate) async fn ensure_figures_extracted(
    app: &tauri::AppHandle,
    db: &sqlx::SqlitePool,
    paper_id: &str,
    file_path: Option<&str>,
    full_text: &str,
    vision_client: Option<&LlmClient>,
    vision_model: Option<&str>,
) -> Vec<PaperFigureContext> {
    if let Some(existing) = load_current_figure_contexts(db, paper_id).await {
        return existing;
    }

    let fp = match file_path.filter(|f| !f.trim().is_empty()) {
        Some(f) => f,
        None => return Vec::new(),
    };
    let pdf_path = match canonical_managed_pdf_path(app, Path::new(fp)) {
        Ok(path) => path,
        Err(error) => {
            eprintln!("[paper-figures][{paper_id}] skip unsafe pdf path: {error}");
            return Vec::new();
        }
    };

    let figures_dir = match paper_figures_dir(app, paper_id) {
        Ok(dir) => dir,
        Err(error) => {
            eprintln!("[paper-figures][{paper_id}] create figure dir failed: {error}");
            return Vec::new();
        }
    };

    let captions = extract_figure_captions(full_text);
    let now = chrono::Utc::now().to_rfc3339();
    let mut extracted: HashSet<(FigureKind, u32)> = HashSet::new();

    if let Some(client) = vision_client {
        let pages_dir = figures_dir.join("_pages");
        let _ = std::fs::create_dir_all(&pages_dir);
        let page_images = {
            let pdf_p = pdf_path.clone();
            let pg_d = pages_dir.clone();
            tokio::task::spawn_blocking(move || render_pdf_pages(&pdf_p, &pg_d, 12))
                .await
                .unwrap_or_default()
        };

        for (page_number, page_path) in page_images {
            let candidates = match tokio::time::timeout(
                std::time::Duration::from_secs(14),
                vision_scan_page(client, vision_model, &page_path),
            )
            .await
            {
                Ok(result) => result,
                Err(_) => Vec::new(),
            };

            for candidate in candidates {
                let key = (candidate.kind.clone(), candidate.index);
                if extracted.contains(&key) || !has_caption_signal(&candidate, &captions) {
                    continue;
                }

                let filename = format!(
                    "{}_{}_p{}.png",
                    candidate.kind.as_str(),
                    candidate.index,
                    page_number
                );
                let dest = figures_dir.join(filename);
                if !crop_page_region(&page_path, &dest, &candidate.bbox) {
                    continue;
                }

                let caption = captions
                    .get(&key)
                    .cloned()
                    .or_else(|| candidate.caption.clone());
                if insert_figure_record(
                    db,
                    paper_id,
                    &key.0,
                    key.1,
                    caption.as_deref(),
                    &dest,
                    Some(page_number as i64),
                    Some(&candidate.bbox),
                    "vision",
                    &now,
                )
                .await
                {
                    extracted.insert(key);
                }
            }
        }

        let _ = std::fs::remove_dir_all(&pages_dir);
    }

    add_rendered_page_fallbacks(
        db,
        paper_id,
        &pdf_path,
        &figures_dir,
        &captions,
        &mut extracted,
        &now,
    )
    .await;

    add_embedded_image_fallbacks(
        db,
        paper_id,
        &pdf_path,
        &figures_dir,
        &captions,
        &mut extracted,
        &now,
    )
    .await;

    query_figure_contexts(db, paper_id).await
}

async fn load_current_figure_contexts(
    db: &sqlx::SqlitePool,
    paper_id: &str,
) -> Option<Vec<PaperFigureContext>> {
    let rows = sqlx::query(
        "SELECT kind, fig_index, caption, source FROM paper_figures WHERE paper_id = ? ORDER BY fig_index",
    )
    .bind(paper_id)
    .fetch_all(db)
    .await
    .unwrap_or_default();

    if rows.is_empty() {
        return None;
    }

    let has_legacy_rows = rows.iter().any(|row| {
        let kind = row
            .try_get::<Option<String>, _>("kind")
            .ok()
            .flatten()
            .unwrap_or_default();
        let source = row
            .try_get::<Option<String>, _>("source")
            .ok()
            .flatten()
            .unwrap_or_default();
        kind.trim().is_empty() || source.trim().is_empty()
    });

    if has_legacy_rows {
        let _ = sqlx::query("DELETE FROM paper_figures WHERE paper_id = ?")
            .bind(paper_id)
            .execute(db)
            .await;
        return None;
    }

    Some(
        rows.iter()
            .map(|row| PaperFigureContext {
                kind: row
                    .try_get::<Option<String>, _>("kind")
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| "figure".to_string()),
                index: row.get::<i64, _>("fig_index") as u32,
                caption: row.get("caption"),
            })
            .collect(),
    )
}

async fn query_figure_contexts(db: &sqlx::SqlitePool, paper_id: &str) -> Vec<PaperFigureContext> {
    sqlx::query(
        "SELECT kind, fig_index, caption FROM paper_figures WHERE paper_id = ? ORDER BY fig_index",
    )
    .bind(paper_id)
    .fetch_all(db)
    .await
    .unwrap_or_default()
    .iter()
    .map(|row| PaperFigureContext {
        kind: row
            .try_get::<Option<String>, _>("kind")
            .ok()
            .flatten()
            .unwrap_or_else(|| "figure".to_string()),
        index: row.get::<i64, _>("fig_index") as u32,
        caption: row.get("caption"),
    })
    .collect()
}

async fn add_rendered_page_fallbacks(
    db: &sqlx::SqlitePool,
    paper_id: &str,
    pdf_path: &Path,
    figures_dir: &Path,
    captions: &CaptionMap,
    extracted: &mut HashSet<(FigureKind, u32)>,
    now: &str,
) {
    let caption_map = captions.clone();
    let already_extracted = extracted.clone();
    let pdf_p = pdf_path.to_path_buf();
    let fig_d = figures_dir.to_path_buf();
    let crops = tokio::task::spawn_blocking(move || {
        extract_rendered_figure_crops(&pdf_p, &fig_d, &caption_map, &already_extracted)
    })
    .await
    .unwrap_or_default();

    for crop in crops {
        let key = (crop.kind.clone(), crop.index);
        if extracted.contains(&key) {
            continue;
        }
        if insert_figure_record(
            db,
            paper_id,
            &crop.kind,
            crop.index,
            crop.caption.as_deref(),
            &crop.file_path,
            Some(crop.page_number),
            Some(&crop.bbox),
            "rendered",
            now,
        )
        .await
        {
            extracted.insert(key);
        }
    }
}

async fn add_embedded_image_fallbacks(
    db: &sqlx::SqlitePool,
    paper_id: &str,
    pdf_path: &Path,
    figures_dir: &Path,
    captions: &CaptionMap,
    extracted: &mut HashSet<(FigureKind, u32)>,
    now: &str,
) {
    // 没有视觉模型时的兜底：抽取 PDF 内嵌位图。不再只挑“方法图”标题，
    // 否则结果图/无关键词标题的论文会一张都抽不出来（这是“从来不显示图”的主因）。
    let mut expected_figures = captions
        .iter()
        .filter_map(|((kind, index), caption)| {
            (kind == &FigureKind::Figure && !extracted.contains(&(kind.clone(), *index)))
                .then(|| (*index, caption.clone()))
        })
        .collect::<Vec<_>>();
    expected_figures.sort_by_key(|(index, _)| *index);
    expected_figures.truncate(12);

    if expected_figures.is_empty() {
        return;
    }

    let raw_images = {
        let pdf_p = pdf_path.to_path_buf();
        let fig_d = figures_dir.to_path_buf();
        tokio::task::spawn_blocking(move || extract_pdf_images(&pdf_p, &fig_d))
            .await
            .unwrap_or_default()
    };
    let mut candidates = raw_images
        .into_iter()
        .filter(is_likely_paper_figure_image)
        .collect::<Vec<_>>();
    // 按面积从大到小，优先取更可能是正文插图的大图；图与编号按顺序对齐。
    candidates.sort_by(|left, right| right.area().cmp(&left.area()));
    candidates.truncate(expected_figures.len());

    for ((index, caption), image) in expected_figures.into_iter().zip(candidates.into_iter()) {
        let key = (FigureKind::Figure, index);
        if extracted.contains(&key) {
            continue;
        }
        let ext = image
            .file_path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("png");
        let dest = figures_dir.join(format!("figure_{index}_embedded.{ext}"));
        if std::fs::rename(&image.file_path, &dest).is_err()
            && std::fs::copy(&image.file_path, &dest).is_err()
        {
            continue;
        }
        if insert_figure_record(
            db,
            paper_id,
            &key.0,
            key.1,
            Some(&caption),
            &dest,
            None,
            None,
            "embedded",
            now,
        )
        .await
        {
            extracted.insert(key);
        }
    }
}

async fn insert_figure_record(
    db: &sqlx::SqlitePool,
    paper_id: &str,
    kind: &FigureKind,
    index: u32,
    caption: Option<&str>,
    file_path: &Path,
    page_number: Option<i64>,
    bbox: Option<&NormalizedBBox>,
    source: &str,
    now: &str,
) -> bool {
    let id = format!("{}-{}-{}", paper_id, kind.as_str(), index);
    let bbox_json = bbox.map(|item| json!([item.x, item.y, item.width, item.height]).to_string());
    sqlx::query(
        "INSERT INTO paper_figures (id, paper_id, fig_index, kind, caption, file_path, page_number, bbox, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           caption = excluded.caption,
           file_path = excluded.file_path,
           page_number = excluded.page_number,
           bbox = excluded.bbox,
           source = excluded.source",
    )
    .bind(&id)
    .bind(paper_id)
    .bind(index as i64)
    .bind(kind.as_str())
    .bind(caption)
    .bind(file_path.to_string_lossy().as_ref())
    .bind(page_number)
    .bind(bbox_json)
    .bind(source)
    .bind(now)
    .execute(db)
    .await
    .map(|result| result.rows_affected() > 0)
    .unwrap_or(false)
}

fn has_caption_signal(candidate: &VisionFigureCandidate, captions: &CaptionMap) -> bool {
    if captions.contains_key(&(candidate.kind.clone(), candidate.index)) {
        return true;
    }
    candidate.caption.as_deref().is_some_and(|caption| {
        parse_caption_prefix(caption)
            .is_some_and(|(kind, index)| kind == candidate.kind && index == candidate.index)
    })
}

async fn vision_scan_page(
    client: &LlmClient,
    model: Option<&str>,
    page_path: &Path,
) -> Vec<VisionFigureCandidate> {
    let image_data = match std::fs::read(page_path) {
        Ok(data) => data,
        Err(_) => return Vec::new(),
    };
    let b64 = general_purpose::STANDARD.encode(&image_data);

    const PROMPT: &str = "请分析这页学术论文截图，只识别真正有 Figure/Fig/Table/图/表 标题的论文图表。\
忽略出版社 logo、期刊页眉页脚、版权标识、作者头像、装饰图标、页面背景、单独公式和普通正文。\
对每个图表返回编号、类型、标题文本、置信度，以及包含图表主体和标题的归一化 bbox。\
bbox 使用 [x, y, width, height]，坐标范围 0-1，相对于整张页面截图。\
只返回严格合法 JSON：{\"items\":[{\"index\":1,\"type\":\"figure\",\"caption\":\"Figure 1. ...\",\"confidence\":0.9,\"bbox\":[0.08,0.18,0.84,0.36]}]}。\
如果没有明确编号的图表，返回 {\"items\":[]}。";

    let response = match client
        .chat_with_image(&b64, "image/png", PROMPT, model, 0.1)
        .await
    {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };

    let json_str = extract_json(&response);
    let value: serde_json::Value = serde_json::from_str(&json_str).unwrap_or_default();
    value["items"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(vision_candidate_from_value)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn vision_candidate_from_value(value: &serde_json::Value) -> Option<VisionFigureCandidate> {
    let index = value.get("index")?.as_u64()? as u32;
    if index == 0 || index > 200 {
        return None;
    }
    let kind = value
        .get("type")
        .and_then(|item| item.as_str())
        .and_then(FigureKind::from_str)
        .unwrap_or(FigureKind::Figure);
    let bbox = value.get("bbox").and_then(bbox_from_value)?;
    if bbox.width < 0.08 || bbox.height < 0.06 || bbox.width * bbox.height < 0.008 {
        return None;
    }
    let confidence = value
        .get("confidence")
        .and_then(|item| item.as_f64())
        .unwrap_or(0.7) as f32;
    if confidence < 0.45 {
        return None;
    }

    Some(VisionFigureCandidate {
        kind,
        index,
        bbox,
        caption: value
            .get("caption")
            .and_then(|item| item.as_str())
            .map(|item| item.trim().to_string())
            .filter(|item| !item.is_empty()),
    })
}

fn bbox_from_value(value: &serde_json::Value) -> Option<NormalizedBBox> {
    let arr = value.as_array()?;
    if arr.len() != 4 {
        return None;
    }
    let mut nums = [0f32; 4];
    for (idx, item) in arr.iter().enumerate() {
        nums[idx] = item.as_f64()? as f32;
    }
    if nums.iter().any(|value| !value.is_finite() || *value < 0.0) {
        return None;
    }
    if nums.iter().any(|value| *value > 1.0) && nums.iter().all(|value| *value <= 100.0) {
        for value in &mut nums {
            *value /= 100.0;
        }
    }
    let bbox = NormalizedBBox {
        x: nums[0].clamp(0.0, 1.0),
        y: nums[1].clamp(0.0, 1.0),
        width: nums[2].clamp(0.0, 1.0),
        height: nums[3].clamp(0.0, 1.0),
    };
    if bbox.x + bbox.width <= 0.02 || bbox.y + bbox.height <= 0.02 {
        return None;
    }
    Some(bbox)
}

fn extract_figure_captions(full_text: &str) -> CaptionMap {
    let mut captions = CaptionMap::new();
    let lines = full_text.lines().collect::<Vec<_>>();

    for (line_index, line) in lines.iter().enumerate() {
        let Some((kind, index)) = parse_caption_prefix(line) else {
            continue;
        };
        let mut caption = line.trim().split_whitespace().collect::<Vec<_>>().join(" ");
        for next in lines.iter().skip(line_index + 1).take(2) {
            let trimmed = next.trim();
            if trimmed.is_empty()
                || parse_caption_prefix(trimmed).is_some()
                || looks_like_section_heading(trimmed)
            {
                break;
            }
            if caption.len() + trimmed.len() > 480 {
                break;
            }
            caption.push(' ');
            caption.push_str(&trimmed.split_whitespace().collect::<Vec<_>>().join(" "));
        }
        captions.entry((kind, index)).or_insert(caption);
    }

    captions
}

fn parse_caption_prefix(line: &str) -> Option<(FigureKind, u32)> {
    let pattern = regex::Regex::new(
        r"(?i)^\s*(?:\(?\s*)?(figure|fig\.?|table|tab\.?|图|表)\s*([0-9]{1,3})\b",
    )
    .ok()?;
    let captures = pattern.captures(line)?;
    let marker = captures.get(1)?.as_str().trim_end_matches('.');
    let kind = FigureKind::from_str(marker)?;
    let index = captures.get(2)?.as_str().parse::<u32>().ok()?;
    (index > 0 && index <= 200).then_some((kind, index))
}

fn looks_like_section_heading(line: &str) -> bool {
    if line.len() > 90 {
        return false;
    }
    let normalized = line
        .trim()
        .trim_start_matches(|ch: char| ch.is_ascii_digit() || ch == '.')
        .trim()
        .to_ascii_lowercase();
    matches!(
        normalized.as_str(),
        "abstract"
            | "introduction"
            | "related work"
            | "method"
            | "methods"
            | "experiments"
            | "results"
            | "conclusion"
            | "references"
    )
}

#[allow(dead_code)] // 兜底抽取已不再按“方法图”标题过滤；保留供未来分类使用
fn is_likely_method_figure_caption(caption: &str) -> bool {
    let normalized = caption.to_ascii_lowercase();
    const EXCLUDE_KEYWORDS: &[&str] = &[
        "result",
        "performance",
        "experiment",
        "comparison",
        "ablation",
        "quantitative",
        "qualitative",
        "accuracy",
        "benchmark",
        "dataset",
        "baseline",
        "evaluation",
        "visualization",
        "curve",
        "结果",
        "性能",
        "实验",
        "对比",
        "消融",
        "准确",
        "指标",
        "曲线",
        "评估",
        "数据集",
        "基线",
        "可视化",
    ];
    const INCLUDE_KEYWORDS: &[&str] = &[
        "architecture",
        "framework",
        "overview",
        "pipeline",
        "model",
        "module",
        "method",
        "network",
        "algorithm",
        "workflow",
        "system",
        "approach",
        "schema",
        "diagram",
        "structure",
        "encoder",
        "decoder",
        "架构",
        "框架",
        "流程",
        "方法",
        "模型",
        "模块",
        "网络",
        "算法",
        "结构",
        "示意",
        "概览",
    ];

    !EXCLUDE_KEYWORDS
        .iter()
        .any(|keyword| normalized.contains(keyword))
        && INCLUDE_KEYWORDS
            .iter()
            .any(|keyword| normalized.contains(keyword))
}

#[tauri::command]
pub async fn papers_list_figures(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    paper_id: String,
) -> Result<serde_json::Value, String> {
    let paper_row = sqlx::query("SELECT file_path, full_text FROM papers WHERE id = ?")
        .bind(&paper_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let (paper_file_path, paper_full_text) = if let Some(row) = paper_row {
        (
            row.try_get::<Option<String>, _>("file_path").ok().flatten(),
            row.get::<Option<String>, _>("full_text")
                .unwrap_or_default(),
        )
    } else {
        (None, String::new())
    };

    let mut rows = query_figure_rows(&state.db, &paper_id).await?;
    if rows.is_empty() {
        ensure_figures_extracted(
            &app,
            &state.db,
            &paper_id,
            paper_file_path.as_deref(),
            &paper_full_text,
            None,
            None,
        )
        .await;
        rows = query_figure_rows(&state.db, &paper_id).await?;
    }

    if !rows.is_empty() && !paper_full_text.trim().is_empty() {
        rows = backfill_missing_captions(&state.db, &paper_id, &paper_full_text, rows).await?;
    }

    let figures_dir = paper_figures_dir(&app, &paper_id).ok();
    let row_meta: Vec<(String, String, i64, String, Option<String>, String)> = rows
        .iter()
        .filter_map(|row| {
            let file_path = row.get::<String, _>("file_path");
            let safe_file_path = figures_dir.as_deref().and_then(|dir| {
                canonical_path_within(dir, Path::new(&file_path), "图表文件").ok()
            })?;

            Some((
                row.get::<String, _>("id"),
                row.get::<String, _>("paper_id"),
                row.get::<i64, _>("fig_index"),
                row.try_get::<Option<String>, _>("kind")
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| "figure".to_string()),
                row.get::<Option<String>, _>("caption"),
                safe_file_path.to_string_lossy().to_string(),
            ))
        })
        .collect();

    use futures_util::StreamExt as _;
    const READ_CONCURRENCY: usize = 8;

    let figures: Vec<serde_json::Value> = futures_util::stream::iter(row_meta)
        .map(
            |(id, paper_id, fig_index, kind, caption, file_path)| async move {
                match tokio::fs::read(&file_path).await {
                    Ok(data) => {
                        let b64 = general_purpose::STANDARD.encode(&data);
                        let ext = Path::new(&file_path)
                            .extension()
                            .and_then(|value| value.to_str())
                            .unwrap_or("jpg");
                        let mime = if ext.eq_ignore_ascii_case("png") {
                            "image/png"
                        } else {
                            "image/jpeg"
                        };
                        Some(json!({
                            "id": id,
                            "paper_id": paper_id,
                            "fig_index": fig_index,
                            "kind": kind,
                            "caption": caption,
                            "data_url": format!("data:{mime};base64,{b64}"),
                        }))
                    }
                    Err(error) => {
                        eprintln!("[list_figures] failed to read figure file {file_path}: {error}");
                        None
                    }
                }
            },
        )
        .buffer_unordered(READ_CONCURRENCY)
        .filter_map(|item| async move { item })
        .collect()
        .await;

    Ok(json!(figures))
}

async fn query_figure_rows(
    db: &sqlx::SqlitePool,
    paper_id: &str,
) -> Result<Vec<sqlx::sqlite::SqliteRow>, String> {
    sqlx::query(
        "SELECT id, paper_id, fig_index, kind, caption, file_path FROM paper_figures WHERE paper_id = ? ORDER BY fig_index",
    )
    .bind(paper_id)
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())
}

async fn backfill_missing_captions(
    db: &sqlx::SqlitePool,
    paper_id: &str,
    full_text: &str,
    rows: Vec<sqlx::sqlite::SqliteRow>,
) -> Result<Vec<sqlx::sqlite::SqliteRow>, String> {
    let captions = extract_figure_captions(full_text);
    let mut caption_updated = false;
    for row in &rows {
        let current_caption: Option<String> = row.get("caption");
        if current_caption
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
        {
            continue;
        }
        let kind = row
            .try_get::<Option<String>, _>("kind")
            .ok()
            .flatten()
            .and_then(|value| FigureKind::from_str(&value))
            .unwrap_or(FigureKind::Figure);
        let fig_index = row.get::<i64, _>("fig_index") as u32;
        if let Some(next_caption) = captions.get(&(kind, fig_index)) {
            let figure_id: String = row.get("id");
            let updated = sqlx::query(
                "UPDATE paper_figures
                 SET caption = ?
                 WHERE id = ? AND (caption IS NULL OR TRIM(caption) = '')",
            )
            .bind(next_caption)
            .bind(&figure_id)
            .execute(db)
            .await
            .map(|result| result.rows_affected() > 0)
            .unwrap_or(false);
            caption_updated = caption_updated || updated;
        }
    }

    if caption_updated {
        query_figure_rows(db, paper_id).await
    } else {
        Ok(rows)
    }
}

fn extract_json(input: &str) -> String {
    let trimmed = input.trim();
    let unfenced = if trimmed.starts_with("```") {
        let mut lines = trimmed.lines();
        let _ = lines.next();
        let body = lines.collect::<Vec<_>>();
        if body
            .last()
            .is_some_and(|line| line.trim_start().starts_with("```"))
        {
            body[..body.len().saturating_sub(1)].join("\n")
        } else {
            body.join("\n")
        }
    } else {
        trimmed.to_string()
    };
    let start = unfenced.find('{').unwrap_or(0);
    let end = unfenced
        .rfind('}')
        .map(|index| index + 1)
        .unwrap_or(unfenced.len());
    unfenced[start..end].to_string()
}

fn canonical_path_within(base: &Path, path: &Path, label: &str) -> Result<PathBuf, String> {
    let canonical_base = base
        .canonicalize()
        .map_err(|e| format!("无法校验{label}目录：{e}"))?;
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("{label}不可访问：{e}"))?;

    if canonical_path.starts_with(&canonical_base) {
        Ok(canonical_path)
    } else {
        Err(format!("{label}不在应用管理目录内。"))
    }
}

fn managed_papers_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let papers_dir = data_dir.join("papers");
    std::fs::create_dir_all(&papers_dir).map_err(|e| format!("无法创建 PDF 存储目录：{e}"))?;
    Ok(papers_dir)
}

fn canonical_managed_pdf_path(app: &tauri::AppHandle, path: &Path) -> Result<PathBuf, String> {
    let papers_dir = managed_papers_dir(app)?;
    canonical_path_within(&papers_dir, path, "PDF 文件")
}
