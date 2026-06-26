import { Boxes } from "lucide-react";
import type { ProviderPresetId } from "./providerPresets";
import deepseek from "../../assets/provider-icons/deepseek.svg?raw";
import qwen from "../../assets/provider-icons/qwen.svg?raw";
import siliconflow from "../../assets/provider-icons/siliconflow.svg?raw";
import moonshot from "../../assets/provider-icons/moonshot.svg?raw";
import openai from "../../assets/provider-icons/openai.svg?raw";
import anthropic from "../../assets/provider-icons/anthropic.svg?raw";
import gemini from "../../assets/provider-icons/gemini.svg?raw";
import ollama from "../../assets/provider-icons/ollama.svg?raw";

/**
 * 厂商品牌图标。单色 logo（openai/moonshot/ollama）用 currentColor，
 * 内联渲染以跟随主题文字色；彩色 logo 自带品牌色。custom 无品牌，回退通用图标。
 */
const PROVIDER_SVGS: Partial<Record<ProviderPresetId, string>> = {
  deepseek,
  qwen,
  siliconflow,
  moonshot,
  openai,
  anthropic,
  gemini,
  ollama,
};

export default function ProviderIcon({
  id,
  className,
}: {
  id: ProviderPresetId;
  className?: string;
}) {
  const svg = PROVIDER_SVGS[id];
  if (!svg) return <Boxes className={className} aria-hidden />;
  // SVG 自身为 1em×1em，由外层 font-size 控制尺寸；text color 决定单色图标颜色。
  return <span className={className} aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />;
}
