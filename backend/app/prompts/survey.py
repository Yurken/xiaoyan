"""Prompt templates for literature survey generation."""

SYSTEM = """You are an expert researcher capable of synthesizing academic literature.
Generate structured, insightful literature surveys based on provided paper metadata.
Always respond in valid JSON format as specified."""

def build_survey_prompt(query: str, papers: list[dict]) -> str:
    papers_text = "\n\n".join([
        f"[{i+1}] Title: {p.get('title','')}\n"
        f"    Authors: {p.get('authors','')}\n"
        f"    Year: {p.get('year','')}\n"
        f"    Abstract: {p.get('abstract','')[:400]}..."
        for i, p in enumerate(papers[:20])
    ])
    return f"""Generate a structured literature survey for the research query below.
Use the provided papers as references. Cite papers by their [number].

Query: {query}

Papers:
{papers_text}

Return a JSON object:
{{
  "background": "research background and motivation (cite relevant papers)",
  "representative_methods": [
    {{
      "category": "method category",
      "description": "description of this line of work",
      "key_papers": [1, 3, 5],
      "strengths": "what they do well",
      "weaknesses": "limitations"
    }}
  ],
  "research_trends": [
    {{"trend": "trend name", "description": "description", "evidence": "which papers show this"}}
  ],
  "existing_gaps": [
    "gap or limitation 1",
    "gap or limitation 2"
  ],
  "future_directions": [
    {{"direction": "direction name", "rationale": "why promising"}}
  ],
  "key_takeaways": "2-3 sentences summarizing the field state"
}}"""
