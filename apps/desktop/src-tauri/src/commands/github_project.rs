use crate::llm::{resolve_model, resolve_temperature, LlmClient, LlmMessage};
use crate::state::AppState;
use crate::web_search::web_search_structured;
use anyhow::{anyhow, Context};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::collections::HashSet;
use tauri::State;

const GITHUB_API_URL: &str = "https://api.github.com/search/repositories";
const GITHUB_USER_AGENT: &str = "xiaoyan-desktop/0.4.6";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct GithubProjectSearchRequest {
    pub query: String,
    pub limit: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct GithubApiRepo {
    full_name: String,
    owner: GithubOwner,
    name: String,
    html_url: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    language: Option<String>,
    #[serde(default)]
    stargazers_count: i64,
    #[serde(default)]
    forks_count: i64,
    #[serde(default)]
    updated_at: String,
    #[serde(default)]
    license: Option<GithubLicense>,
    #[serde(default)]
    topics: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct GithubOwner {
    login: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct GithubLicense {
    spdx_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct GithubSearchResponse {
    #[serde(default)]
    items: Vec<GithubApiRepo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct GithubRepo {
    pub full_name: String,
    pub owner: String,
    pub name: String,
    pub html_url: String,
    pub description: String,
    pub language: String,
    pub stargazers_count: i64,
    pub forks_count: i64,
    pub updated_at: String,
    pub license: String,
    pub topics: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct GithubProjectSearchResponse {
    pub query: String,
    pub provider: String,
    pub candidate_count: usize,
    pub llm_used: bool,
    pub overall_summary: String,
    pub ranking_note: String,
    pub repos: Vec<GithubRepo>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct LlmRankingResponse {
    overall_summary: Option<String>,
    ranking_note: Option<String>,
    repos: Vec<LlmRankingRepo>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct LlmRankingRepo {
    full_name: String,
    #[allow(dead_code)]
    score: Option<i32>,
    #[allow(dead_code)]
    reason: Option<String>,
}

#[tauri::command]
pub async fn github_project_search(
    state: State<'_, AppState>,
    request: GithubProjectSearchRequest,
) -> Result<serde_json::Value, String> {
    let query = clean_whitespace(&request.query);
    if query.is_empty() {
        return Err("请输入研究主题或关键词。".into());
    }

    let limit = request.limit.unwrap_or(8).clamp(1, 20) as usize;
    let settings = state.settings.read().await.clone();

    // 用 LLM 把用户意图扩展成多个 GitHub 搜索查询，避免只匹配字面关键词。
    let search_queries = expand_search_queries(&settings, &query).await.unwrap_or_else(|error| {
        eprintln!("扩展 GitHub 搜索查询失败：{}", error);
        vec![query.clone()]
    });

    // 优先使用 GitHub Search API；若未配置 token 触发限流，则降级到联网搜索。
    let (mut repos, provider) = match fetch_github_repos_multi(&settings, &search_queries, limit * 2).await {
        Ok(items) => (items, "github_api".to_string()),
        Err(github_err) => {
            let web_queries: Vec<String> = search_queries
                .iter()
                .map(|q| format!("{} site:github.com", q))
                .collect();
            match fetch_repos_via_web_search_multi(&settings, &web_queries, limit * 2).await {
                Ok(items) => (items, "web_search".to_string()),
                Err(_) => return Err(format_github_error(&github_err)),
            }
        }
    };

    if repos.is_empty() {
        let empty = GithubProjectSearchResponse {
            query: query.clone(),
            provider,
            candidate_count: 0,
            llm_used: false,
            overall_summary: "未检索到相关 GitHub 项目，建议换一组关键词再试。".into(),
            ranking_note: "无候选项目。".into(),
            repos: Vec::new(),
        };
        return Ok(json!(empty));
    }

    // 去重。
    let mut seen = HashSet::new();
    repos.retain(|repo| seen.insert(repo.full_name.clone()));

    // 按 Star 数做初排，让 LLM rerank 的候选质量更高。
    repos.sort_by(|a, b| b.stargazers_count.cmp(&a.stargazers_count));

    let (llm_used, overall_summary, ranking_note, ranked) =
        match rerank_with_llm(&settings, &query, limit, &repos).await {
            Ok(Some((summary, note, items))) => (true, summary, note, items),
            _ => {
                let note = "已按 Star 数与关键词相关度做启发式排序。".to_string();
                let summary = format!(
                    "从 {} 个候选项目中筛选出 {} 个，建议优先查看 Star 较高、最近仍在维护的项目。",
                    repos.len(),
                    repos.len().min(limit)
                );
                let heuristic = repos.iter().take(limit).cloned().collect();
                (false, summary, note, heuristic)
            }
        };

    let response = GithubProjectSearchResponse {
        query: query.clone(),
        provider,
        candidate_count: repos.len(),
        llm_used,
        overall_summary,
        ranking_note,
        repos: ranked,
    };

    Ok(json!(response))
}

async fn fetch_github_repos_multi(
    settings: &HashMap<String, String>,
    queries: &[String],
    per_query_limit: usize,
) -> anyhow::Result<Vec<GithubRepo>> {
    let client = reqwest::Client::new();
    let token = settings
        .get("github_api_key")
        .map(|value| value.trim())
        .filter(|value| !value.is_empty());

    let mut all_repos = Vec::new();
    let mut seen = HashSet::new();

    for query in queries {
        let mut builder = client
            .get(GITHUB_API_URL)
            .header("User-Agent", GITHUB_USER_AGENT)
            .query(&[
                ("q", query.to_string()),
                ("sort", "stars".to_string()),
                ("order", "desc".to_string()),
                ("per_page", per_query_limit.max(10).min(50).to_string()),
            ]);

        if let Some(t) = token {
            builder = builder.header("Authorization", format!("Bearer {}", t));
        }

        let resp = builder.send().await.context("请求 GitHub API 失败")?;
        let status = resp.status();

        if status == reqwest::StatusCode::FORBIDDEN || status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(anyhow!(
                "GitHub API 触发速率限制。可在「设置 → 外部学术服务」配置 GitHub Personal Access Token。"
            ));
        }

        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("GitHub API 返回错误 {}: {}", status.as_u16(), body));
        }

        let payload: GithubSearchResponse = resp.json().await.context("解析 GitHub 响应失败")?;
        for repo in payload.items {
            let mapped = map_github_repo(repo);
            if seen.insert(mapped.full_name.clone()) {
                all_repos.push(mapped);
            }
        }
    }

    Ok(all_repos)
}

async fn fetch_repos_via_web_search_multi(
    settings: &HashMap<String, String>,
    queries: &[String],
    _limit: usize,
) -> anyhow::Result<Vec<GithubRepo>> {
    let mut all_repos = Vec::new();
    let mut seen = HashSet::new();

    for query in queries {
        let outcome = web_search_structured(query, settings)
            .await
            .map_err(|error| anyhow!("联网搜索失败：{}", error))?;

        for result in outcome.items {
            let url = result.url;
            if !url.contains("github.com/") {
                continue;
            }
            let Some(full_name) = extract_github_full_name(&url) else {
                continue;
            };
            if !seen.insert(full_name.clone()) {
                continue;
            }
            all_repos.push(GithubRepo {
                full_name: full_name.clone(),
                owner: full_name.split('/').next().unwrap_or("").to_string(),
                name: full_name.split('/').nth(1).unwrap_or("").to_string(),
                html_url: url,
                description: result.title,
                language: String::new(),
                stargazers_count: 0,
                forks_count: 0,
                updated_at: String::new(),
                license: String::new(),
                topics: Vec::new(),
            });
        }
    }

    Ok(all_repos)
}

async fn expand_search_queries(
    settings: &HashMap<String, String>,
    query: &str,
) -> anyhow::Result<Vec<String>> {
    let client = match LlmClient::from_settings(settings) {
        Ok(client) => client,
        Err(_) => return Ok(vec![query.to_string()]),
    };

    let model = resolve_model(settings, &["multi_agent_literature_scout_model", "copilot_simple_model"]);
    let temperature = resolve_temperature(settings, "multi_agent_literature_scout_temperature", 0.4);

    let prompt = format!(
        "你是 GitHub 开源项目搜索专家。用户用自然语言描述需求，请你生成 3-5 个适合 GitHub Search API 的英文搜索查询。\n\n\
         规则：\n\
         1. 不要直接翻译用户输入，要理解其真实意图，生成更可能搜到优质开源项目的查询词。\n\
         2. 每个查询应聚焦不同角度（工具类型、实现技术、应用场景、热门替代方案等）。\n\
         3. 只输出英文查询词，避免使用 awesome list 这类列表仓库。\n\
         4. 返回纯 JSON 数组，不要任何解释。\n\n\
         用户输入：{query}\n\n\
         输出格式：[\"query1\", \"query2\", \"query3\"]"
    );

    let messages = vec![
        LlmMessage::system("你是 GitHub 开源项目搜索专家，输出必须严格遵守 JSON 数组格式。"),
        LlmMessage::user(prompt),
    ];

    let raw = client
        .chat(&messages, model.as_deref(), temperature)
        .await?;
    let clean = crate::commands::papers::extract_json_pub(&raw);
    let parsed: Vec<String> = match serde_json::from_str(&clean) {
        Ok(v) => v,
        Err(_) => return Ok(vec![query.to_string()]),
    };

    let mut queries: Vec<String> = parsed
        .into_iter()
        .map(|s| clean_whitespace(&s))
        .filter(|s| !s.is_empty())
        .take(5)
        .collect();

    // 始终保留原始查询作为兜底。
    let original = clean_whitespace(query);
    if !original.is_empty() && !queries.iter().any(|q| q.eq_ignore_ascii_case(&original)) {
        queries.push(original);
    }

    if queries.is_empty() {
        queries.push(query.to_string());
    }

    Ok(queries)
}

#[allow(dead_code)]
async fn fetch_github_repos(
    _settings: &HashMap<String, String>,
    _query: &str,
    _limit: usize,
) -> anyhow::Result<Vec<GithubRepo>> {
    // 历史签名保留，避免外部调用方改动；当前使用 fetch_github_repos_multi。
    Ok(Vec::new())
}

#[allow(dead_code)]
async fn fetch_repos_via_web_search(
    _settings: &HashMap<String, String>,
    _query: &str,
    _limit: usize,
) -> anyhow::Result<Vec<GithubRepo>> {
    // 历史签名保留；当前使用 fetch_repos_via_web_search_multi。
    Ok(Vec::new())
}

fn map_github_repo(repo: GithubApiRepo) -> GithubRepo {
    GithubRepo {
        full_name: repo.full_name,
        owner: repo.owner.login,
        name: repo.name,
        html_url: repo.html_url,
        description: repo.description.unwrap_or_default(),
        language: repo.language.unwrap_or_default(),
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        updated_at: repo.updated_at,
        license: repo.license.and_then(|l| l.spdx_id).unwrap_or_default(),
        topics: repo.topics,
    }
}

fn extract_github_full_name(url: &str) -> Option<String> {
    let trimmed = url
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_start_matches("github.com/");
    let parts: Vec<&str> = trimmed.split('/').collect();
    if parts.len() >= 2 {
        Some(format!("{}/{}", parts[0], parts[1]))
    } else {
        None
    }
}

async fn rerank_with_llm(
    settings: &HashMap<String, String>,
    query: &str,
    limit: usize,
    repos: &[GithubRepo],
) -> anyhow::Result<Option<(String, String, Vec<GithubRepo>)>> {
    let client = match LlmClient::from_settings(settings) {
        Ok(client) => client,
        Err(_) => return Ok(None),
    };

    let model = resolve_model(settings, &["multi_agent_literature_scout_model", "copilot_simple_model"]);
    let temperature = resolve_temperature(settings, "multi_agent_literature_scout_temperature", 0.2);

    let payload = repos
        .iter()
        .take(20)
        .map(|repo| {
            json!({
                "full_name": repo.full_name,
                "description": repo.description,
                "language": repo.language,
                "stars": repo.stargazers_count,
                "forks": repo.forks_count,
                "topics": repo.topics,
                "updated_at": repo.updated_at,
            })
        })
        .collect::<Vec<_>>();

    let prompt = format!(
        "你是小妍的开源项目检索助手。请基于候选 GitHub 项目，输出最终推荐结果。\n\n\
         用户研究主题：{query}\n\
         返回数量：{limit}\n\n\
         候选项目（JSON）：\n{payload}\n\n\
         只返回 JSON，不要额外解释，格式必须是：\n\
         {{\n\
           \"overall_summary\": \"...\",\n\
           \"ranking_note\": \"...\",\n\
           \"repos\": [\n\
             {{\n\
               \"full_name\": \"owner/repo\",\n\
               \"score\": 0-100 整数,\n\
               \"reason\": \"推荐理由\"\n\
             }}\n\
           ]\n\
         }}",
        payload = serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "[]".to_string())
    );

    let messages = vec![
        LlmMessage::system("你是开源项目检索助手，输出必须严格遵守 JSON 格式。"),
        LlmMessage::user(prompt),
    ];

    let raw = client
        .chat(&messages, model.as_deref(), temperature)
        .await?;
    let clean = crate::commands::papers::extract_json_pub(&raw);
    let parsed: LlmRankingResponse = match serde_json::from_str(&clean) {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };

    let by_name: HashMap<String, GithubRepo> = repos
        .iter()
        .map(|repo| (repo.full_name.clone(), repo.clone()))
        .collect();

    let mut selected = Vec::new();
    let mut seen = HashSet::new();
    for item in parsed.repos {
        if selected.len() >= limit {
            break;
        }
        let Some(repo) = by_name.get(&item.full_name) else {
            continue;
        };
        if !seen.insert(repo.full_name.clone()) {
            continue;
        }
        selected.push(GithubRepo {
            full_name: repo.full_name.clone(),
            owner: repo.owner.clone(),
            name: repo.name.clone(),
            html_url: repo.html_url.clone(),
            description: repo.description.clone(),
            language: repo.language.clone(),
            stargazers_count: repo.stargazers_count,
            forks_count: repo.forks_count,
            updated_at: repo.updated_at.clone(),
            license: repo.license.clone(),
            topics: repo.topics.clone(),
        });
    }

    if selected.is_empty() {
        return Ok(None);
    }

    Ok(Some((
        parsed
            .overall_summary
            .unwrap_or_else(|| "已根据项目相关度和活跃度完成推荐。".to_string()),
        parsed
            .ranking_note
            .unwrap_or_else(|| "由模型综合匹配度与维护活跃度排序。".to_string()),
        selected,
    )))
}

fn clean_whitespace(input: &str) -> String {
    input
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn format_github_error(error: &anyhow::Error) -> String {
    let msg = error.to_string();
    if msg.contains("速率限制") {
        return msg;
    }
    format!("检索失败：{}", msg)
}
