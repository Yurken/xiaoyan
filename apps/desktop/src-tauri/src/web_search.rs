use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct DuckDuckGoResponse {
    #[serde(default)]
    AbstractText: String,
    #[serde(default)]
    AbstractSource: String,
    #[serde(default)]
    AbstractURL: String,
    #[serde(default)]
    Heading: String,
    #[serde(default)]
    Answer: String,
    #[serde(default)]
    RelatedTopics: Vec<DuckDuckGoTopic>,
    #[serde(default)]
    Results: Vec<DuckDuckGoResult>,
}

#[derive(Debug, Deserialize)]
struct DuckDuckGoTopic {
    #[serde(default)]
    Text: String,
    #[serde(default)]
    FirstURL: String,
}

#[derive(Debug, Deserialize)]
struct DuckDuckGoResult {
    #[serde(default)]
    Text: String,
    #[serde(default)]
    FirstURL: String,
}

pub async fn web_search(query: &str) -> Result<String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .user_agent("xiaoyan-desktop/0.3.3")
        .build()?;

    let resp = client
        .get("https://api.duckduckgo.com/")
        .query(&[
            ("q", query),
            ("format", "json"),
            ("no_html", "1"),
            ("skip_disambig", "1"),
        ])
        .send()
        .await?;

    if !resp.status().is_success() {
        return Ok(format!(
            "搜索请求失败（HTTP {}），请稍后重试。",
            resp.status().as_u16()
        ));
    }

    let data: DuckDuckGoResponse = resp.json().await?;
    let mut parts: Vec<String> = Vec::new();

    if !data.Heading.is_empty() {
        parts.push(format!("主题: {}", data.Heading));
    }
    if !data.AbstractText.is_empty() {
        let mut summary = data.AbstractText.clone();
        if !data.AbstractSource.is_empty() {
            summary.push_str(&format!(" (来源: {})", data.AbstractSource));
        }
        if !data.AbstractURL.is_empty() {
            summary.push_str(&format!(" ({})", data.AbstractURL));
        }
        parts.push(summary);
    }
    if !data.Answer.is_empty() {
        parts.push(format!("即时回答: {}", data.Answer));
    }
    for topic in &data.RelatedTopics {
        if !topic.Text.is_empty() {
            parts.push(format!("- {} ({})", topic.Text, topic.FirstURL));
        }
    }
    for result in &data.Results {
        if !result.Text.is_empty() {
            parts.push(format!("- {} ({})", result.Text, result.FirstURL));
        }
    }

    if parts.is_empty() {
        Ok(format!("未找到与「{}」相关的搜索结果。", query))
    } else {
        Ok(parts.join("\n\n"))
    }
}
