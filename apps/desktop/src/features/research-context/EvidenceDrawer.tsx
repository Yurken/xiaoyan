import { useEffect, useState } from "react";
import { X, ExternalLink, Loader2 } from "lucide-react";
import { apiClient } from "../../lib/client";
import type { EvidenceLink } from "./shared";

interface EvidenceDrawerProps {
  targetId: string;
  targetType: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function EvidenceDrawer({
  targetId,
  targetType,
  isOpen,
  onClose,
}: EvidenceDrawerProps) {
  const [links, setLinks] = useState<EvidenceLink[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !targetId) return;

    let cancelled = false;
    setLoading(true);
    apiClient.evidence
      .getEvidenceLinks(targetId, targetType)
      .then((data) => {
        if (!cancelled) {
          setLinks(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLinks([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, targetId, targetType]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex w-96 flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/[0.08] px-4 py-3">
          <h2 className="text-base font-semibold text-ink-primary">证据链溯源</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-tertiary hover:bg-black/[0.04] hover:text-ink-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin text-ink-tertiary" />
            </div>
          ) : links.length === 0 ? (
            <div className="text-center text-sm text-ink-tertiary py-8">
              暂无可追溯证据
            </div>
          ) : (
            links.map((link) => (
              <div
                key={link.id}
                className="rounded-xl border border-black/[0.08] p-3 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex rounded bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-secondary">
                    {link.type}
                  </span>
                  <button className="text-apple-blue hover:underline text-[11px] flex items-center gap-1">
                    查看来源
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
                <h3 className="text-sm font-medium text-ink-primary line-clamp-2">
                  {link.title}
                </h3>
                <p className="mt-1.5 text-xs text-ink-secondary line-clamp-3">
                  {link.summary}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
