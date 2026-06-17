import { useId } from "react";
import { ChevronDown, Cpu, TerminalSquare } from "lucide-react";
import type { CodeToolStatus } from "../../lib/client";
import { CODE_TOOLS } from "./shared";

interface CodeToolSwitcherProps {
  tools: CodeToolStatus[];
  toolsLoaded: boolean;
  activeTool: string | null;
  onSelectTool: (id: string) => void;
  activeModel: string;
  onModelChange: (model: string) => void;
}

/** 在同一工作目录下切换代码工具与模型的工具条。 */
export default function CodeToolSwitcher({
  tools,
  toolsLoaded,
  activeTool,
  onSelectTool,
  activeModel,
  onModelChange,
}: CodeToolSwitcherProps) {
  const listId = useId();
  const activeDef = CODE_TOOLS.find((t) => t.id === activeTool);
  const anyInstalled = tools.some((t) => t.installed);

  if (toolsLoaded && !anyInstalled) {
    return (
      <div className="code-tool-switcher code-tool-switcher--empty">
        未检测到本机代码工具（claude / codex / gemini / opencode / kimi）。
      </div>
    );
  }

  return (
    <div className="code-tool-switcher">
      <label className="code-tool-switcher__field">
        <TerminalSquare size={13} className="code-tool-switcher__icon" />
        <div className="code-tool-switcher__select-wrap">
          <select
            className="code-tool-switcher__select"
            value={activeTool ?? ""}
            onChange={(e) => onSelectTool(e.target.value)}
            disabled={!toolsLoaded}
          >
            {CODE_TOOLS.map((def) => {
              const status = tools.find((t) => t.id === def.id);
              const installed = status?.installed ?? false;
              return (
                <option key={def.id} value={def.id} disabled={!installed}>
                  {def.label}
                  {installed ? "" : " · 未安装"}
                </option>
              );
            })}
          </select>
          <ChevronDown size={12} className="code-tool-switcher__chevron" />
        </div>
      </label>

      <label className="code-tool-switcher__field code-tool-switcher__field--model">
        <Cpu size={13} className="code-tool-switcher__icon" />
        <input
          className="code-tool-switcher__model"
          list={listId}
          value={activeModel}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder={activeDef?.modelHint ?? "留空用默认模型"}
          spellCheck={false}
          autoComplete="off"
        />
        <datalist id={listId}>
          {(activeDef?.models ?? []).map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>
    </div>
  );
}
