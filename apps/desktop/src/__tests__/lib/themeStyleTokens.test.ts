import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const COLOR_VARS = [
  "--rc-bg",
  "--rc-surface",
  "--rc-elevated",
  "--rc-text",
  "--rc-accent",
  "--rc-button-primary-bg",
] as const;

const SHADOW_VARS = [
  "--rc-card-shadow",
  "--rc-card-raised-shadow",
  "--rc-card-flat-shadow",
  "--rc-raised-shadow",
  "--rc-button-primary-shadow",
  "--rc-button-secondary-shadow",
  "--rc-icon-button-shadow",
  "--rc-inset-shadow",
  "--rc-card-inset-shadow",
  "--rc-chip-inset-shadow",
] as const;

type DeclMap = Map<string, string>;

interface CssRule {
  selector: string;
  body: string;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function matchingBrace(text: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error("样式表括号不匹配");
}

function parseRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const text = stripComments(css);
  let index = 0;
  while (index < text.length) {
    while (index < text.length && /\s/.test(text[index] ?? "")) index += 1;
    if (index >= text.length) break;

    if (text[index] === "@") {
      const brace = text.indexOf("{", index);
      const semi = text.indexOf(";", index);
      if (brace === -1 || (semi !== -1 && semi < brace)) {
        index = semi === -1 ? text.length : semi + 1;
        continue;
      }
      const prelude = text.slice(index, brace).trim();
      const end = matchingBrace(text, brace);
      if (/^@(media|layer|supports)\b/.test(prelude)) {
        rules.push(...parseRules(text.slice(brace + 1, end)));
      }
      index = end + 1;
      continue;
    }

    const brace = text.indexOf("{", index);
    if (brace === -1) break;
    const selector = text.slice(index, brace).replace(/\s+/g, " ").trim();
    const end = matchingBrace(text, brace);
    if (selector) rules.push({ selector, body: text.slice(brace + 1, end) });
    index = end + 1;
  }
  return rules;
}

function declarations(body: string): DeclMap {
  const map: DeclMap = new Map();
  let current = "";
  let depth = 0;
  const parts: string[] = [];
  for (const char of body) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === ";" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current);

  for (const part of parts) {
    const splitAt = part.indexOf(":");
    if (splitAt === -1) continue;
    const name = part.slice(0, splitAt).trim();
    const value = part.slice(splitAt + 1).trim();
    if (name.startsWith("--") && value) map.set(name, value);
  }
  return map;
}

function ruleBySelector(rules: CssRule[], selector: string): CssRule {
  const wanted = selector.replace(/\s+/g, " ").trim();
  const found = rules.find((rule) => rule.selector === wanted);
  if (!found) throw new Error(`缺少选择器 ${selector}`);
  return found;
}

function cascade(blocks: DeclMap[]): DeclMap {
  const merged: DeclMap = new Map();
  for (const block of blocks) {
    for (const [name, value] of block) merged.set(name, value);
  }
  return merged;
}

function splitShadowLayers(value: string): string[] {
  const layers: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      if (current.trim()) layers.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) layers.push(current.trim());
  return layers;
}

function isFlatShadow(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "none") return true;
  const layers = splitShadowLayers(trimmed);
  if (layers.length !== 1) return false;
  return /^(inset\s+)?0\s+0\s+0\s+1px\s+.+$/i.test(layers[0] ?? "");
}

function hasBidirectionalOffset(value: string): boolean {
  let positive = false;
  let negative = false;
  for (const layer of splitShadowLayers(value)) {
    const offsets = layer.replace(/^inset\s+/i, "").match(/-?\d*\.?\d+px/g) ?? [];
    const x = Number.parseFloat(offsets[0] ?? "");
    const y = Number.parseFloat(offsets[1] ?? "");
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x > 0 || y > 0) positive = true;
    if (x < 0 || y < 0) negative = true;
  }
  return positive && negative;
}

function setsPureFill(body: string): boolean {
  return /(?:^|;)\s*background(?:-color)?\s*:[^;]*(?:#fff\b|#ffffff\b|#000\b|#000000\b|\bwhite\b|\bblack\b)/i.test(body);
}

function channels(value: string): [number, number, number] | null {
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1] ?? "";
    const pair = (index: number) => Number.parseInt(raw.slice(index, index + 2), 16);
    return [pair(0), pair(2), pair(4)];
  }
  const rgb = value.trim().match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\)$/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

