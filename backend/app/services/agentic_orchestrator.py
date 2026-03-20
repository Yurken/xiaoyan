"""
Supervisor-led multi-agent orchestration for chat.
"""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from collections.abc import Awaitable, Callable, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.prompts import agentic as agentic_prompts
from app.repositories.agent_repo import AgentRepository
from app.repositories.paper_repo import PaperRepository
from app.services.llm import get_llm_provider
from app.services.llm.base import ChatMessage
from app.services.paper_analyzer import analyze_paper, generate_reproduction_guide
from app.services.planner_service import generate_learning_path
from app.services.rag_service import combined_search, search_paper_chunks
from app.services.survey_service import search_survey_papers, synthesize_survey_from_papers

EventEmitter = Callable[[dict], Awaitable[None]]

DEFAULT_STEP_META: dict[str, tuple[str, str]] = {
    "retrieval": ("检索相关上下文", "从知识库和论文内容中收集与当前问题直接相关的证据"),
    "planner": ("生成研究路径", "围绕用户主题给出系统化学习和研究推进路径"),
    "literature_scout": ("筛选候选论文", "快速检索和整理该问题对应的核心论文与线索"),
    "survey": ("组织文献综述", "把检索到的论文整理成结构化领域概览"),
    "paper_analyst": ("解析当前论文", "提炼研究问题、方法、实验与局限"),
    "reproduction": ("输出复现建议", "围绕当前论文给出复现链路和风险提示"),
    "synthesis": ("整合最终回答", "汇总各 agent 结果并组织为用户可直接使用的答复"),
}


@dataclass
class OrchestrationResult:
    request_id: str
    answer: str
    sources: list[dict]
    plan: list[dict]
    runs: list[dict]


def _extract_json_object(content: str) -> dict:
    content = content.strip()
    if content.startswith("```"):
        lines = content.splitlines()
        content = "\n".join(lines[1:-1])
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(content[start:end])
        raise


def _enabled_agents() -> list[str]:
    return [
        item.strip()
        for item in settings.multi_agent_enabled_agents.split(",")
        if item.strip()
    ]


def _serialize_run(run) -> dict:
    return {
        "id": str(run.id),
        "session_id": str(run.session_id),
        "request_id": str(run.request_id),
        "parent_run_id": str(run.parent_run_id) if run.parent_run_id else None,
        "agent_name": run.agent_name,
        "step_name": run.step_name,
        "status": run.status,
        "order_index": run.order_index,
        "summary": run.summary,
        "error": run.error,
        "input_payload": run.input_payload,
        "output_payload": run.output_payload,
        "created_at": run.created_at.isoformat(),
        "updated_at": run.updated_at.isoformat() if run.updated_at else run.created_at.isoformat(),
        "artifacts": [
            {
                "id": str(artifact.id),
                "run_id": str(artifact.run_id),
                "artifact_type": artifact.artifact_type,
                "title": artifact.title,
                "content": artifact.content,
                "created_at": artifact.created_at.isoformat(),
            }
            for artifact in run.artifacts
        ],
    }


def _extract_keywords(message: str) -> list[str]:
    separators = [",", "，", "、", "\n"]
    normalized = message
    for sep in separators:
        normalized = normalized.replace(sep, "|")
    keywords = [item.strip() for item in normalized.split("|") if item.strip()]
    return keywords[:6]


def _rule_based_agents(message: str, context_type: str, enabled: list[str]) -> list[str]:
    names: list[str] = []

    def add(name: str):
        if name in enabled and name not in names:
            names.append(name)

    if "retrieval" in enabled:
        add("retrieval")

    planning_keywords = ("研究方向", "规划", "学习路径", "roadmap", "入门", "方向")
    survey_keywords = ("综述", "survey", "文献", "论文推荐", "最新研究", "领域现状", "调研")
    reproduction_keywords = ("复现", "reproduce", "训练", "实验配置", "实现", "跑起来", "复现实验")
    paper_keywords = ("论文", "创新点", "方法", "实验", "局限", "精读")

    if any(keyword in message for keyword in planning_keywords):
        add("planner")

    if any(keyword in message for keyword in survey_keywords):
        add("literature_scout")
        add("survey")

    if context_type == "paper" or any(keyword in message for keyword in paper_keywords):
        add("paper_analyst")

    if context_type == "paper" and any(keyword in message for keyword in reproduction_keywords):
        add("reproduction")

    if not names and "retrieval" in enabled:
        add("retrieval")

    if "synthesis" in enabled:
        names.append("synthesis")

    max_steps = max(settings.multi_agent_max_steps, 1)
    specialist = [name for name in names if name != "synthesis"][:max_steps]
    return specialist + (["synthesis"] if "synthesis" in names else [])


