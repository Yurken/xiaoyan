import { useMemo, useState } from "react";
import changelogRaw from "../../../../../CHANGELOG.md?raw";
import { RefreshCw } from "lucide-react";
import { Card } from "@research-copilot/ui";
import { SectionIcon } from "./shared";

function parseChangelog(raw: string) {
  const versions: { version: string; sections: { label: string; items: string[] }[] }[] = [];
  let current: (typeof versions)[number] | null = null;
  let currentSection: { label: string; items: string[] } | null = null;

  for (const line of raw.split("\n")) {
    const versionMatch = line.match(/^## \[(.+?)\]/);
    if (versionMatch) {
      if (currentSection && current) current.sections.push(currentSection);
      if (current) versions.push(current);
      current = { version: versionMatch[1], sections: [] };
      currentSection = null;
      continue;
    }
    const sectionMatch = line.match(/^### (.+)/);
    if (sectionMatch && current) {
      if (currentSection) current.sections.push(currentSection);
      currentSection = { label: sectionMatch[1], items: [] };
      continue;
    }
    const itemMatch = line.match(/^- (.+)/);
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1]);
    }
  }
  if (currentSection && current) current.sections.push(currentSection);
  if (current) versions.push(current);
  return versions;
}

function normalizeVersionTag(version?: string) {
  return (version ?? "").trim().replace(/^v/i, "");
}

export function getChangelogReleaseDate(version?: string) {
  const target = normalizeVersionTag(version);
  if (!target) {
    return "";
  }

  for (const line of changelogRaw.split("\n")) {
    const match = line.match(/^## \[(.+?)\](?: - (\d{4}-\d{2}-\d{2}))?/);
    if (!match) {
      continue;
    }

    const changelogVersion = normalizeVersionTag(match[1]);
    if (changelogVersion === target) {
      return match[2] ?? "";
    }
  }

  return "";
}

export function formatUpdateDate(value?: string) {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettingsChangelogCard() {
  const versions = useMemo(() => parseChangelog(changelogRaw), []);
  const [expanded, setExpanded] = useState<string | null>(versions[0]?.version ?? null);

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex items-center gap-3">
        <SectionIcon icon={RefreshCw} color="#34C759" />
        <div>
          <h2 className="text-base font-semibold text-ink-primary">更新日志</h2>
          <p className="text-xs text-ink-tertiary mt-0.5">各版本功能变更记录</p>
        </div>
      </div>
      <div className="space-y-2">
        {versions.map(({ version, sections }) => {
          const isOpen = expanded === version;
          return (
            <div key={version} className="overflow-hidden rounded-2xl border border-nm-dark/10 bg-white/30">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : version)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/20"
              >
                <span className="text-sm font-semibold text-ink-primary">
                  {version === "未发布" ? "开发中" : `v${version}`}
                </span>
                <svg
                  className="h-3.5 w-3.5 flex-shrink-0 text-ink-tertiary transition-transform duration-150"
                  style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                  viewBox="0 0 12 12" fill="none"
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {isOpen ? (
                <div className="border-t border-nm-dark/10 px-4 pb-4 pt-3 space-y-3">
                  {sections.map(({ label, items }) => (
                    <div key={label}>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-tertiary">{label}</p>
                      <ul className="space-y-1">
                        {items.map((item, index) => (
                          <li key={index} className="flex gap-2 text-xs leading-5 text-ink-secondary">
                            <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-ink-tertiary/50" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
