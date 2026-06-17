/**
 * 复刻 pdf.js TextLayerBuilder 的选区抗抖动机制。
 *
 * 我们直接使用 pdfjs 核心 TextLayer 渲染文本层（没有用 viewer 的 TextLayerBuilder），
 * 因此缺少官方的 endOfContent 处理：选中文字时（尤其公式的大量小 span、跨段落）
 * 浏览器选区会在行间/字间反复跳动。这里给每个文本层补上 endOfContent 元素，并在
 * selectionchange 时把它插到选区锚点旁、撑满整层，让选区平滑延伸、不再抖动。
 */

const textLayers = new Map<HTMLElement, HTMLElement>();
let globalBound = false;
let isPointerDown = false;
let prevRange: Range | null = null;

function reset(end: HTMLElement, layer: HTMLElement) {
  layer.append(end);
  end.style.width = "";
  end.style.height = "";
  layer.classList.remove("selecting");
}

function onSelectionChange() {
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
    end.style.width = parentTextLayer.style.width;
    end.style.height = parentTextLayer.style.height;
    end.style.userSelect = "text";
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

  const onMouseDown = () => layer.classList.add("selecting");
  layer.addEventListener("mousedown", onMouseDown);

  textLayers.set(layer, end);
  bindGlobal();

  return () => {
    layer.removeEventListener("mousedown", onMouseDown);
    end.remove();
    textLayers.delete(layer);
  };
}
