use super::paper_figures::{CaptionMap, FigureKind, NormalizedBBox};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub(crate) struct RenderedFigureCrop {
    pub(crate) kind: FigureKind,
    pub(crate) index: u32,
    pub(crate) caption: Option<String>,
    pub(crate) file_path: PathBuf,
    pub(crate) page_number: i64,
    pub(crate) bbox: NormalizedBBox,
}

#[derive(Debug, Clone)]
struct TextLine {
    page: usize,
    page_width: f32,
    page_height: f32,
    left: f32,
    top: f32,
    right: f32,
    bottom: f32,
    text: String,
}

#[derive(Debug, Clone)]
struct LineBuilder {
    page: usize,
    page_width: f32,
    page_height: f32,
    left: f32,
    top: f32,
    right: f32,
    bottom: f32,
    words: Vec<(i64, String)>,
}

#[derive(Debug, Clone)]
struct CaptionTarget {
    kind: FigureKind,
    index: u32,
    caption: Option<String>,
    page: usize,
    page_width: f32,
    page_height: f32,
    caption_top: f32,
    caption_bottom: f32,
}

impl LineBuilder {
    fn new(
        page: usize,
        page_width: f32,
        page_height: f32,
        left: f32,
        top: f32,
        width: f32,
        height: f32,
    ) -> Self {
        Self {
            page,
            page_width,
            page_height,
            left,
            top,
            right: left + width,
            bottom: top + height,
            words: Vec::new(),
        }
    }

    fn push_word(
        &mut self,
        word_num: i64,
        left: f32,
        top: f32,
        width: f32,
        height: f32,
        text: String,
    ) {
        self.left = self.left.min(left);
        self.top = self.top.min(top);
        self.right = self.right.max(left + width);
        self.bottom = self.bottom.max(top + height);
        self.words.push((word_num, text));
    }

    fn into_line(mut self) -> Option<TextLine> {
        self.words.sort_by_key(|(word_num, _)| *word_num);
        let text = self
            .words
            .into_iter()
            .map(|(_, text)| text)
            .filter(|text| !text.trim().is_empty())
            .collect::<Vec<_>>()
            .join(" ");
        (!text.trim().is_empty()).then_some(TextLine {
            page: self.page,
            page_width: self.page_width,
            page_height: self.page_height,
            left: self.left,
            top: self.top,
            right: self.right,
            bottom: self.bottom,
            text,
        })
    }
}

pub(crate) fn extract_rendered_figure_crops(
    pdf_path: &Path,
    figures_dir: &Path,
    captions: &CaptionMap,
    extracted: &HashSet<(FigureKind, u32)>,
) -> Vec<RenderedFigureCrop> {
    if captions.is_empty() {
        return Vec::new();
    }

    let page_count = pdf_page_count(pdf_path);
    if page_count == 0 {
        return Vec::new();
    }
    let render_limit = page_count.min(60);
    let pages_dir = figures_dir.join("_rendered_pages");
    let _ = std::fs::create_dir_all(&pages_dir);

    let page_images = render_pdf_pages(pdf_path, &pages_dir, render_limit);
    if page_images.is_empty() {
        let _ = std::fs::remove_dir_all(&pages_dir);
        return Vec::new();
    }
    let page_image_map = page_images.into_iter().collect::<HashMap<_, _>>();

    let lines = load_pdf_text_lines(pdf_path, &pages_dir);
    if lines.is_empty() {
        let _ = std::fs::remove_dir_all(&pages_dir);
        return Vec::new();
    }

    let lines_by_page = group_lines_by_page(lines);
    let targets = find_caption_targets(&lines_by_page, captions, extracted, render_limit);
    let targets_by_page = group_targets_by_page(&targets);

    let mut crops = Vec::new();
    for target in targets {
        let Some(page_path) = page_image_map.get(&target.page) else {
            continue;
        };
        let Some(page_lines) = lines_by_page.get(&target.page) else {
            continue;
        };
        let page_targets = targets_by_page
            .get(&target.page)
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        let previous_caption_bottom = page_targets
            .iter()
            .filter(|other| other.caption_bottom < target.caption_top - 1.0)
            .map(|other| other.caption_bottom)
            .max_by(|left, right| left.partial_cmp(right).unwrap_or(Ordering::Equal));
        let next_caption_top = page_targets
            .iter()
            .filter(|other| other.caption_top > target.caption_top + 1.0)
            .map(|other| other.caption_top)
            .min_by(|left, right| left.partial_cmp(right).unwrap_or(Ordering::Equal));
        let bbox = infer_figure_bbox(
            page_lines,
            &target,
            previous_caption_bottom,
            next_caption_top,
        );
        let file_path = figures_dir.join(format!(
            "{}_{}_rendered_p{}.png",
            target.kind.as_str(),
            target.index,
            target.page
        ));
        if crop_page_region(page_path, &file_path, &bbox) {
            crops.push(RenderedFigureCrop {
                kind: target.kind,
                index: target.index,
                caption: target.caption,
                file_path,
                page_number: target.page as i64,
                bbox,
            });
        }
    }

    let _ = std::fs::remove_dir_all(&pages_dir);
    crops
}

