use crate::citation_graph::{
    CitationCentralityEntry, CitationGraph, CitationPathResult, CitationSubgraph,
};
use crate::state::AppState;
use std::collections::HashSet;
use tauri::State;

#[tauri::command]
pub async fn knowledge_graph_citation_centrality(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<CitationCentralityEntry>, String> {
    let graph = CitationGraph::load(&state.db)
        .await
        .map_err(|error| error.to_string())?;
    Ok(graph.centrality(limit.unwrap_or(12).max(1)))
}

#[tauri::command]
pub async fn knowledge_graph_citation_shortest_path(
    state: State<'_, AppState>,
    from_paper_id: String,
    to_paper_id: String,
) -> Result<Option<CitationPathResult>, String> {
    let graph = CitationGraph::load(&state.db)
        .await
        .map_err(|error| error.to_string())?;
    Ok(graph.shortest_path(&from_paper_id, &to_paper_id))
}

#[tauri::command]
pub async fn knowledge_graph_citation_subgraph(
    state: State<'_, AppState>,
    seed_paper_ids: Vec<String>,
    radius: Option<usize>,
    max_nodes: Option<usize>,
) -> Result<CitationSubgraph, String> {
    let graph = CitationGraph::load(&state.db)
        .await
        .map_err(|error| error.to_string())?;
    let normalized_seeds = seed_paper_ids
        .into_iter()
        .map(|paper_id| paper_id.trim().to_string())
        .filter(|paper_id| !paper_id.is_empty())
        .collect::<HashSet<_>>();

    Ok(graph.export_subgraph(
        &normalized_seeds,
        radius.unwrap_or(1).min(4),
        max_nodes.unwrap_or(16).max(1),
    ))
}
