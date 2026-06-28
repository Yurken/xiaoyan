import { useCallback, useEffect, useState } from "react";
import { Coins, RefreshCw } from "lucide-react";
import { Card } from "@research-copilot/ui";
import { settingsApi, type TokenUsageBucket, type TokenUsageStats } from "../../lib/client";
import { SectionIcon } from "./shared";

const EMPTY_BUCKET: TokenUsageBucket = { input: 0, output: 0, total: 0, chars: 0, requests: 0 };

function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 2 : 1)}M`;
  return `${(n / 1_000_000_000).toFixed(2)}B`;
}

function UsageColumn({ label, bucket }: { label: string; bucket: TokenUsageBucket }) {
  return (
    <div
      className="flex-1 rounded-2xl px-3 py-3"
      style={{
        background: "var(--rc-chip-inset-bg)",
        boxShadow: "var(--rc-chip-inset-shadow)",
      }}
    >
      <div className="text-xs text-ink-tertiary">{label}</div>
      <div
        className="mt-1 text-xl font-semibold text-ink-primary tabular-nums"
        title={`${bucket.total.toLocaleString()} tokens`}
      >
        {formatCompact(bucket.total)}
      </div>
      <div className="mt-0.5 text-[11px] text-ink-tertiary tabular-nums" title={`${bucket.chars.toLocaleString()} 字符`}>
        约 {formatCompact(bucket.chars)} 字符
      </div>
      <div className="mt-2 space-y-0.5 text-[11px] text-ink-tertiary tabular-nums">
        <div className="flex justify-between">
          <span>输入</span>
          <span title={bucket.input.toLocaleString()}>{formatCompact(bucket.input)}</span>
        </div>
        <div className="flex justify-between">
          <span>输出</span>
          <span title={bucket.output.toLocaleString()}>{formatCompact(bucket.output)}</span>
        </div>
        <div className="flex justify-between">
          <span>请求</span>
          <span title={bucket.requests.toLocaleString()}>{bucket.requests.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export default function TokenUsageSection() {
  const [stats, setStats] = useState<TokenUsageStats | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await settingsApi.tokenUsage());
    } catch (err) {
      console.debug("load token usage failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center gap-3">
        <SectionIcon icon={Coins} color="#FF9500" />
        <div className="flex-1">
          <h2 className="text-base font-semibold text-ink-primary">Token 用量</h2>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            统计小妍及所有 LLM 调用的 token 消耗，优先采用接口返回用量，缺失时本地估算。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ink-secondary transition hover:bg-ink-tertiary/10 disabled:opacity-50"
          title="刷新"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          刷新
        </button>
      </div>

      <div className="flex gap-3">
        <UsageColumn label="今日" bucket={stats?.today ?? EMPTY_BUCKET} />
        <UsageColumn label="本月" bucket={stats?.month ?? EMPTY_BUCKET} />
        <UsageColumn label="累计" bucket={stats?.total ?? EMPTY_BUCKET} />
      </div>
    </Card>
  );
}
