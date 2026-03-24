use crate::state::AppState;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub title: String,
    pub description: String,
    pub prompt: String,
    pub tags: Vec<String>,
    pub is_builtin: bool,
    pub is_enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

fn row_to_skill(row: &sqlx::sqlite::SqliteRow) -> Skill {
    let tags_str: String = row.get("tags");
    let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
    let is_builtin: i64 = row.get("is_builtin");
    let is_enabled: i64 = row.get("is_enabled");
    Skill {
        id: row.get("id"),
        name: row.get("name"),
        title: row.get("title"),
        description: row.get("description"),
        prompt: row.get("prompt"),
        tags,
        is_builtin: is_builtin != 0,
        is_enabled: is_enabled != 0,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

async fn get_skill_by_id(db: &sqlx::SqlitePool, id: &str) -> Result<Skill, String> {
    let row = sqlx::query(
        "SELECT id, name, title, description, prompt, tags, is_builtin, is_enabled, created_at, updated_at FROM skills WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "技能不存在".to_string())?;
    Ok(row_to_skill(&row))
}

// ── Commands ────────────────────────────────────────────────────

#[tauri::command]
pub async fn skills_list(state: State<'_, AppState>) -> Result<Vec<Skill>, String> {
    let rows = sqlx::query(
        "SELECT id, name, title, description, prompt, tags, is_builtin, is_enabled, created_at, updated_at FROM skills ORDER BY is_builtin DESC, title ASC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows.iter().map(row_to_skill).collect())
}

#[tauri::command]
pub async fn skills_create(
    state: State<'_, AppState>,
    name: String,
    title: String,
    description: String,
    prompt: String,
    tags: Option<Vec<String>>,
) -> Result<Skill, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("技能名称不能为空".to_string());
    }
    if title.trim().is_empty() {
        return Err("技能标题不能为空".to_string());
    }

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM skills WHERE name = ?")
        .bind(&name)
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    if count > 0 {
        return Err(format!("技能名称 '{}' 已存在", name));
    }

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let tags_json = serde_json::to_string(&tags.unwrap_or_default()).unwrap_or_else(|_| "[]".to_string());

    sqlx::query(
        "INSERT INTO skills (id, name, title, description, prompt, tags, is_builtin, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)",
    )
    .bind(&id)
    .bind(&name)
    .bind(title.trim())
    .bind(description.trim())
    .bind(prompt.trim())
    .bind(&tags_json)
    .bind(&now)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    get_skill_by_id(&state.db, &id).await
}

#[tauri::command]
pub async fn skills_update(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    description: Option<String>,
    prompt: Option<String>,
    tags: Option<Vec<String>>,
    is_enabled: Option<bool>,
) -> Result<Skill, String> {
    let existing = get_skill_by_id(&state.db, &id).await?;
    let now = chrono::Utc::now().to_rfc3339();

    let new_title = title.map(|s| s.trim().to_string()).unwrap_or(existing.title);
    let new_description = description.map(|s| s.trim().to_string()).unwrap_or(existing.description);
    let new_prompt = prompt.map(|s| s.trim().to_string()).unwrap_or(existing.prompt);
    let new_tags_json = serde_json::to_string(&tags.unwrap_or(existing.tags)).unwrap_or_else(|_| "[]".to_string());
    let new_enabled: i64 = is_enabled.unwrap_or(existing.is_enabled) as i64;

    sqlx::query(
        "UPDATE skills SET title = ?, description = ?, prompt = ?, tags = ?, is_enabled = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&new_title)
    .bind(&new_description)
    .bind(&new_prompt)
    .bind(&new_tags_json)
    .bind(new_enabled)
    .bind(&now)
    .bind(&id)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    get_skill_by_id(&state.db, &id).await
}

#[tauri::command]
pub async fn skills_delete(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let is_builtin: Option<i64> = sqlx::query_scalar("SELECT is_builtin FROM skills WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    match is_builtin {
        None => return Err("技能不存在".to_string()),
        Some(1) => return Err("内置技能不能删除，可以禁用它".to_string()),
        _ => {}
    }

    sqlx::query("DELETE FROM skills WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn skills_reset_builtins(state: State<'_, AppState>) -> Result<Vec<Skill>, String> {
    sqlx::query("DELETE FROM skills WHERE is_builtin = 1")
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    seed_builtin_skills(&state.db).await.map_err(|e| e.to_string())?;

    let rows = sqlx::query(
        "SELECT id, name, title, description, prompt, tags, is_builtin, is_enabled, created_at, updated_at FROM skills ORDER BY is_builtin DESC, title ASC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.iter().map(row_to_skill).collect())
}

// ── Built-in skill seeding ──────────────────────────────────────

struct BuiltinSkill {
    id: &'static str,
    name: &'static str,
    title: &'static str,
    description: &'static str,
    prompt: &'static str,
    tags: &'static [&'static str],
}

fn builtin_skills() -> &'static [BuiltinSkill] {
    &[
        BuiltinSkill {
            id: "00000000-0001-0000-0000-000000000000",
            name: "paper-read",
            title: "论文四维解读",
            description: "从研究问题、核心方法、实验设计、主要贡献四个维度系统解读论文",
            prompt: "请从以下四个维度系统解读这篇论文：\n\n**① 研究问题**：核心问题是什么？背景动机如何？\n**② 核心方法**：提出了什么方法或框架？与现有方法的关键区别是什么？\n**③ 实验设计**：如何验证方法？使用了哪些数据集、基线和评估指标？\n**④ 主要贡献**：列出 3–5 条核心贡献，并指出主要局限。\n\n论文信息（标题 / 摘要 / 关键段落）：",
            tags: &["论文", "分析"],
        },
        BuiltinSkill {
            id: "00000000-0002-0000-0000-000000000000",
            name: "paper-critique",
            title: "论文批判性评估",
            description: "批判性评估论文的方法设计、实验可信度与潜在缺陷",
            prompt: "请对以下论文进行批判性评估，重点关注：\n\n1. **方法设计**：方法是否有新颖性？假设是否合理？是否存在重大缺陷？\n2. **实验可信度**：基线是否公平？数据集是否具有代表性？消融实验是否充分？\n3. **结论支撑**：实验结果是否真正支持所声明的贡献？是否有过度声明？\n4. **潜在弱点**：指出 3–5 个主要弱点或值得深究的问题。\n\n论文信息（标题 / 摘要 / 关键段落）：",
            tags: &["论文", "评估"],
        },
        BuiltinSkill {
            id: "00000000-0003-0000-0000-000000000000",
            name: "paper-compare",
            title: "论文横向对比",
            description: "从方法、实验、贡献三个维度对比多篇相关论文的异同",
            prompt: "请从核心方法、解决的问题、实验设置、主要贡献、主要局限五个维度，横向对比以下多篇论文。先用对比表格呈现，再用一段话总结各论文的技术演进关系与最大差异。\n\n论文信息（逐篇提供标题 / 摘要）：",
            tags: &["论文", "对比"],
        },
        BuiltinSkill {
            id: "00000000-0004-0000-0000-000000000000",
            name: "simplify",
            title: "简化技术描述",
            description: "去除冗余，将复杂技术内容提炼为清晰、精准的表达（源自 Claude simplify skill）",
            prompt: "请简化以下技术描述，去除冗余措辞和不必要的复杂性，保留核心语义，使表达更清晰、精准、易于理解。输出简化后的版本，并用一句话说明主要改动：\n\n",
            tags: &["写作", "精简"],
        },
        BuiltinSkill {
            id: "00000000-0005-0000-0000-000000000000",
            name: "polish",
            title: "学术文稿精修",
            description: "对学术文本进行最终精修，改善流畅度、逻辑衔接和用词准确性（源自 Claude polish skill）",
            prompt: "请对以下学术文本进行最终精修，关注：\n1. 用词准确性和专业性\n2. 句子流畅度和逻辑衔接\n3. 段落结构和过渡\n4. 消除歧义和冗余\n\n保持原文语义，仅优化表达质量。逐段输出修改后的版本：\n\n",
            tags: &["写作", "润色"],
        },
        BuiltinSkill {
            id: "00000000-0006-0000-0000-000000000000",
            name: "abstract-write",
            title: "摘要撰写与润色",
            description: "生成或改写论文摘要，包含背景、方法、结果、结论四要素",
            prompt: "请为以下研究内容撰写或改写摘要（约 200–250 词），须包含四个要素：\n- **背景**：研究领域与核心问题\n- **方法**：提出的方法或技术\n- **结果**：主要实验结果（含具体数据）\n- **结论**：研究贡献与意义\n\n研究内容：",
            tags: &["写作", "摘要"],
        },
        BuiltinSkill {
            id: "00000000-0007-0000-0000-000000000000",
            name: "related-work",
            title: "相关工作综述",
            description: "围绕指定主题，生成结构化的相关工作综述段落",
            prompt: "请围绕以下研究主题，撰写一段相关工作综述（300–400 字），需涵盖：\n1. 该方向的发展脉络（早期工作 → 近期进展）\n2. 主要方法分类与代表性工作（引用至少 5–8 篇）\n3. 现有方法的共同局限，自然引出本文的研究动机\n\n研究主题：",
            tags: &["综述", "写作"],
        },
        BuiltinSkill {
            id: "00000000-0008-0000-0000-000000000000",
            name: "survey-outline",
            title: "综述提纲生成",
            description: "快速生成领域综述的章节结构与各节内容框架",
            prompt: "请为以下研究主题生成一份综述文章提纲，包含：\n\n1. **引言**（研究背景、综述范围、组织结构）\n2. **背景与基础知识**（关键概念与前置知识）\n3. **主要方法分类**（2–4 个子类别，每类说明代表方法）\n4. **实验基准与评估**（常用数据集、评估指标）\n5. **挑战与未来方向**\n6. **结论**\n\n每节需列出核心内容要点与建议引用方向。研究主题：",
            tags: &["综述", "规划"],
        },
        BuiltinSkill {
            id: "00000000-0009-0000-0000-000000000000",
            name: "peer-review",
            title: "模拟同行评审",
            description: "以顶会审稿人视角对论文进行综合评审，给出评分与修改意见（源自 Claude audit skill）",
            prompt: "请以顶级会议（如 NeurIPS / ICML / CVPR）审稿人的视角对以下论文进行评审，输出：\n\n**整体评分**（1–10，含简短理由）\n**优点**（3–5 条）\n**主要缺陷**（3–5 条，区分 major / minor）\n**具体修改建议**（可操作的改进方向）\n**建议决定**：接受 / 弱接受 / 弱拒绝 / 拒绝\n\n论文信息：",
            tags: &["评审", "评估"],
        },
        BuiltinSkill {
            id: "00000000-0010-0000-0000-000000000000",
            name: "code-explain",
            title: "代码逻辑解析",
            description: "逐步解析代码的核心逻辑、设计意图和关键细节（源自 Codex skill）",
            prompt: "请逐步解析以下代码，说明：\n1. **整体功能**：这段代码实现了什么？\n2. **核心逻辑**：逐个关键步骤的作用和设计意图\n3. **关键细节**：值得注意的技术点或潜在边界条件\n4. **改进建议**：可优化的地方（如有）\n\n```\n[在此粘贴代码]\n```",
            tags: &["代码", "解析"],
        },
        BuiltinSkill {
            id: "00000000-0011-0000-0000-000000000000",
            name: "code-review",
            title: "代码质量审查",
            description: "审查代码的正确性、可读性和效率，给出具体改进意见（源自 Codex skill）",
            prompt: "请对以下代码进行质量审查，检查：\n1. **正确性**：是否有 bug、边界条件问题或逻辑错误\n2. **可读性**：命名、注释、代码结构是否清晰\n3. **效率**：是否有性能瓶颈或冗余计算\n4. **鲁棒性**：错误处理是否完善\n\n为每个问题给出具体位置和修改建议。\n\n```\n[在此粘贴代码]\n```",
            tags: &["代码", "审查"],
        },
        BuiltinSkill {
            id: "00000000-0012-0000-0000-000000000000",
            name: "reproduce-plan",
            title: "复现规划",
            description: "快速梳理论文复现所需的环境、数据、关键步骤和潜在风险",
            prompt: "请基于以下论文信息，制定一份复现规划，包含：\n\n1. **环境要求**：框架、硬件需求、关键依赖版本\n2. **数据准备**：数据集获取方式、预处理步骤\n3. **复现步骤**：训练 / 推理 / 评估的核心步骤\n4. **关键超参数**：需要精确复现的重要参数设置\n5. **风险提示**：论文描述模糊或容易踩坑的地方\n\n论文信息（含方法描述和实验配置）：",
            tags: &["复现", "规划"],
        },
        BuiltinSkill {
            id: "00000000-0013-0000-0000-000000000000",
            name: "research-plan",
            title: "研究计划制定",
            description: "根据研究目标制定分阶段计划，包含里程碑和风险评估",
            prompt: "请根据以下研究目标，制定一份分阶段研究计划，包含：\n\n1. **目标拆解**：将总目标分解为 3–5 个子目标\n2. **阶段规划**：每个阶段的任务、产出和时间估计\n3. **关键里程碑**：可验证的阶段性成果\n4. **潜在风险**：主要风险点与应对策略\n5. **资源需求**：计算资源、数据、协作需求\n\n研究目标：",
            tags: &["规划", "研究"],
        },
        BuiltinSkill {
            id: "00000000-0014-0000-0000-000000000000",
            name: "translate-academic",
            title: "学术文本翻译",
            description: "将学术文本进行忠实、流畅的中英互译，保留术语准确性",
            prompt: "请将以下学术文本翻译为[目标语言：中文 / 英文]，要求：\n1. 忠实原文语义，不删减、不增补\n2. 专业术语准确，首次出现保留原文括注\n3. 符合学术写作规范，语句流畅自然\n4. 如有歧义，在译文后附注说明\n\n[在此粘贴待翻译文本]",
            tags: &["翻译", "写作"],
        },
        BuiltinSkill {
            id: "00000000-0015-0000-0000-000000000000",
            name: "checklist",
            title: "投稿前核查清单",
            description: "生成针对目标期刊/会议的投稿前核查清单，确保质量和格式符合要求（源自 Claude audit skill）",
            prompt: "请为以下论文生成投稿前核查清单，目标投稿平台：[会议 / 期刊名称]\n\n**内容完整性**\n- [ ] 摘要完整包含背景、方法、结果、结论\n- [ ] 实验有充分的基线对比和消融实验\n- [ ] 相关工作引用了近 2 年代表性工作\n- [ ] 局限性和未来工作诚实说明\n\n**格式规范**\n- [ ] 参考文献格式符合目标会议要求\n- [ ] 图表清晰，caption 完整\n- [ ] 页数在限制内（含参考文献）\n\n**科研伦理**\n- [ ] 数据集使用合规并注明来源\n- [ ] 利益冲突声明（如需要）\n\n论文基本信息（标题、摘要、目标会议）：",
            tags: &["投稿", "核查"],
        },
    ]
}

pub async fn seed_builtin_skills(db: &sqlx::SqlitePool) -> anyhow::Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    for skill in builtin_skills() {
        let tags_json = serde_json::to_string(skill.tags)?;
        sqlx::query(
            "INSERT OR IGNORE INTO skills (id, name, title, description, prompt, tags, is_builtin, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)",
        )
        .bind(skill.id)
        .bind(skill.name)
        .bind(skill.title)
        .bind(skill.description)
        .bind(skill.prompt)
        .bind(&tags_json)
        .bind(&now)
        .bind(&now)
        .execute(db)
        .await?;
    }
    Ok(())
}
