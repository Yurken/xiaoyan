import { useState } from "react";
import { Card } from "@research-copilot/ui";
import {
  MessageSquare,
  FileText,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Github,
} from "lucide-react";
import { SectionIcon } from "./shared";
import { apiClient } from "../../lib/client";
import { openLink, GITHUB_URL } from "../../lib/links";

interface PastedImage {
  id: string;
  dataUrl: string;
}

interface LogAttachment {
  name: string;
  /** 字符数，用于展示体积估算 */
  size: number;
  content: string;
}

// 递增序号，给粘贴的图片生成稳定 key。
let imageSeq = 0;

// 与服务端约束保持一致：最多 3 张截图。
const MAX_IMAGES = 3;

/**
 * 用户反馈区（升级页底部）。
 *
 * 支持粘贴文字与图片、填写联系方式、一键附带应用当前运行日志，
 * 通过后端 feedback_submit 命令上报到官网反馈服务（POST /api/settings/feedback）。
 */
export default function FeedbackSection() {
  const [text, setText] = useState("");
  const [contact, setContact] = useState("");
  const [images, setImages] = useState<PastedImage[]>([]);
  const [log, setLog] = useState<LogAttachment | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    const files = Array.from(items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file != null);
    if (files.length === 0) return;
    if (images.length + files.length > MAX_IMAGES) {
      setNotice({ ok: false, text: `最多上传 ${MAX_IMAGES} 张截图。` });
      return;
    }
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          const dataUrl = reader.result;
          setImages((prev) => [...prev, { id: `img-${imageSeq++}`, dataUrl }]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((item) => item.id !== id));
  };

  const attachCurrentLog = async () => {
    setNotice(null);
    setLoadingLog(true);
    try {
      const { name, content } = await apiClient.settings.readDiagnosticLog();
      setLog({ name, size: content.length, content });
    } catch (error) {
      setNotice({
        ok: false,
        text: `读取当前日志失败：${error instanceof Error ? error.message : "未知错误"}`,
      });
    } finally {
      setLoadingLog(false);
    }
  };

  const formatSize = (chars: number) => {
    if (chars < 1024) return `${chars} 字符`;
    if (chars < 1024 * 1024) return `${(chars / 1024).toFixed(1)} KB`;
    return `${(chars / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canSubmit = text.trim().length > 0 || images.length > 0 || log != null;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      await apiClient.settings.feedback.submit({
        text: text.trim(),
        contact: contact.trim(),
        images: images.map((item) => item.dataUrl),
        log: log ? { name: log.name, content: log.content } : null,
      });
      setText("");
      setContact("");
      setImages([]);
      setLog(null);
      setNotice({ ok: true, text: "反馈已提交，感谢你的反馈！" });
    } catch (error) {
      setNotice({
        ok: false,
        text: error instanceof Error ? error.message : "提交失败，请稍后再试",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    background: "var(--rc-control-bg)",
    borderColor: "var(--rc-control-border)",
    boxShadow: "var(--rc-control-shadow)",
  } as const;

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center gap-3">
        <SectionIcon icon={MessageSquare} color="#AF52DE" />
        <div className="flex-1">
          <h2 className="text-base font-semibold text-ink-primary">意见反馈</h2>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            遇到问题或有建议都可以告诉我们，可直接粘贴截图、附带运行日志。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void openLink(`${GITHUB_URL}/issues`)}
          className="flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95"
          style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
        >
          <Github className="h-4 w-4" />
          GitHub Issues
        </button>
      </div>

      <div
        className="grid gap-3 rounded-2xl p-4"
        style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste}
          rows={4}
          placeholder="描述你遇到的问题或建议；可直接 Ctrl/⌘+V 粘贴截图。"
          className="w-full resize-y rounded-2xl border px-4 py-2.5 text-sm outline-none text-[var(--rc-text)] placeholder:text-[var(--rc-text-muted)]"
          style={inputStyle}
        />

        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="联系方式（可选）：邮箱 / 微信 / Telegram，方便我们回访"
          className="w-full rounded-2xl border px-4 py-2.5 text-sm outline-none text-[var(--rc-text)] placeholder:text-[var(--rc-text-muted)]"
          style={inputStyle}
        />

        {/* 已粘贴的图片缩略图 */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((image) => (
              <div
                key={image.id}
                className="relative h-20 w-20 overflow-hidden rounded-xl border"
                style={{ borderColor: "var(--rc-control-border)" }}
              >
                <img src={image.dataUrl} alt="反馈截图" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(image.id)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
                  title="移除"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 已附带的当前日志 */}
        {log && (
          <span
            className="flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-ink-secondary"
            style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
          >
            <FileText className="h-3.5 w-3.5 text-ink-tertiary" />
            {log.name} · {formatSize(log.size)}
            <button
              type="button"
              onClick={() => setLog(null)}
              className="ml-0.5 text-ink-tertiary transition-colors hover:text-apple-red"
              title="移除日志"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}

        <p className="ml-1 text-xs text-ink-quaternary">
          点击后会自动读取应用当前运行日志（最近一段，<span className="font-mono">logs/xiaoyan-desktop.log</span>），仅用于排查问题。
        </p>

        {/* 操作行：左下附带日志，右下提交 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void attachCurrentLog()}
            disabled={loadingLog}
            className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
          >
            {loadingLog ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {loadingLog ? "读取中…" : log ? "重新读取当前日志" : "附带当前运行日志"}
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || submitting}
            className="ml-auto flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={{ background: "var(--rc-button-primary-bg)", boxShadow: "var(--rc-button-primary-shadow)" }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? "提交中…" : "提交反馈"}
          </button>
        </div>

        {notice && (
          <div
            className={`flex items-start gap-1.5 rounded-xl px-4 py-2.5 text-xs ${notice.ok ? "bg-apple-green/10 text-apple-green" : "bg-apple-red/10 text-apple-red"
              }`}
          >
            {notice.ok ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
