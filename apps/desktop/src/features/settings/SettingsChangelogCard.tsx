import { useMemo, useState } from "react";
import changelogRaw from "../../../../../CHANGELOG.md?raw";
import { RefreshCw } from "lucide-react";
import { Card, Select } from "@research-copilot/ui";
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
  const [selectedVersion, setSelectedVersion] = useState<string>(versions[0]?.version ?? "");

  const versionOptions = useMemo(
    () => versions.map(({ version }) => ({
      value: version,
      label: version === "未发布" ? "开发中" : `v${version}`,
    })),
    [versions],
  );

  const selectedEntry = versions.find(({ version }) => version === selectedVersion) ?? versions[0] ?? null;

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <SectionIcon icon={RefreshCw} color="#34C759" />
          <div>
            <h2 className="text-base font-semibold text-ink-primary">更新日志</h2>
            <p className="text-xs text-ink-tertiary mt-0.5">各版本功能变更记录</p>
          </div>
        </div>

        {versionOptions.length > 0 ? (
          <Select
            className="w-full sm:w-[220px]"
            value={selectedEntry?.version ?? ""}
            onChange={setSelectedVersion}
            options={versionOptions}
            prefix="版本："
            aria-label="选择更新日志版本"
          />
        ) : null}
      </div>

      {selectedEntry ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-nm-dark/10 bg-white/30 px-4 pb-4 pt-3 space-y-3">
            {selectedEntry.sections.length === 0 ? (
              <p className="text-xs leading-5 text-ink-tertiary">当前版本暂无可展示的更新项。</p>
            ) : (
              selectedEntry.sections.map(({ label, items }) => (
                <div key={label}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-tertiary">{label}</p>
                  {items.length > 0 ? (
                    <ul className="space-y-1">
                      {items.map((item, index) => (
                        <li key={index} className="flex gap-2 text-xs leading-5 text-ink-secondary">
                          <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-ink-tertiary/50" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs leading-5 text-ink-tertiary">暂无条目</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-nm-dark/10 bg-white/30 px-4 py-3">
          <p className="text-xs leading-5 text-ink-tertiary">未读取到更新日志内容。</p>
        </div>
      )}
    </Card>
  );
}
