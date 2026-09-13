import { useRef, useState } from "react";
import { ArrowUp, Pause, Play, RefreshCw } from "lucide-react";
import { Button, Card } from "@research-copilot/ui";
import { useNavigate } from "react-router-dom";
import { useHomeSuggestions } from "./useHomeSuggestions";

export default function HomeComposer() {
  const [draft, setDraft] = useState("");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const suggestions = useHomeSuggestions(hovered || focused || draft.length > 0);
  const submit = () => {
    if (!draft.trim()) return;
    navigate("/chat", { state: { homePrompt: draft.trim() } });
  };

  return (
    <section aria-labelledby="home-question-title" className="home-start">
      <header className="home-heading">
        <p className="mb-3 text-sm font-medium text-ink-secondary">小妍，和你一起研究</p>
        <h1 id="home-question-title">今天想弄清什么？</h1>
      </header>
      <Card padding="none" className="home-composer">
        <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <label htmlFor="home-prompt" className="sr-only">发给小妍的问题</label>
          <textarea
            ref={input} id="home-prompt" value={draft} rows={3}
            placeholder="说说你的问题，或贴一段想一起读的内容…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.preventDefault(); submit();
              }
            }}
          />
          <div className="home-composer-footer">
            <span className="text-xs text-ink-tertiary">Enter 发送 · Shift + Enter 换行</span>
            <Button type="submit" aria-label="发送给小妍" disabled={!draft.trim()} className="home-send">
              <ArrowUp className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </form>
      </Card>
      <div className="home-suggestions"
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      >
        <span className="home-suggestion-label">试着问</span>
        <button type="button" className={`home-suggestion ${suggestions.fading ? "is-fading" : ""}`}
          onClick={() => { setDraft(suggestions.suggestion); input.current?.focus(); }}>
          {suggestions.suggestion}
        </button>
        <div className="flex shrink-0 items-center">
          <Button variant="ghost" size="sm" aria-label="换一个建议" onClick={suggestions.next}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="sm" aria-label={suggestions.paused ? "继续轮换建议" : "暂停轮换建议"}
            onClick={() => suggestions.setPaused(!suggestions.paused)}>
            {suggestions.paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </section>
  );
}
