"""
Literature survey generation service.
"""
import json
from tenacity import retry, stop_after_attempt, wait_exponential
from app.services.llm import get_llm_provider
from app.services.llm.base import ChatMessage
from app.services.literature_search import search_papers
from app.prompts import survey as survey_prompts


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=15))
async def generate_survey(query: str, max_papers: int = 20) -> dict:
    """
    Search for papers and generate a structured literature survey.
    Returns the survey data along with the source papers.
    """
    # Step 1: retrieve papers
    papers = await search_papers(query, limit=max_papers)

    if not papers:
        # Fallback: generate survey from LLM knowledge alone
        papers = []

    # Step 2: generate survey with LLM
    llm = get_llm_provider()
    messages = [
        ChatMessage(role="system", content=survey_prompts.SYSTEM),
        ChatMessage(role="user", content=survey_prompts.build_survey_prompt(query, papers)),
    ]
    response = await llm.chat(messages, temperature=0.4, max_tokens=5000)
    survey = _parse_json_response(response.content)
    survey["papers"] = papers
    survey["query"] = query
    return survey


def _parse_json_response(content: str) -> dict:
    content = content.strip()
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(lines[1:-1])
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(content[start:end])
        return {"error": "Failed to parse survey", "raw": content}