pub(crate) fn render_pdf_pages(
    pdf_path: &Path,
    output_dir: &Path,
    max_pages: usize,
) -> Vec<(usize, PathBuf)> {
    if max_pages == 0 {
        return Vec::new();
    }
    let stem = pdf_path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let page_prefix = output_dir.join(format!("{stem}_pg"));

    let pdftoppm_ok = std::process::Command::new("pdftoppm")
        .args([
            "-r",
            "144",
            "-png",
            "-l",
            &max_pages.to_string(),
            pdf_path.to_str().unwrap_or(""),
            page_prefix.to_str().unwrap_or(""),
        ])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false);

    if pdftoppm_ok {
        let mut pages: Vec<PathBuf> = std::fs::read_dir(output_dir)
            .ok()
            .into_iter()
            .flatten()
            .filter_map(|entry| {
                let path = entry.ok()?.path();
                let name = path.file_name()?.to_string_lossy().to_string();
                if name.starts_with(&format!("{stem}_pg")) && name.ends_with(".png") {
                    Some(path)
                } else {
                    None
                }
            })
            .collect();
        pages.sort_by_key(|path| page_sort_key(path));
        if !pages.is_empty() {
            return pages
                .into_iter()
                .enumerate()
                .map(|(idx, path)| (idx + 1, path))
                .collect();
        }
    }

    let ql_ok = std::process::Command::new("qlmanage")
        .args([
            "-t",
            "-s",
            "1200",
            "-o",
            output_dir.to_str().unwrap_or(""),
            pdf_path.to_str().unwrap_or(""),
        ])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false);

    if ql_ok {
        let ql_out = output_dir.join(format!(
            "{}.png",
            pdf_path.file_name().unwrap_or_default().to_string_lossy()
        ));
        if ql_out.exists() {
            return vec![(1, ql_out)];
        }
    }

    Vec::new()
}

pub(crate) fn crop_page_region(
    page_path: &Path,
    output_path: &Path,
    bbox: &NormalizedBBox,
) -> bool {
    let image = match image::open(page_path) {
        Ok(value) => value,
        Err(_) => return false,
    };
    let image_width = image.width();
    let image_height = image.height();
    if image_width < 100 || image_height < 100 {
        return false;
    }

    let margin_x = (bbox.width * 0.025).max(0.008);
    let margin_y = (bbox.height * 0.035).max(0.01);
    let x0 = (bbox.x - margin_x).clamp(0.0, 1.0);
    let y0 = (bbox.y - margin_y).clamp(0.0, 1.0);
    let x1 = (bbox.x + bbox.width + margin_x).clamp(0.0, 1.0);
    let y1 = (bbox.y + bbox.height + margin_y).clamp(0.0, 1.0);
    if x1 <= x0 || y1 <= y0 {
        return false;
    }

    let x = (x0 * image_width as f32).floor() as u32;
    let y = (y0 * image_height as f32).floor() as u32;
    let width = ((x1 - x0) * image_width as f32).ceil() as u32;
    let height = ((y1 - y0) * image_height as f32).ceil() as u32;
    if width < 80 || height < 80 {
        return false;
    }

    let width = width.min(image_width.saturating_sub(x));
    let height = height.min(image_height.saturating_sub(y));
    image
        .crop_imm(x, y, width, height)
        .save(output_path)
        .is_ok()
}

fn pdf_page_count(pdf_path: &Path) -> usize {
    lopdf::Document::load(pdf_path)
        .map(|doc| doc.get_pages().len())
        .unwrap_or(0)
}

fn page_sort_key(path: &Path) -> usize {
    path.file_stem()
        .and_then(|value| value.to_str())
        .and_then(|name| name.rsplit(['-', '_']).next())
        .and_then(|tail| tail.parse::<usize>().ok())
        .unwrap_or(usize::MAX)
}

fn load_pdf_text_lines(pdf_path: &Path, work_dir: &Path) -> Vec<TextLine> {
    let tsv_path = work_dir.join("_text.tsv");
    let ok = std::process::Command::new("pdftotext")
        .args([
            "-tsv",
            pdf_path.to_str().unwrap_or(""),
            tsv_path.to_str().unwrap_or(""),
        ])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false);
    if !ok {
        return Vec::new();
    }

    let Ok(tsv) = std::fs::read_to_string(&tsv_path) else {
        return Vec::new();
    };
    parse_tsv_lines(&tsv)
}

