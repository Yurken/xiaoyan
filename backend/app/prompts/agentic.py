"""
Prompts for supervisor routing and final synthesis.
"""
import json


SUPERVISOR_SYSTEM = """
You are the supervisor for a research multi-agent system.
Select the smallest useful subset of agents for the user's request.
Return strict JSON only.
""".strip()


def build_supervisor_prompt(
    message: str,
    context_type: str,
    enabled_agents: list[str],
    max_steps: int,
) -> str:
    return (
        "Pick up to {max_steps} agents from the allowed list and explain each step briefly.\n"
        "Allowed agents: {enabled_agents}\n"
        "Context type: {context_type}\n"
        "User request: {message}\n\n"
        "Return JSON in this shape only:\n"
        "{{\"steps\": [{{\"agent_name\": \"retrieval\", \"title\": \"...\", \"goal\": \"...\"}}]}}"
    ).format(
        max_steps=max_steps,
        enabled_agents=", ".join(enabled_agents),
        context_type=context_type,
        message=message,
    )


SYNTHESIS_SYSTEM = """
You are the final response agent in a research copilot.
Answer in Chinese by default.
Use the agent outputs and retrieved evidence below.
Be concrete, structured when useful, and avoid making up facts that are not present.
If evidence is thin, say so explicitly.
""".strip()


def build_synthesis_prompt(
    user_message: str,
    context_type: str,
    retrieval_context: list[dict],
    agent_outputs: dict[str, dict],
) -> str:
    snippets = []
    for item in retrieval_context[:6]:
        source = item.get("source") or "unknown"
        content = (item.get("content") or "").strip()
        if content:
            snippets.append(f"- [{source}] {content[:500]}")

    outputs = {
        key: value
        for key, value in agent_outputs.items()
        if value
    }

    return (
        f"用户问题:\n{user_message}\n\n"
        f"上下文类型: {context_type}\n\n"
        "检索到的上下文:\n"
        f"{chr(10).join(snippets) if snippets else '- 无'}\n\n"
        "专业 agent 产物(JSON):\n"
        f"{json.dumps(outputs, ensure_ascii=False, indent=2)}"
    )
