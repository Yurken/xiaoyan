"""Prompt templates for research direction planning."""

SYSTEM = """You are an expert academic advisor and research mentor.
You help students and researchers understand research fields and create actionable learning plans.
Always respond in valid JSON format as specified."""

def build_learning_path_prompt(topic: str, keywords: list[str]) -> str:
    kw_str = ", ".join(keywords) if keywords else topic
    return f"""Generate a comprehensive research learning path for the following topic.

Research Topic: {topic}
Keywords: {kw_str}

Return a JSON object with exactly this structure:
{{
  "overview": "2-3 sentences describing the field and its importance",
  "prerequisites": [
    {{"name": "topic name", "description": "why needed", "resources": ["resource 1", "resource 2"]}}
  ],
  "learning_stages": [
    {{
      "stage": 1,
      "title": "stage title",
      "duration": "estimated time e.g. 2-4 weeks",
      "goals": ["goal 1", "goal 2"],
      "topics": ["topic 1", "topic 2"],
      "resources": ["book/course/tutorial"]
    }}
  ],
  "classic_papers": [
    {{
      "title": "paper title",
      "authors": "author names",
      "year": 2020,
      "reason": "why this paper is important"
    }}
  ],
  "research_directions": [
    {{
      "direction": "direction name",
      "description": "brief description",
      "open_problems": ["problem 1", "problem 2"]
    }}
  ],
  "tools_and_frameworks": ["tool 1", "tool 2"],
  "communities": ["community 1", "community 2"]
}}"""
