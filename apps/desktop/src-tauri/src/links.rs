pub fn doi_url(doi: Option<&str>) -> Option<String> {
    let raw = doi?.trim();
    if raw.is_empty() {
        return None;
    }

    let normalized = raw
        .trim_start_matches("https://doi.org/")
        .trim_start_matches("http://doi.org/")
        .trim_start_matches("doi:")
        .trim();

    if normalized.is_empty() {
        None
    } else {
        Some(format!("https://doi.org/{normalized}"))
    }
}

pub fn paper_search_url(title: Option<&str>) -> Option<String> {
    let value = title?.trim();
    if value.is_empty() {
        return None;
    }

    reqwest::Url::parse_with_params("https://www.semanticscholar.org/search", &[("q", value)])
        .ok()
        .map(|url| url.to_string())
}

pub fn paper_reference_url(
    title: Option<&str>,
    doi: Option<&str>,
    file_path: Option<&str>,
) -> Option<String> {
    let local_path = file_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    local_path
        .or_else(|| doi_url(doi))
        .or_else(|| paper_search_url(title))
}