fn parse_tsv_lines(tsv: &str) -> Vec<TextLine> {
    let mut pages: HashMap<usize, (f32, f32)> = HashMap::new();
    let mut builders: HashMap<(usize, i64, i64, i64), LineBuilder> = HashMap::new();

    for line in tsv.lines().skip(1) {
        let columns = line.splitn(12, '\t').collect::<Vec<_>>();
        if columns.len() < 12 {
            continue;
        }
        let level = parse_i64(columns[0]);
        let page = parse_i64(columns[1]).max(0) as usize;
        let par = parse_i64(columns[2]);
        let block = parse_i64(columns[3]);
        let line_num = parse_i64(columns[4]);
        let word_num = parse_i64(columns[5]);
        let left = parse_f32(columns[6]);
        let top = parse_f32(columns[7]);
        let width = parse_f32(columns[8]);
        let height = parse_f32(columns[9]);
        let text = columns[11].trim();

        if level == 1 && text == "###PAGE###" {
            pages.insert(page, (width.max(1.0), height.max(1.0)));
            continue;
        }

        if level != 5 || text.starts_with("###") || text.is_empty() || page == 0 {
            continue;
        }
        let (page_width, page_height) = pages.get(&page).copied().unwrap_or((612.0, 792.0));
        let key = (page, par, block, line_num);
        builders
            .entry(key)
            .and_modify(|builder| {
                builder.push_word(word_num, left, top, width, height, text.to_string());
            })
            .or_insert_with(|| {
                let mut builder =
                    LineBuilder::new(page, page_width, page_height, left, top, width, height);
                builder.push_word(word_num, left, top, width, height, text.to_string());
                builder
            });
    }

    let mut lines = builders
        .into_values()
        .filter_map(LineBuilder::into_line)
        .collect::<Vec<_>>();
    lines.sort_by(|left, right| {
        left.page
            .cmp(&right.page)
            .then_with(|| left.top.partial_cmp(&right.top).unwrap_or(Ordering::Equal))
            .then_with(|| {
                left.left
                    .partial_cmp(&right.left)
                    .unwrap_or(Ordering::Equal)
            })
    });
    lines
}

fn parse_i64(value: &str) -> i64 {
    value.parse::<i64>().unwrap_or(0)
}

fn parse_f32(value: &str) -> f32 {
    value.parse::<f32>().unwrap_or(0.0)
}

fn group_lines_by_page(lines: Vec<TextLine>) -> HashMap<usize, Vec<TextLine>> {
    let mut grouped: HashMap<usize, Vec<TextLine>> = HashMap::new();
    for line in lines {
        grouped.entry(line.page).or_default().push(line);
    }
    for lines in grouped.values_mut() {
        lines.sort_by(|left, right| {
            left.top
                .partial_cmp(&right.top)
                .unwrap_or(Ordering::Equal)
                .then_with(|| {
                    left.left
                        .partial_cmp(&right.left)
                        .unwrap_or(Ordering::Equal)
                })
        });
    }
    grouped
}

fn find_caption_targets(
    lines_by_page: &HashMap<usize, Vec<TextLine>>,
    captions: &CaptionMap,
    extracted: &HashSet<(FigureKind, u32)>,
    render_limit: usize,
) -> Vec<CaptionTarget> {
    let mut seen = HashSet::new();
    let mut targets = Vec::new();
    let mut pages = lines_by_page.keys().copied().collect::<Vec<_>>();
    pages.sort_unstable();

    for page in pages {
        if page > render_limit {
            continue;
        }
        let Some(lines) = lines_by_page.get(&page) else {
            continue;
        };
        for (line_index, line) in lines.iter().enumerate() {
            let Some((kind, index)) = parse_probable_caption_prefix(&line.text) else {
                continue;
            };
            let key = (kind.clone(), index);
            if extracted.contains(&key) || !captions.contains_key(&key) || seen.contains(&key) {
                continue;
            }
            seen.insert(key.clone());
            targets.push(CaptionTarget {
                kind,
                index,
                caption: captions.get(&key).cloned(),
                page,
                page_width: line.page_width,
                page_height: line.page_height,
                caption_top: line.top,
                caption_bottom: caption_bottom(
                    lines,
                    line_index,
                    captions.get(&key).map(String::as_str),
                ),
            });
        }
    }
    targets
}

fn group_targets_by_page(targets: &[CaptionTarget]) -> HashMap<usize, Vec<CaptionTarget>> {
    let mut grouped: HashMap<usize, Vec<CaptionTarget>> = HashMap::new();
    for target in targets {
        grouped.entry(target.page).or_default().push(target.clone());
    }
    for targets in grouped.values_mut() {
        targets.sort_by(|left, right| {
            left.caption_top
                .partial_cmp(&right.caption_top)
                .unwrap_or(Ordering::Equal)
        });
    }
    grouped
}

