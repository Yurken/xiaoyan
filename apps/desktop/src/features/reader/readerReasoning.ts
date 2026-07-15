/**
 * 从模型流中拆出推理标签与可展示正文。
 *
 * 未闭合的 `<think>` 在流式输出期间同样视为推理，防止思考内容短暂闪现在正文中。
 */
export function splitReasoning(raw: string): { thought: string; answer: string } {
  const thoughts: string[] = [];
  const closed = /<think>([\s\S]*?)<\/think>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = closed.exec(raw)) !== null) {
    const text = (match[1] || "").trim();
    if (text) thoughts.push(text);
  }

  let rest = raw.replace(closed, "");
  const openIdx = rest.search(/<think>/i);
  if (openIdx !== -1) {
    const tail = rest.slice(openIdx).replace(/<think>/i, "").trim();
    if (tail) thoughts.push(tail);
    rest = rest.slice(0, openIdx);
  }

  return { thought: thoughts.join("\n\n"), answer: rest.trim() };
}