class AgenticOrchestrator:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.agent_repo = AgentRepository(db)
        self.paper_repo = PaperRepository(db)

    async def run(
        self,
        session_id: uuid.UUID,
        message: str,
        context_type: str = "general",
        context_id: str | None = None,
        history: Sequence[tuple[str, str]] | None = None,
        emit: EventEmitter | None = None,
        stream_final: bool = False,
    ) -> OrchestrationResult:
        request_id = uuid.uuid4()
        plan = await self._build_plan(message, context_type, context_id)
        retrieval_context: list[dict] = []
        sources: list[dict] = []
        outputs: dict[str, dict] = {}
        runs: list[dict] = []

        if emit:
            await emit({"type": "request_id", "value": str(request_id)})
            await emit({"type": "plan", "value": plan})

        specialist_steps = [step for step in plan if step["agent_name"] != "synthesis"]
        synthesis_step = next((step for step in plan if step["agent_name"] == "synthesis"), None)

        for index, step in enumerate(specialist_steps):
            run = await self.agent_repo.create_run(
                session_id=session_id,
                request_id=request_id,
                agent_name=step["agent_name"],
                step_name=step["title"],
                order_index=index,
                status="running",
                input_payload={"message": message, "goal": step["goal"], "context_type": context_type},
            )
            await self.db.commit()
            run = await self.agent_repo.get_run(run.id)
            payload = _serialize_run(run)
            runs.append(payload)
            if emit:
                await emit({"type": "agent_start", "value": payload})

            try:
                result = await self._execute_step(
                    agent_name=step["agent_name"],
                    message=message,
                    context_type=context_type,
                    context_id=context_id,
                    outputs=outputs,
                )
                if result["sources"]:
                    sources.extend(result["sources"])
                if step["agent_name"] == "retrieval":
                    retrieval_context = result["sources"]

                outputs[step["agent_name"]] = result["output"]
                run = await self.agent_repo.update_run(
                    run.id,
                    status="done",
                    summary=result["summary"],
                    output_payload=result["output"],
                )
                for artifact in result["artifacts"]:
                    await self.agent_repo.add_artifact(
                        run.id,
                        artifact_type=artifact["artifact_type"],
                        title=artifact["title"],
                        content=artifact["content"],
                    )
                await self.db.commit()
                run = await self.agent_repo.get_run(run.id)
                payload = _serialize_run(run)
                runs = [payload if item["id"] == payload["id"] else item for item in runs]
                if emit:
                    await emit({"type": "agent_complete", "value": payload})
            except Exception as exc:
                run = await self.agent_repo.update_run(
                    run.id,
                    status="failed",
                    error=str(exc),
                    summary=f"{step['title']}失败",
                )
                await self.db.commit()
                run = await self.agent_repo.get_run(run.id)
                payload = _serialize_run(run)
                runs = [payload if item["id"] == payload["id"] else item for item in runs]
                if emit:
                    await emit({"type": "agent_error", "value": payload})

        answer = ""
        synthesis_order = len(specialist_steps)
        synthesis_title = synthesis_step["title"] if synthesis_step else DEFAULT_STEP_META["synthesis"][0]
        synthesis_goal = synthesis_step["goal"] if synthesis_step else DEFAULT_STEP_META["synthesis"][1]
        synthesis_run = await self.agent_repo.create_run(
            session_id=session_id,
            request_id=request_id,
            agent_name="synthesis",
            step_name=synthesis_title,
            order_index=synthesis_order,
            status="running",
            input_payload={"message": message, "goal": synthesis_goal, "context_type": context_type},
        )
        await self.db.commit()
        synthesis_run = await self.agent_repo.get_run(synthesis_run.id)
        synthesis_payload = _serialize_run(synthesis_run)
        runs.append(synthesis_payload)
        if emit:
            await emit({"type": "agent_start", "value": synthesis_payload})

        llm = get_llm_provider()
        synthesis_messages = self._build_synthesis_messages(
            message=message,
            context_type=context_type,
            retrieval_context=retrieval_context,
            outputs=outputs,
            history=history or [],
        )
        synthesis_model = settings.multi_agent_synthesis_model or None

        try:
            if stream_final and emit:
                async for delta in llm.stream_chat(
                    synthesis_messages,
                    temperature=settings.multi_agent_synthesis_temperature,
                    max_tokens=3000,
                    model=synthesis_model,
                ):
                    answer += delta
                    await emit({"type": "delta", "value": delta})
            else:
                response = await llm.chat(
                    synthesis_messages,
                    temperature=settings.multi_agent_synthesis_temperature,
                    max_tokens=3000,
                    model=synthesis_model,
                )
                answer = response.content

            synthesis_run = await self.agent_repo.update_run(
                synthesis_run.id,
                status="done",
                summary=(answer[:220] + "...") if len(answer) > 220 else answer,
                output_payload={"answer": answer},
            )
            await self.db.commit()
            synthesis_run = await self.agent_repo.get_run(synthesis_run.id)
            synthesis_payload = _serialize_run(synthesis_run)
            runs = [synthesis_payload if item["id"] == synthesis_payload["id"] else item for item in runs]
            if emit:
                await emit({"type": "agent_complete", "value": synthesis_payload})
        except Exception as exc:
            synthesis_run = await self.agent_repo.update_run(
                synthesis_run.id,
                status="failed",
                error=str(exc),
                summary="整合回答失败",
            )
            await self.db.commit()
            synthesis_run = await self.agent_repo.get_run(synthesis_run.id)
            synthesis_payload = _serialize_run(synthesis_run)
            runs = [synthesis_payload if item["id"] == synthesis_payload["id"] else item for item in runs]
            if emit:
                await emit({"type": "agent_error", "value": synthesis_payload})
            raise

        deduped_sources = []
        seen = set()
        for item in sources:
            key = (item.get("source"), item.get("content"))
            if key in seen:
                continue
            seen.add(key)
            deduped_sources.append({"source": item.get("source", ""), "content": item.get("content", "")})

        return OrchestrationResult(
            request_id=str(request_id),
            answer=answer,
            sources=deduped_sources[:6],
            plan=plan,
            runs=runs,
        )

    async def _build_plan(self, message: str, context_type: str, context_id: str | None) -> list[dict]:
        enabled = _enabled_agents()
        filtered_enabled = [
            agent_name
            for agent_name in enabled
            if self._can_run_agent(agent_name, context_type, context_id)
        ]
        if "synthesis" not in filtered_enabled:
            filtered_enabled.append("synthesis")

        fallback_names = _rule_based_agents(message, context_type, filtered_enabled)
        if not settings.multi_agent_enabled:
            return [self._build_step(name) for name in fallback_names]

        if settings.multi_agent_routing_mode == "rule":
            return [self._build_step(name) for name in fallback_names]

        llm_steps = await self._build_llm_plan(message, context_type, context_id, filtered_enabled)
        if llm_steps:
            if settings.multi_agent_routing_mode == "hybrid":
                llm_names = [step["agent_name"] for step in llm_steps]
                for name in fallback_names:
                    if name not in llm_names and name == "retrieval":
                        llm_steps.insert(0, self._build_step(name))
                if "synthesis" not in llm_names:
                    llm_steps.append(self._build_step("synthesis"))
            return llm_steps

        return [self._build_step(name) for name in fallback_names]

    async def _build_llm_plan(
        self,
        message: str,
        context_type: str,
        context_id: str | None,
        enabled_agents: list[str],
    ) -> list[dict]:
        llm = get_llm_provider()
        model = settings.multi_agent_supervisor_model or None
        prompt = agentic_prompts.build_supervisor_prompt(
            message=message,
            context_type=context_type,
            enabled_agents=[name for name in enabled_agents if name != "synthesis"],
            max_steps=max(settings.multi_agent_max_steps, 1),
        )
        try:
            response = await llm.chat(
                [
                    ChatMessage(role="system", content=agentic_prompts.SUPERVISOR_SYSTEM),
                    ChatMessage(role="user", content=prompt),
                ],
                temperature=settings.multi_agent_supervisor_temperature,
                max_tokens=800,
                model=model,
            )
            data = _extract_json_object(response.content)
            steps = []
            for raw_step in data.get("steps", []):
                agent_name = str(raw_step.get("agent_name", "")).strip()
                if not agent_name or agent_name not in enabled_agents or agent_name == "synthesis":
                    continue
                if not self._can_run_agent(agent_name, context_type, context_id):
                    continue
                title = str(raw_step.get("title") or DEFAULT_STEP_META.get(agent_name, ("执行步骤", ""))[0]).strip()
                goal = str(raw_step.get("goal") or DEFAULT_STEP_META.get(agent_name, ("", "整理相关信息"))[1]).strip()
                steps.append({"agent_name": agent_name, "title": title, "goal": goal})
            steps = steps[: max(settings.multi_agent_max_steps, 1)]
            steps.append(self._build_step("synthesis"))
            return steps
        except Exception:
            return []

    def _can_run_agent(self, agent_name: str, context_type: str, context_id: str | None) -> bool:
        if agent_name in {"paper_analyst", "reproduction"}:
            return context_type == "paper" and bool(context_id)
        return True

    def _build_step(self, agent_name: str) -> dict:
        title, goal = DEFAULT_STEP_META.get(agent_name, ("执行步骤", "处理当前任务"))
        return {"agent_name": agent_name, "title": title, "goal": goal}

    async def _execute_step(
        self,
        agent_name: str,
        message: str,
        context_type: str,
        context_id: str | None,
        outputs: dict[str, dict],
    ) -> dict:
        if agent_name == "retrieval":
            return await self._run_retrieval(message, context_type, context_id)
        if agent_name == "planner":
            return await self._run_planner(message)
        if agent_name == "literature_scout":
            return await self._run_literature_scout(message)
        if agent_name == "survey":
            return await self._run_survey(message, outputs)
        if agent_name == "paper_analyst":
            return await self._run_paper_analyst(context_id)
        if agent_name == "reproduction":
            return await self._run_reproduction(context_id, outputs.get("paper_analyst"))
        raise ValueError(f"Unsupported agent: {agent_name}")

    async def _run_retrieval(self, message: str, context_type: str, context_id: str | None) -> dict:
        if context_type == "paper" and context_id:
            chunks = await search_paper_chunks(
                self.db,
                message,
                paper_id=context_id,
                top_k=settings.multi_agent_search_limit,
            )
        else:
            chunks = await combined_search(
                self.db,
                message,
                top_k=settings.multi_agent_search_limit,
            )
        summary = "未检索到强相关上下文" if not chunks else f"检索到 {len(chunks)} 条相关上下文"
        artifact_lines = [
            f"{idx + 1}. {item.get('source', 'unknown')}: {(item.get('content') or '')[:220]}"
            for idx, item in enumerate(chunks[:6])
        ]
        output = {
            "matches": [
                {
                    "source": item.get("source", ""),
                    "content": (item.get("content") or "")[:500],
                    "distance": item.get("distance"),
                }
                for item in chunks[:8]
            ]
        }
        return {
            "summary": summary,
            "output": output,
            "sources": [{"source": item.get("source", ""), "content": item.get("content", "")} for item in chunks[:6]],
            "artifacts": [{
                "artifact_type": "retrieval_snapshot",
                "title": "检索结果",
                "content": "\n".join(artifact_lines) if artifact_lines else "未检索到相关上下文",
            }],
        }

    async def _run_planner(self, message: str) -> dict:
        data = await generate_learning_path(
            message,
            _extract_keywords(message),
            model=settings.multi_agent_worker_model or None,
            temperature=settings.multi_agent_worker_temperature,
        )
        summary = data.get("overview") or "已生成研究路径"
        return {
            "summary": summary,
            "output": data,
            "sources": [],
            "artifacts": [{
                "artifact_type": "learning_path",
                "title": "研究路径",
                "content": json.dumps(data, ensure_ascii=False, indent=2),
            }],
        }

    async def _run_literature_scout(self, message: str) -> dict:
        papers = await search_survey_papers(message, limit=settings.multi_agent_search_limit)
        lines = [
            f"- {paper.get('title', 'Untitled')} ({paper.get('year') or 'n.d.'})"
            for paper in papers[:8]
        ]
        return {
            "summary": f"筛出 {len(papers)} 篇候选论文" if papers else "没有检索到候选论文",
            "output": {"papers": papers},
            "sources": [{"source": paper.get("title", ""), "content": paper.get("abstract", "")} for paper in papers[:6]],
            "artifacts": [{
                "artifact_type": "paper_list",
                "title": "候选论文",
                "content": "\n".join(lines) if lines else "没有找到候选论文",
            }],
        }

    async def _run_survey(self, message: str, outputs: dict[str, dict]) -> dict:
        papers = outputs.get("literature_scout", {}).get("papers") or []
        if not papers:
            papers = await search_survey_papers(message, limit=settings.multi_agent_search_limit)
        survey = await synthesize_survey_from_papers(
            message,
            papers,
            model=settings.multi_agent_worker_model or None,
            temperature=settings.multi_agent_worker_temperature,
        )
        summary = survey.get("overview") or survey.get("summary") or "已整理领域综述"
        return {
            "summary": summary,
            "output": survey,
            "sources": [{"source": paper.get("title", ""), "content": paper.get("abstract", "")} for paper in papers[:6]],
            "artifacts": [{
                "artifact_type": "survey_outline",
                "title": "文献综述",
                "content": json.dumps(survey, ensure_ascii=False, indent=2),
            }],
        }

    async def _run_paper_analyst(self, context_id: str | None) -> dict:
        paper_text = await self._get_paper_text(context_id)
        analysis = await analyze_paper(
            paper_text,
            model=settings.multi_agent_worker_model or None,
            temperature=settings.multi_agent_worker_temperature,
        )
        summary = analysis.get("core_method") or analysis.get("research_question") or "已完成论文解析"
        return {
            "summary": summary,
            "output": analysis,
            "sources": [],
            "artifacts": [{
                "artifact_type": "paper_analysis",
                "title": "论文解析",
                "content": json.dumps(analysis, ensure_ascii=False, indent=2),
            }],
        }

    async def _run_reproduction(self, context_id: str | None, analysis: dict | None) -> dict:
        paper_text = await self._get_paper_text(context_id)
        guide = await generate_reproduction_guide(
            paper_text,
            analysis=analysis,
            model=settings.multi_agent_worker_model or None,
            temperature=settings.multi_agent_worker_temperature,
        )
        summary = guide.get("environment_setup") or guide.get("training_process") or "已生成复现建议"
        return {
            "summary": summary,
            "output": guide,
            "sources": [],
            "artifacts": [{
                "artifact_type": "reproduction_guide",
                "title": "复现建议",
                "content": json.dumps(guide, ensure_ascii=False, indent=2),
            }],
        }

    async def _get_paper_text(self, context_id: str | None) -> str:
        if not context_id:
            raise ValueError("Paper context is required for this step")
        paper = await self.paper_repo.get(uuid.UUID(context_id))
        if not paper or not paper.full_text:
            raise ValueError("Paper full text not found")
        return paper.full_text

    def _build_synthesis_messages(
        self,
        message: str,
        context_type: str,
        retrieval_context: list[dict],
        outputs: dict[str, dict],
        history: Sequence[tuple[str, str]],
    ) -> list[ChatMessage]:
        messages = [ChatMessage(role="system", content=agentic_prompts.SYNTHESIS_SYSTEM)]
        for role, content in list(history)[-6:]:
            messages.append(ChatMessage(role=role, content=content))
        messages.append(
            ChatMessage(
                role="user",
                content=agentic_prompts.build_synthesis_prompt(
                    user_message=message,
                    context_type=context_type,
                    retrieval_context=retrieval_context,
                    agent_outputs=outputs,
                ),
            )
        )
        return messages
