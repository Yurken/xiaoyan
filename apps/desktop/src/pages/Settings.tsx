import { useState } from "react";
import { Card } from "@research-copilot/ui";
import { Button } from "@research-copilot/ui";

export default function Settings() {
  const [apiUrl, setApiUrl] = useState(
    import.meta.env.VITE_API_URL ?? "http://localhost:8008"
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem("api_url", apiUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-lg">
      <h1 className="text-xl font-semibold text-gray-900">设置</h1>

      <Card padding="md">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">后端连接</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">API 地址</label>
            <input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="http://localhost:8008"
            />
          </div>
          <Button size="sm" onClick={handleSave}>
            {saved ? "已保存" : "保存"}
          </Button>
        </div>
      </Card>

      <Card padding="md">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">关于</h2>
        <p className="text-xs text-gray-500">智研 Copilot Desktop v0.1.0</p>
        <p className="text-xs text-gray-400 mt-1">Tauri v2 + React + FastAPI</p>
      </Card>
    </div>
  );
}
