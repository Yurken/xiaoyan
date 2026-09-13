import { useState } from "react";
import { Pause, Play, RefreshCw } from "lucide-react";
import { Button } from "@research-copilot/ui";
import { useCopilotSuggestions } from "./useCopilotSuggestions";

export default function CopilotSuggestions({ draft, onSelect }: { draft: string; onSelect: (value: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const suggestions = useCopilotSuggestions(hovered || focused || draft.length > 0);
  return (
      <div className="copilot-suggestions"
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      >
        <span className="copilot-suggestion-label">试着问</span>
        <button type="button" className={`copilot-suggestion ${suggestions.fading ? "is-fading" : ""}`}
          onClick={() => { onSelect(suggestions.suggestion); }}>
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
  );
}
