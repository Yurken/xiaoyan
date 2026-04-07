use anyhow::Result;
use petgraph::algo::astar;
use petgraph::stable_graph::{NodeIndex, StableDiGraph};
use petgraph::visit::{EdgeRef, IntoEdgeReferences};
use serde::Serialize;
use sqlx::{Row, SqlitePool};
use std::collections::{HashMap, HashSet, VecDeque};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CitationGraphNode {
    pub paper_id: String,
    pub title: String,
    pub year: Option<i64>,
    pub venue: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CitationEdge {
    pub citing_paper_id: String,
    pub cited_paper_id: String,
    pub citing_title: String,
    pub cited_title: String,
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CitationCentralityEntry {
    pub paper_id: String,
    pub title: String,
    pub year: Option<i64>,
    pub venue: Option<String>,
    pub in_degree: usize,
    pub out_degree: usize,
    pub citation_count: usize,
    pub degree_centrality: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CitationPathResult {
    pub nodes: Vec<CitationGraphNode>,
    pub edges: Vec<CitationEdge>,
    pub length: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CitationSubgraph {
    pub nodes: Vec<CitationGraphNode>,
    pub edges: Vec<CitationEdge>,
}

#[derive(Debug, Clone)]
struct CitationRow {
    citing_paper_id: String,
    cited_paper_id: String,
    citing_title: String,
    cited_title: String,
    citing_year: Option<i64>,
    cited_year: Option<i64>,
    citing_venue: Option<String>,
    cited_venue: Option<String>,
    context: Option<String>,
}

#[derive(Debug, Default)]
pub struct CitationGraph {
    graph: StableDiGraph<CitationGraphNode, CitationEdge>,
    indices: HashMap<String, NodeIndex>,
}

impl CitationGraph {
    pub async fn load(db: &SqlitePool) -> Result<Self> {
        let rows = sqlx::query(
            "SELECT c.citing_paper_id, c.cited_paper_id, c.context,
                    p1.title AS citing_title, p1.year AS citing_year, p1.venue AS citing_venue,
                    p2.title AS cited_title, p2.year AS cited_year, p2.venue AS cited_venue
             FROM knowledge_paper_citations c
             JOIN papers p1 ON p1.id = c.citing_paper_id
             JOIN papers p2 ON p2.id = c.cited_paper_id",
        )
        .fetch_all(db)
        .await?;

        let records = rows
            .into_iter()
            .map(|row| CitationRow {
                citing_paper_id: row.get("citing_paper_id"),
                cited_paper_id: row.get("cited_paper_id"),
                citing_title: row.get("citing_title"),
                cited_title: row.get("cited_title"),
                citing_year: row.get("citing_year"),
                cited_year: row.get("cited_year"),
                citing_venue: row.get("citing_venue"),
                cited_venue: row.get("cited_venue"),
                context: row.get("context"),
            })
            .collect::<Vec<_>>();

        Ok(Self::from_rows(records))
    }

    fn from_rows(rows: Vec<CitationRow>) -> Self {
        let mut graph = StableDiGraph::<CitationGraphNode, CitationEdge>::default();
        let mut indices = HashMap::new();

        for row in rows {
            let citing_index = ensure_node(
                &mut graph,
                &mut indices,
                row.citing_paper_id.clone(),
                row.citing_title.clone(),
                row.citing_year,
                row.citing_venue.clone(),
            );
            let cited_index = ensure_node(
                &mut graph,
                &mut indices,
                row.cited_paper_id.clone(),
                row.cited_title.clone(),
                row.cited_year,
                row.cited_venue.clone(),
            );

            if graph.find_edge(citing_index, cited_index).is_none() {
                graph.add_edge(
                    citing_index,
                    cited_index,
                    CitationEdge {
                        citing_paper_id: row.citing_paper_id,
                        cited_paper_id: row.cited_paper_id,
                        citing_title: row.citing_title,
                        cited_title: row.cited_title,
                        context: row.context,
                    },
                );
            }
        }

        Self { graph, indices }
    }

    pub fn centrality(&self, limit: usize) -> Vec<CitationCentralityEntry> {
        let node_count = self.graph.node_count();
        let denominator = node_count.saturating_sub(1).saturating_mul(2);
        let mut entries = self
            .graph
            .node_indices()
            .map(|index| {
                let node = &self.graph[index];
                let in_degree = self.graph.neighbors_directed(index, petgraph::Direction::Incoming).count();
                let out_degree = self.graph.neighbors_directed(index, petgraph::Direction::Outgoing).count();
                let degree_centrality = if denominator == 0 {
                    0.0
                } else {
                    (in_degree + out_degree) as f32 / denominator as f32
                };

                CitationCentralityEntry {
                    paper_id: node.paper_id.clone(),
                    title: node.title.clone(),
                    year: node.year,
                    venue: node.venue.clone(),
                    in_degree,
                    out_degree,
                    citation_count: in_degree,
                    degree_centrality,
                }
            })
            .collect::<Vec<_>>();

        entries.sort_by(|left, right| {
            right
                .degree_centrality
                .partial_cmp(&left.degree_centrality)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| right.citation_count.cmp(&left.citation_count))
                .then_with(|| right.out_degree.cmp(&left.out_degree))
                .then_with(|| left.title.cmp(&right.title))
        });
        entries.truncate(limit);
        entries
    }

    pub fn shortest_path(
        &self,
        from_paper_id: &str,
        to_paper_id: &str,
    ) -> Option<CitationPathResult> {
        let start = *self.indices.get(from_paper_id)?;
        let goal = *self.indices.get(to_paper_id)?;
        let (_, path) = astar(&self.graph, start, |node| node == goal, |_| 1usize, |_| 0usize)?;

        let nodes = path
            .iter()
            .map(|index| self.graph[*index].clone())
            .collect::<Vec<_>>();
        let edges = path
            .windows(2)
            .filter_map(|window| self.graph.find_edge(window[0], window[1]))
            .map(|edge_index| self.graph[edge_index].clone())
            .collect::<Vec<_>>();

        Some(CitationPathResult {
            length: edges.len(),
            nodes,
            edges,
        })
    }

    pub fn export_subgraph(
        &self,
        seed_paper_ids: &HashSet<String>,
        radius: usize,
        max_nodes: usize,
    ) -> CitationSubgraph {
        if seed_paper_ids.is_empty() || max_nodes == 0 {
            return CitationSubgraph {
                nodes: Vec::new(),
                edges: Vec::new(),
            };
        }

        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();

        for paper_id in seed_paper_ids {
            if let Some(index) = self.indices.get(paper_id) {
                if visited.insert(*index) {
                    queue.push_back((*index, 0usize));
                }
            }
        }

        while let Some((current, depth)) = queue.pop_front() {
            if depth >= radius || visited.len() >= max_nodes {
                continue;
            }

            let neighbors = self
                .graph
                .neighbors_directed(current, petgraph::Direction::Outgoing)
                .chain(self.graph.neighbors_directed(current, petgraph::Direction::Incoming))
                .collect::<Vec<_>>();

            for neighbor in neighbors {
                if visited.len() >= max_nodes && !visited.contains(&neighbor) {
                    break;
                }
                if visited.insert(neighbor) {
                    queue.push_back((neighbor, depth + 1));
                }
            }
        }

        let mut nodes = visited
            .iter()
            .map(|index| self.graph[*index].clone())
            .collect::<Vec<_>>();
        nodes.sort_by(|left, right| {
            right
                .year
                .unwrap_or_default()
                .cmp(&left.year.unwrap_or_default())
                .then_with(|| left.title.cmp(&right.title))
        });

        let mut edges = self
            .graph
            .edge_references()
            .filter(|edge| visited.contains(&edge.source()) && visited.contains(&edge.target()))
            .map(|edge| edge.weight().clone())
            .collect::<Vec<_>>();
        edges.sort_by(|left, right| {
            left.citing_title
                .cmp(&right.citing_title)
                .then_with(|| left.cited_title.cmp(&right.cited_title))
        });

        CitationSubgraph { nodes, edges }
    }

    pub fn local_neighborhood(
        &self,
        seed_paper_ids: &HashSet<String>,
        max_edges: usize,
    ) -> Vec<CitationEdge> {
        if max_edges == 0 {
            return Vec::new();
        }

        let mut edges = self
            .export_subgraph(seed_paper_ids, 1, max_edges.saturating_add(seed_paper_ids.len()))
            .edges;
        edges.truncate(max_edges);
        edges
    }
}

fn ensure_node(
    graph: &mut StableDiGraph<CitationGraphNode, CitationEdge>,
    indices: &mut HashMap<String, NodeIndex>,
    paper_id: String,
    title: String,
    year: Option<i64>,
    venue: Option<String>,
) -> NodeIndex {
    if let Some(index) = indices.get(&paper_id) {
        return *index;
    }

    let index = graph.add_node(CitationGraphNode {
        paper_id: paper_id.clone(),
        title,
        year,
        venue,
    });
    indices.insert(paper_id, index);
    index
}

#[cfg(test)]
mod tests {
    use super::{CitationGraph, CitationRow};
    use std::collections::HashSet;

    fn sample_graph() -> CitationGraph {
        CitationGraph::from_rows(vec![
            CitationRow {
                citing_paper_id: "paper-a".into(),
                cited_paper_id: "paper-b".into(),
                citing_title: "Paper A".into(),
                cited_title: "Paper B".into(),
                citing_year: Some(2024),
                cited_year: Some(2023),
                citing_venue: Some("ICML".into()),
                cited_venue: Some("NeurIPS".into()),
                context: Some("extends baseline".into()),
            },
            CitationRow {
                citing_paper_id: "paper-b".into(),
                cited_paper_id: "paper-c".into(),
                citing_title: "Paper B".into(),
                cited_title: "Paper C".into(),
                citing_year: Some(2023),
                cited_year: Some(2022),
                citing_venue: Some("NeurIPS".into()),
                cited_venue: Some("ACL".into()),
                context: Some("builds on dataset".into()),
            },
            CitationRow {
                citing_paper_id: "paper-d".into(),
                cited_paper_id: "paper-b".into(),
                citing_title: "Paper D".into(),
                cited_title: "Paper B".into(),
                citing_year: Some(2025),
                cited_year: Some(2023),
                citing_venue: Some("ICLR".into()),
                cited_venue: Some("NeurIPS".into()),
                context: None,
            },
        ])
    }

    #[test]
    fn centrality_ranks_hub_paper_first() {
        let ranked = sample_graph().centrality(3);
        assert_eq!(ranked.first().map(|item| item.paper_id.as_str()), Some("paper-b"));
        assert_eq!(ranked.first().map(|item| item.in_degree), Some(2));
    }

    #[test]
    fn shortest_path_follows_directed_citations() {
        let path = sample_graph()
            .shortest_path("paper-a", "paper-c")
            .expect("path should exist");
        assert_eq!(path.length, 2);
        assert_eq!(path.nodes.len(), 3);
        assert_eq!(path.nodes[1].paper_id, "paper-b");
    }

    #[test]
    fn export_subgraph_collects_bidirectional_neighbors() {
        let graph = sample_graph();
        let seeds = HashSet::from(["paper-b".to_string()]);
        let subgraph = graph.export_subgraph(&seeds, 1, 10);
        assert_eq!(subgraph.nodes.len(), 4);
        assert_eq!(subgraph.edges.len(), 3);
    }
}
