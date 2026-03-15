"""
Paper analysis and reproduction guide generation services.
"""
import json
from tenacity import retry, stop_after_attempt, wait_exponential
from app.services.llm import get_llm_provider
from app.services.llm.base import ChatMessage
from app.prompts import paper_reading as reading_prompts
from app.prompts import reproduction as repro_prompts


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=15))
async def analyze_paper(paper_text: str) -> dict:
    """Generate structured analysis of a research paper."""
    llm = get_llm_provider()
    messages = [
        ChatMessage(role="system", content=reading_prompts.SYSTEM),
        ChatMessage(role="user", content=reading_prompts.build_paper_analysis_prompt(paper_text)),
    ]
    response = await llm.chat(messages, temperature=0.3, max_tokens=4000)
    return _parse_json_response(response.content)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=15))
async def generate_reproduction_guide(paper_text: str, analysis: dict | None = None) -> dict:
    """Generate a detailed reproduction guide for a paper."""
    llm = get_llm_provider()
    messages = [
        ChatMessage(role="system", content=repro_prompts.SYSTEM),
        ChatMessage(role="user", content=repro_prompts.build_reproduction_prompt(paper_text, analysis)),
    ]
    response = await llm.chat(messages, temperature=0.3, max_tokens=5000)
    return _parse_json_response(response.content)


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
        return {"error": "Failed to parse analysis", "raw": content[:500]}
