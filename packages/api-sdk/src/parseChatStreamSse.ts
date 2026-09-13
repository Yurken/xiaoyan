import type { ChatStreamChunk } from "@research-copilot/types";

function mapJsonToChunks(json: {
  session_id?: string;
  request_id?: string;
  plan?: ChatStreamChunk extends { type: "plan"; value: infer V } ? V : never;
  agent_start?: unknown;
  agent_complete?: unknown;
  agent_error?: unknown;
  tool_result?: {
    tool_name?: unknown;
    tool_id?: unknown;
    result?: unknown;
    result_id?: unknown;
  };
  routing_decision?: ChatStreamChunk extends { type: "routing_decision"; value: infer V } ? V : never;
  searching?: unknown;
  query?: unknown;
  delta?: unknown;
  sources?: unknown;
  error?: unknown;
  done?: unknown;
}): ChatStreamChunk[] {
  const chunks: ChatStreamChunk[] = [];
  if (json.session_id) chunks.push({ type: "session_id", value: json.session_id });
  if (json.request_id) chunks.push({ type: "request_id", value: json.request_id });
  if (json.plan) chunks.push({ type: "plan", value: json.plan });
  if (json.agent_start) chunks.push({ type: "agent_start", value: json.agent_start as never });
  if (json.agent_complete) chunks.push({ type: "agent_complete", value: json.agent_complete as never });
  if (json.agent_error) chunks.push({ type: "agent_error", value: json.agent_error as never });
  if (json.tool_result) {
    chunks.push({
      type: "tool_result",
      tool_name: String(json.tool_result.tool_name ?? ""),
      tool_id: String(json.tool_result.tool_id ?? ""),
      result: String(json.tool_result.result ?? ""),
      ...(json.tool_result.result_id === undefined
        ? {}
        : { result_id: String(json.tool_result.result_id) }),
    });
  }
  if (json.routing_decision) {
    chunks.push({ type: "routing_decision", value: json.routing_decision });
  }
  if (json.searching || json.query) {
    chunks.push({ type: "searching", query: String(json.searching ?? json.query) });
  }
  if (json.delta) chunks.push({ type: "delta", value: String(json.delta).replace(/\\n/g, "\n") });
  if (json.sources) chunks.push({ type: "sources", value: json.sources as never });
  if (json.error) chunks.push({ type: "error", value: json.error as string });
  if (json.done) chunks.push({ type: "done" });
  return chunks;
}

/** Parse SSE `data:` lines into chat stream chunks. Ignores blanks, comments, and malformed JSON. */
export function parseChatStreamSse(text: string): ChatStreamChunk[] {
  const chunks: ChatStreamChunk[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.startsWith("data: ") ? line.slice(6) : line.slice(5);
    if (!payload) continue;
    try {
      chunks.push(...mapJsonToChunks(JSON.parse(payload)));
    } catch {
      // ignore malformed JSON
    }
  }
  return chunks;
}