function isGrayscale(value: string): boolean {
  const parsed = channels(value);
  if (!parsed) return false;
  const [r, g, b] = parsed;
  return r === g && g === b;
}

function luminance(value: string): number {
  const parsed = channels(value);
  if (!parsed) return Number.NaN;
  const [r, g, b] = parsed;
  return (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
}

function loadDesktopThemeCss(): string {
  const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const indexCss = readFileSync(resolve(srcDir, "index.css"), "utf8");
  const themeImport = [...indexCss.matchAll(/@import\s+"([^"]+)"/g)]
    .map((match) => match[1] ?? "")
    .find((item) => item.endsWith("styles/theme.css"));
  if (!themeImport) throw new Error("桌面端入口没有引入主题样式表");
  return readFileSync(resolve(srcDir, themeImport), "utf8");
}

describe("极简主题令牌契约", () => {
  const css = loadDesktopThemeCss();
  const rules = parseRules(css);
  const root = declarations(ruleBySelector(rules, ":root").body);
  const neumorphicLightBlock = ruleBySelector(rules, 'html[data-theme="light"]');
  const neumorphicLight = declarations(neumorphicLightBlock.body);
  const minimal = declarations(ruleBySelector(rules, 'html[data-style="modern-minimal"]').body);
  const minimalLight = declarations(
    ruleBySelector(rules, 'html[data-style="modern-minimal"][data-theme="light"]').body,
  );
  const neumorphicDarkTokens = root;
  const neumorphicLightTokens = cascade([root, neumorphicLight]);
  const minimalDarkTokens = cascade([root, minimal]);
  const minimalLightTokens = cascade([root, neumorphicLight, minimal, minimalLight]);

  it("拟态保持清透淡蓝，极简单独走黑白灰主色", () => {
    expect(neumorphicLightBlock.body).toMatch(/#F0F4F8/i);
    expect(neumorphicLightBlock.body).toMatch(/#007AFF/i);
    expect(hasBidirectionalOffset(neumorphicLight.get("--rc-card-shadow") ?? "")).toBe(true);
    expect(neumorphicLightTokens.get("--rc-bg")?.toLowerCase()).toBe("#f0f4f8");
    expect(neumorphicLightTokens.get("--rc-accent")?.toLowerCase()).toBe("#007aff");
    expect(neumorphicDarkTokens.get("--rc-accent")?.toLowerCase()).toBe("#007aff");

    for (const name of [...COLOR_VARS, "--rc-text-soft", "--rc-text-muted"] as const) {
      const dark = minimalDarkTokens.get(name) ?? "";
      const light = minimalLightTokens.get(name) ?? "";
      expect(isGrayscale(dark), `${name} dark = ${dark}`).toBe(true);
      expect(isGrayscale(light), `${name} light = ${light}`).toBe(true);
    }

    // 黑白互换：深色下背景近黑、强调近白；浅色下背景纯白、强调近黑
    expect(luminance(minimalDarkTokens.get("--rc-bg") ?? "")).toBeLessThan(0.1);
    expect(luminance(minimalLightTokens.get("--rc-bg") ?? "")).toBeGreaterThan(0.9);
    expect(luminance(minimalDarkTokens.get("--rc-accent") ?? "")).toBeGreaterThan(0.9);
    expect(luminance(minimalLightTokens.get("--rc-accent") ?? "")).toBeLessThan(0.15);

    // Tailwind 的 apple-blue 透明度类依赖 accent-rgb，必须与 accent 同步
    expect(minimal.get("--rc-accent-rgb")).toBe("255 255 255");
    expect(minimalLight.get("--rc-accent-rgb")).toBe("17 17 17");
    expect(root.get("--rc-accent-rgb")).toBe("0 122 255");

    expect(root.get("--rc-card-bg")).toMatch(/linear-gradient/i);
    expect(neumorphicLight.get("--rc-card-bg")).toMatch(/linear-gradient/i);
    expect(minimal.get("--rc-card-bg")).toBe("transparent");
    expect(minimal.get("--rc-card-inset-bg")).toBe("transparent");
    expect(minimal.get("--rc-module-tile-bg")).toBe("transparent");
    expect(minimal.get("--rc-card-outline")).toBe("transparent");
    expect(minimal.get("--rc-card-inset-outline")).toBe("transparent");
    expect(minimal.get("--rc-card-radius")).toBe("12px");
    expect(minimalLight.get("--rc-card-bg")).toBeUndefined();
  });

  it("极简用发丝线分区，不再把品牌蓝当强调色", () => {
    const minimalRules = rules.filter((rule) => rule.selector.includes('html[data-style="modern-minimal"]'));

    const headingRule = minimalRules.find((rule) => rule.selector.includes(".rc-section-heading"));
    expect(headingRule?.body).toMatch(/border-bottom:\s*1px solid var\(--rc-border\)/);

    const blueFillRule = minimalRules.find((rule) => rule.selector.endsWith(".bg-apple-blue"));
    expect(blueFillRule?.body).toMatch(/background-color:\s*var\(--rc-accent\)\s*!important/);
    expect(blueFillRule?.body).toMatch(/background-image:\s*none\s*!important/);

    for (const rule of minimalRules) {
      expect(rule.body).not.toMatch(/#007aff/i);
      expect(rule.body).not.toMatch(/rgba\(0,\s*122,\s*255/i);
    }
  });

  it("极简阴影是平面或单层细边界，不再使用双向偏移", () => {
    for (const name of SHADOW_VARS) {
      const darkValue = minimalDarkTokens.get(name) ?? "";
      const lightValue = minimalLightTokens.get(name) ?? "";
      expect(isFlatShadow(darkValue), `${name} dark = ${darkValue}`).toBe(true);
      expect(isFlatShadow(lightValue), `${name} light = ${lightValue}`).toBe(true);
      expect(hasBidirectionalOffset(darkValue), name).toBe(false);
      expect(hasBidirectionalOffset(lightValue), name).toBe(false);
    }
  });

  it("极简把卡片压平成区块：不再有卡片框，列表用发丝线分隔", () => {
    const minimalRules = rules.filter((rule) => rule.selector.includes('html[data-style="modern-minimal"]'));

    const cardRule = minimalRules.find(
      (rule) => rule.selector === 'html[data-style="modern-minimal"] .rc-card',
    );
    expect(cardRule?.body).toMatch(/padding-inline:\s*0\s*!important/);
    expect(cardRule?.body).toMatch(/box-shadow:\s*none\s*!important/);

    const dividerRule = minimalRules.find((rule) => rule.selector.includes(".rc-flat-rows"));
    expect(dividerRule?.body).toMatch(/border-top:\s*1px solid var\(--rc-border\)/);

    const tilesGetOwnBorder = minimalRules.some(
      (rule) =>
        rule.selector === 'html[data-style="modern-minimal"] .rc-module-tile'
        && /(?:^|;)\s*border\s*:\s*1px/.test(rule.body),
    );
    expect(tilesGetOwnBorder).toBe(false);
  });

  it("极简分支压平输入和写死投影，且不把浅色填充改成纯白或纯黑", () => {
    const minimalRules = rules.filter((rule) => rule.selector.includes('html[data-style="modern-minimal"]'));
    expect(minimalRules.length).toBeGreaterThan(0);

    const flattensInputs = minimalRules.some((rule) =>
      /\binput\b/.test(rule.selector)
      && /\btextarea\b/.test(rule.selector)
      && /\bselect\b/.test(rule.selector)
      && /box-shadow\s*:\s*none\s*!important/i.test(rule.body),
    );
    const flattensHardcoded = minimalRules.some((rule) =>
      rule.selector.includes("shadow-nm-")
      && rule.selector.includes("shadow-apple-blue")
      && rule.selector.includes('style*="-3px -3px"')
      && /box-shadow\s*:\s*none\s*!important/i.test(rule.body),
    );
    expect(flattensInputs).toBe(true);
    expect(flattensHardcoded).toBe(true);

    for (const rule of minimalRules) {
      expect(setsPureFill(rule.body), rule.selector).toBe(false);
    }
  });
});
