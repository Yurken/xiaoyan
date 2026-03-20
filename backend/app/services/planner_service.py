"""
Research direction planning service.
"""
import json
from tenacity import retry, stop_after_attempt, wait_exponential
from app.services.llm import get_llm_provider
from app.services.llm.base import ChatMessage
from app.prompts import planner as planner_prompts


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=15))
async def generate_learning_path(
    topic: str,
    keywords: list[str],
    model: str | None = None,
    temperature: float = 0.5,
) -> dict:
    """Generate a structured learning path for a research topic."""
    llm = get_llm_provider()
    messages = [
        ChatMessage(role="system", content=planner_prompts.SYSTEM),
        ChatMessage(role="user", content=planner_prompts.build_learning_path_prompt(topic, keywords)),
    ]
    response = await llm.chat(messages, temperature=temperature, max_tokens=4000, model=model)
    return _parse_json_response(response.content)


def _parse_json_response(content: str) -> dict:
    """Extract JSON from LLM response, handling markdown code blocks."""
    content = content.strip()
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(lines[1:-1])
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Try to find JSON within the response
        start = content.find("{")
        end = content.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(content[start:end])
        raise ValueError(f"Could not parse JSON from LLM response: {content[:200]}")
