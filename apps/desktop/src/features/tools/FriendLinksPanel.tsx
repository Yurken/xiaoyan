import { ChevronDown, Globe2 } from "lucide-react";
import { Badge, Card } from "@research-copilot/ui";
import ExternalLink from "../../components/ExternalLink";
import { friendLinkInitial, friendLinkSectionId } from "./shared";
import { YANWEB_FRIEND_LINK_SECTIONS, YANWEB_FRIEND_LINK_TOTAL } from "../../lib/yanweb-links";

const raisedShadow = "var(--rc-raised-shadow)";

interface FriendLinksPanelProps {
  openSections: Record<string, boolean>;
  allExpanded: boolean;
  onToggleAll: () => void;
  onRevealSection: (title: string, index: number) => void;
  onToggleSection: (title: string) => void;
}

export function FriendLinksPanel({
  openSections,
  allExpanded,
  onToggleAll,
  onRevealSection,
  onToggleSection,
}: FriendLinksPanelProps) {
  return (
    <Card padding="md" className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
          <Globe2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-semibold text-ink-primary">科研友链</p>
          <p className="text-xs text-ink-tertiary">{`共 ${YANWEB_FRIEND_LINK_TOTAL} 条 · ${YANWEB_FRIEND_LINK_SECTIONS.length} 个分类`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleAll}
            className="inline-flex items-center rounded-full bg-white/45 px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-white/70 hover:text-apple-blue"
          >
            {allExpanded ? "收起全部" : "展开全部"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {YANWEB_FRIEND_LINK_SECTIONS.map((section, index) => (
          <button
            type="button"
            key={section.title}
            onClick={() => onRevealSection(section.title, index)}
            className="inline-flex items-center gap-2 rounded-full bg-white/45 px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-white/70 hover:text-apple-blue"
            aria-expanded={openSections[section.title] ?? false}
            aria-controls={friendLinkSectionId(index)}
          >
            <span>{section.title}</span>
            <span className="text-ink-tertiary">{section.items.length}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {YANWEB_FRIEND_LINK_SECTIONS.map((section, index) => (
          <section
            key={section.title}
            id={friendLinkSectionId(index)}
            className="scroll-mt-6 overflow-hidden rounded-3xl border border-white/55 bg-white/25"
            style={{ boxShadow: "var(--rc-inset-shadow)" }}
          >
            <button
              type="button"
              onClick={() => onToggleSection(section.title)}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/20"
              aria-expanded={openSections[section.title] ?? false}
              aria-controls={`${friendLinkSectionId(index)}-panel`}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink-primary">{section.title}</p>
                <Badge variant="default">{`${section.items.length} 条`}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-tertiary">
                <span>{openSections[section.title] ? "收起" : "展开"}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    openSections[section.title] ? "rotate-180 text-apple-blue" : ""
                  }`}
                />
              </div>
            </button>

            {openSections[section.title] ? (
              <div id={`${friendLinkSectionId(index)}-panel`} className="border-t border-white/55 px-1 pb-1 pt-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {section.items.map((item) => (
                    <ExternalLink
                      key={`${section.title}-${item.name}-${item.href}`}
                      href={item.href}
                      title={`${item.name} · ${item.href}`}
                      className="group flex items-center gap-3 rounded-2xl bg-white/45 px-3 py-3 transition hover:bg-white/70"
                    >
                      <div
                        className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl text-sm font-semibold text-ink-secondary transition-transform duration-150 group-hover:-translate-y-0.5"
                        style={{ background: "var(--rc-elevated)", boxShadow: raisedShadow }}
                      >
                        <span
                          className="absolute inset-0 flex items-center justify-center transition-opacity duration-150"
                          style={{ opacity: item.icon ? 0 : 1 }}
                        >
                          {friendLinkInitial(item.name)}
                        </span>
                        <img
                          src={item.icon}
                          alt=""
                          draggable={false}
                          loading="lazy"
                          decoding="async"
                          className="relative h-full w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.opacity = "0";
                            const fallback = event.currentTarget.parentElement?.querySelector("span");
                            if (fallback instanceof HTMLElement) {
                              fallback.style.opacity = "1";
                            }
                          }}
                        />
                      </div>
                      <span className="min-w-0 text-sm leading-5 text-ink-primary group-hover:text-apple-blue group-hover:underline">
                        {item.name}
                      </span>
                    </ExternalLink>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </Card>
  );
}
