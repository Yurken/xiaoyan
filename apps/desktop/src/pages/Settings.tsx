import { useState } from "react";
import { Card } from "@research-copilot/ui";
import { CheckCircle, Server, Info } from "lucide-react";

export default function Settings() {
  const [apiUrl, setApiUrl] = useState(
    localStorage.getItem("api_url") ?? import.meta.env.VITE_API_URL ?? "http://localhost:8008"
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem("api_url", apiUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">设置</h1>
        <p className="text-sm text-ink-tertiary mt-0.5">配置应用偏好</p>
      </div>

      {/* Backend */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "#E8ECF0",
              boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
            }}
          >
            <Server className="w-4 h-4 text-apple-blue" />
          </div>
          <h2 className="text-sm font-semibold text-ink-primary">后端连接</h2>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-ink-tertiary ml-1">
            API 地址
          </label>
          <input
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            className="w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0 transition-shadow duration-150"
            style={{
              background: "#E8ECF0",
              boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow =
                "inset 3px 3px 7px #C0C5CB, inset -3px -3px 7px #FFFFFF, 0 0 0 2px rgba(0,122,255,0.2)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow =
                "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF";
            }}
            placeholder="http://localhost:8008"
          />
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-medium text-white transition-all duration-150 active:scale-95"
          style={{
            background: saved
              ? "linear-gradient(145deg, #40D466, #28A844)"
              : "linear-gradient(145deg, #1A8AFF, #0062CC)",
            boxShadow: saved
              ? "4px 4px 10px rgba(0,140,0,0.35), -3px -3px 8px rgba(80,220,100,0.2)"
              : "4px 4px 10px rgba(0,62,204,0.35), -3px -3px 8px rgba(58,155,255,0.2)",
          }}
        >
          {saved && <CheckCircle className="w-4 h-4" />}
          {saved ? "已保存" : "保存"}
        </button>
      </Card>

      {/* About */}
      <Card padding="md" className="space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "#E8ECF0",
              boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
            }}
          >
            <Info className="w-4 h-4 text-apple-purple" />
          </div>
          <h2 className="text-sm font-semibold text-ink-primary">关于</h2>
        </div>

        <div className="space-y-1 ml-12">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-tertiary">应用名称</span>
            <span className="text-xs font-medium text-ink-secondary">智研 Copilot Desktop</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-tertiary">版本</span>
            <span className="text-xs font-medium text-ink-secondary">v0.1.0</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-tertiary">技术栈</span>
            <span className="text-xs font-medium text-ink-secondary">Tauri v2 · React · FastAPI</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
