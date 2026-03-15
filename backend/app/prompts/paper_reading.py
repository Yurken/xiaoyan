"""Prompt templates for structured paper reading."""

SYSTEM = """You are an expert in academic paper analysis.
Extract structured information from research papers accurately.
Always respond in valid JSON format as specified."""

def build_paper_analysis_prompt(paper_text: str) -> str:
    # Truncate to avoid token limits
    truncated = paper_text[:12000] if len(paper_text) > 12000 else paper_text
    return f"""Analyze the following research paper and extract structured information.

Paper Content:
{truncated}

Return a JSON object:
{{
  "title": "paper title if found",
  "research_question": "the main research problem or question addressed",
  "core_method": "detailed description of the proposed method/approach",
  "experiment_design": "how experiments were conducted, datasets used, baselines",
  "innovations": [
    "innovation point 1",
    "innovation point 2"
  ],
  "limitations": [
    "limitation 1",
    "limitation 2"
  ],
  "key_conclusions": "main findings and contributions",
  "related_work_summary": "brief summary of how this relates to prior work",
  "technical_terms": [
    {{"term": "term name", "definition": "brief definition"}}
  ]
}}"""
