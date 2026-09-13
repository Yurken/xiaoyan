import { describe, expect, it } from "vitest";
import { parseChatStreamSse } from "./parseChatStreamSse";

describe("parseChatStreamSse", () => {
  it("maps session, request, searching, delta, sources, error, and done chunks", () => {
    const text = [
      'data: {"session_id":"s1"}',
      'data: {"request_id":"r1"}',
      'data: {"searching":"papers"}',
      'data: {"query":"fallback"}',
      'data: {"delta":"hello\\\\nworld"}',
      'data: {"sources":[{"title":"t"}]}',
      'data: {"error":"boom"}',
      'data: {"done":true}',
      "",
    ].join("\n");

    expect(parseChatStreamSse(text)).toEqual([
      { type: "session_id", value: "s1" },
      { type: "request_id", value: "r1" },
      { type: "searching", query: "papers" },
      { type: "searching", query: "fallback" },
      { type: "delta", value: "hello\nworld" },
      { type: "sources", value: [{ title: "t" }] },
      { type: "error", value: "boom" },
      { type: "done" },
    ]);
  });

  it("maps plan and agent lifecycle fields", () => {
    const plan = [{ id: "1", title: "search" }];
    const run = { id: "a1", status: "running" };
    const text = [
      `data: ${JSON.stringify({ plan })}`,
      `data: ${JSON.stringify({ agent_start: run })}`,
      `data: ${JSON.stringify({ agent_complete: run })}`,
      `data: ${JSON.stringify({ agent_error: run })}`,
    ].join("\n");

    expect(parseChatStreamSse(text)).toEqual([
      { type: "plan", value: plan },
      { type: "agent_start", value: run },
      { type: "agent_complete", value: run },
      { type: "agent_error", value: run },
    ]);
  });

  it("maps tool results and routing decisions", () => {
    const toolResult = {
      tool_name: "search_papers",
      tool_id: "tool-1",
      result: "found 3 papers",
      result_id: "result-1",
    };
    const routingDecision = {
      policy: "balanced",
      selected: ["planner", "survey"],
      reasoning: "needs evidence",
      execution_waves: [["planner"], ["survey"]],
    };
    const text = [
      `data: ${JSON.stringify({ tool_result: toolResult })}`,
      `data: ${JSON.stringify({ routing_decision: routingDecision })}`,
    ].join("\n");

    expect(parseChatStreamSse(text)).toEqual([
      { type: "tool_result", ...toolResult },
      { type: "routing_decision", value: routingDecision },
    ]);
  });

  it("accepts data: without a space after the colon", () => {
    expect(parseChatStreamSse('data:{"delta":"x"}')).toEqual([{ type: "delta", value: "x" }]);
  });

  it("parses CRLF-delimited events", () => {
    const text = 'data: {"delta":"a"}\r\ndata: {"done":true}\r\n';
    expect(parseChatStreamSse(text)).toEqual([{ type: "delta", value: "a" }, { type: "done" }]);
  });

  it("parses a final data line without a trailing newline", () => {
    expect(parseChatStreamSse('data: {"delta":"tail"}')).toEqual([{ type: "delta", value: "tail" }]);
  });

  it("ignores blank lines, comment lines, and malformed JSON", () => {
    const text = [
      "",
      ": keep-alive",
      "data: not-json",
      "data: {",
      'data: {"delta":"ok"}',
      "event: message",
    ].join("\n");

    expect(parseChatStreamSse(text)).toEqual([{ type: "delta", value: "ok" }]);
  });
});