fn parse_probable_caption_prefix(line: &str) -> Option<(FigureKind, u32)> {
    let pattern = regex::Regex::new(
        r"(?i)^\s*(?:\(?\s*)?(figure|fig\.?|table|tab\.?|图|表)\s*([0-9]{1,3})\s*[:：.]",
    )
    .ok()?;
    let captures = pattern.captures(line)?;
    let marker = captures.get(1)?.as_str().trim_end_matches('.');
    let kind = FigureKind::from_str(marker)?;
    let index = captures.get(2)?.as_str().parse::<u32>().ok()?;
    (index > 0 && index <= 200).then_some((kind, index))
}

fn caption_bottom(lines: &[TextLine], line_index: usize, expected_caption: Option<&str>) -> f32 {
    let start = &lines[line_index];
    let mut bottom = start.bottom;
    let mut caption_text = start.text.clone();
    if caption_text_reaches_expected(&caption_text, expected_caption) {
        return bottom;
    }
    for next in lines.iter().skip(line_index + 1) {
        if next.page != start.page || next.top > start.top + 76.0 {
            break;
        }
        if next.top - bottom > 16.0 || parse_probable_caption_prefix(&next.text).is_some() {
            break;
        }
        bottom = bottom.max(next.bottom);
        caption_text.push(' ');
        caption_text.push_str(&next.text);
        if caption_text_reaches_expected(&caption_text, expected_caption) {
            break;
        }
    }
    bottom
}

fn caption_text_reaches_expected(accumulated: &str, expected_caption: Option<&str>) -> bool {
    let Some(expected_caption) = expected_caption else {
        return false;
    };
    let expected = compact_caption_text(expected_caption);
    if expected.is_empty() {
        return false;
    }
    let accumulated = compact_caption_text(accumulated);
    accumulated.contains(&expected) || accumulated.len() + 16 >= expected.len()
}

fn compact_caption_text(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn infer_figure_bbox(
    page_lines: &[TextLine],
    target: &CaptionTarget,
    previous_caption_bottom: Option<f32>,
    next_caption_top: Option<f32>,
) -> NormalizedBBox {
    let page_width = target.page_width.max(1.0);
    let page_height = target.page_height.max(1.0);
    let min_top = previous_caption_bottom
        .map(|value| value + 8.0)
        .unwrap_or(page_height * 0.055);
    let window_top = (target.caption_top - 420.0).max(min_top);
    let heuristic_top = target.caption_top - 330.0;
    let mut cursor = window_top;
    let mut best_gap = 0.0f32;
    let mut best_start = None;

    for line in page_lines
        .iter()
        .filter(|line| line.top >= window_top && line.bottom < target.caption_top - 2.0)
    {
        let gap = line.top - cursor;
        if gap > best_gap {
            best_gap = gap;
            best_start = Some(line.top);
        }
        cursor = cursor.max(line.bottom);
    }

    let mut top = if let Some(start) = best_start {
        if best_gap >= 16.0 && target.caption_top - start > 140.0 {
            start - 18.0
        } else {
            heuristic_top
        }
    } else {
        heuristic_top
    };
    top = top.max(min_top).max(page_height * 0.04);

    let bottom_limit = next_caption_top
        .map(|value| value - 8.0)
        .unwrap_or(page_height * 0.96);
    let mut bottom = (target.caption_bottom + 6.0)
        .min(bottom_limit)
        .min(page_height * 0.97);
    if bottom - top < 120.0 {
        top = (bottom - 220.0).max(min_top).max(page_height * 0.04);
    }
    if bottom <= top {
        bottom = (top + 180.0).min(page_height * 0.97);
    }

    let (left, right) = infer_horizontal_bounds(page_lines, page_width, top, bottom);
    NormalizedBBox {
        x: (left / page_width).clamp(0.0, 1.0),
        y: (top / page_height).clamp(0.0, 1.0),
        width: ((right - left) / page_width).clamp(0.05, 1.0),
        height: ((bottom - top) / page_height).clamp(0.05, 1.0),
    }
}

fn infer_horizontal_bounds(
    page_lines: &[TextLine],
    page_width: f32,
    top: f32,
    bottom: f32,
) -> (f32, f32) {
    let mut left = page_width * 0.08;
    let mut right = page_width * 0.92;
    let mut saw_line = false;

    for line in page_lines
        .iter()
        .filter(|line| line.bottom >= top && line.top <= bottom)
    {
        left = left.min(line.left - 36.0);
        right = right.max(line.right + 36.0);
        saw_line = true;
    }

    if !saw_line {
        return (left, right);
    }
    (left.max(page_width * 0.035), right.min(page_width * 0.965))
}
