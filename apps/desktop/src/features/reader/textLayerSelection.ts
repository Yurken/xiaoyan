/**
 * 复刻 pdf.js TextLayerBuilder 的选区抗抖动机制。
 *
 * 我们直接使用 pdfjs 核心 TextLayer 渲染文本层（没有用 viewer 的 TextLayerBuilder），
 * 因此缺少官方的 endOfContent 处理：选中文字时（尤其公式的大量小 span、跨段落）
 * 浏览器选区会在行间/字间反复跳动。这里给每个文本层补上 endOfContent 元素，并在
 * selectionchange 时把它插到选区锚点旁，让选区平滑延伸、不再抖动。
 *
 * 关键约束：endOfContent 必须保持 user-select: none（由 CSS 控制），不可在 JS 里
 * 覆盖为 text；否则它会变成一个覆盖全层的巨大可选节点，导致划词时瞬间选中整页。
 */

const textLayers = new Map<HTMLElement, HTMLElement>();
let globalBound = false;
let isPointerDown = false;
let prevRange: Range | null = null;
let selectionChangeRaf = 0;

function targetElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

function isTextSpanTarget(target: EventTarget | null): boolean {
  const span = targetElement(target)?.closest(".textLayer span");
  if (!(span instanceof HTMLElement)) return false;
  return span.getAttribute("role") !== "img";
}

function reset(end: HTMLElement, layer: HTMLElement) {
  layer.append(end);
  layer.classList.remove("selecting");
}

function onSelectionChange() {
  // throttle：用 requestAnimationFrame 合并密集 selectionchange 事件，
  // 避免 DOM 频繁变动导致选区范围来回跳动（视觉上即"抖动"）。
  if (selectionChangeRaf) cancelAnimationFrame(selectionChangeRaf);
  selectionChangeRaf = requestAnimationFrame(() => {
    selectionChangeRaf = 0;
    _doSelectionChange();
  });
}

function _doSelectionChange() {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) {
    textLayers.forEach(reset);
    return;
  }

  const active = new Set<HTMLElement>();
  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    for (const layer of textLayers.keys()) {
      if (!active.has(layer) && range.intersectsNode(layer)) active.add(layer);
    }
  }
  for (const [layer, end] of textLayers) {
    if (active.has(layer)) layer.classList.add("selecting");
    else reset(end, layer);
  }
  if (active.size === 0) {
    prevRange = null;
    return;
  }

  const range = selection.getRangeAt(0);
  const modifyStart =
    prevRange != null &&
    (range.compareBoundaryPoints(Range.END_TO_END, prevRange) === 0 ||
      range.compareBoundaryPoints(Range.START_TO_END, prevRange) === 0);

  let anchor: Node | null = modifyStart ? range.startContainer : range.endContainer;
  if (anchor && anchor.nodeType === Node.TEXT_NODE) anchor = anchor.parentNode;

  if (anchor && !modifyStart && range.endOffset === 0) {
    do {
      while (anchor && !(anchor as ChildNode).previousSibling) anchor = anchor.parentNode;
      if (!anchor) break;
      anchor = (anchor as ChildNode).previousSibling;
    } while (anchor && !anchor.childNodes.length);
  }

  const anchorEl = anchor instanceof HTMLElement ? anchor : null;
  const parentTextLayer = anchorEl?.parentElement?.closest(".textLayer") as HTMLElement | null;
  const end = parentTextLayer ? textLayers.get(parentTextLayer) : undefined;
  if (end && parentTextLayer && anchorEl?.parentElement) {
    // endOfContent 本身不可选（CSS user-select: none / z-index: -1），
    // 仅作为选区平滑延伸的边界参考。严禁覆盖为 userSelect="text" 或
    // 给它设置 width/height，否则它会变成覆盖全页的巨大可选节点。
    anchorEl.parentElement.insertBefore(end, modifyStart ? anchorEl : anchorEl.nextSibling);
  }
  prevRange = range.cloneRange();
}

function bindGlobal() {
  if (globalBound) return;
  globalBound = true;
  const resetAll = () => textLayers.forEach(reset);
  document.addEventListener("pointerdown", () => {
    isPointerDown = true;
    prevRange = null;
  });
  document.addEventListener("pointerup", () => {
    isPointerDown = false;
    resetAll();
  });
  window.addEventListener("blur", () => {
    isPointerDown = false;
    resetAll();
  });
  document.addEventListener("keyup", () => {
    if (!isPointerDown) resetAll();
  });
  document.addEventListener("selectionchange", onSelectionChange);
}

/** 给一个文本层挂上 endOfContent 与选区管理；返回注销函数（重渲染/卸载时调用）。 */
export function registerTextLayer(layer: HTMLElement): () => void {
  const existing = textLayers.get(layer);
  if (existing) existing.remove();

  const end = document.createElement("div");
  end.className = "endOfContent";
  layer.append(end);

  const onMouseDown = (event: MouseEvent) => {
    if (!isTextSpanTarget(event.target)) {
      event.preventDefault();
      document.getSelection()?.removeAllRanges();
      prevRange = null;
      reset(end, layer);
      return;
    }
    layer.classList.add("selecting");
  };
  layer.addEventListener("mousedown", onMouseDown);

  textLayers.set(layer, end);
  bindGlobal();

  return () => {
    layer.removeEventListener("mousedown", onMouseDown);
    end.remove();
    textLayers.delete(layer);
  };
}
