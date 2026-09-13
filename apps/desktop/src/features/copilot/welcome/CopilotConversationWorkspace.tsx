import { useRef, type ReactNode } from "react";
import CopilotSuggestions from "./CopilotSuggestions";
import "./welcome.css";

export default function CopilotConversationWorkspace({ empty, draft, onSuggestion, chatArea, composer }: {
  empty: boolean;
  draft: string;
  onSuggestion: (value: string) => void;
  chatArea: ReactNode;
  composer: ReactNode;
}) {
  const composerRef = useRef<HTMLDivElement>(null);
  return (
    <div className={`copilot-conversation ${empty ? "is-empty" : ""}`}>
      {empty ? (
        <header className="copilot-welcome-heading">
          <p className="mb-3 text-sm font-medium text-ink-secondary">小妍，和你一起研究</p>
          <h1>今天想弄清什么？</h1>
        </header>
      ) : null}
      <div className="copilot-messages">{chatArea}</div>
      <div ref={composerRef} className="copilot-composer-slot">{composer}</div>
      {empty ? (
        <CopilotSuggestions draft={draft} onSelect={(value) => {
          onSuggestion(value);
          composerRef.current?.querySelector("textarea")?.focus();
        }} />
      ) : null}
    </div>
  );
}
