import { useId, useState } from "react";
import type { ChatMessage } from "@research-copilot/types";
import { ChevronDown, Link2 } from "lucide-react";
import ExternalLink from "../../components/ExternalLink";

export interface CopilotSourceLinksProps {
  sources?: ChatMessage["sources"];
}

export function CopilotSourceLinks({ sources }: CopilotSourceLinksProps) {
  const [expanded, setExpanded] = useState(false);
  const sourceListId = useId();

  if (!sources?.length) return null;

  return (
    <section className="mt-2" aria-label="回答来源">
      <button
        type="button"
        aria-controls={sourceListId}
        aria-expanded={expanded}
        aria-label={`${expanded ? "收起" : "展开"} ${sources.length} 个回答来源`}
        onClick={() => setExpanded((current) => !current)}
        className="group inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink-tertiary transition-colors hover:bg-black/[0.035] hover:text-ink-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/35"
      >
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{sources.length} 个来源</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <ul id={sourceListId} className="mt-1.5 flex flex-wrap gap-2">
          {sources.map((source, index) => (
            <li key={`${source.source}-${index}`} className="min-w-0">
              <ExternalLink
                href={source.url}
                title={source.content}
                className="inline-flex max-w-full rounded-full px-2.5 py-1 text-[11px] text-ink-tertiary transition-colors hover:text-apple-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/35"
                style={{
                  background: "var(--rc-chip-inset-bg)",
                  boxShadow: "var(--rc-chip-inset-shadow)",
                }}
              >
                <span className="truncate">{source.source || `来源 ${index + 1}`}</span>
              </ExternalLink>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
