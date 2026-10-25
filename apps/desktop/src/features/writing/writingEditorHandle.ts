/**
 * 源码编辑器对外暴露的命令式句柄。
 * 源码面板与可视化编辑器共用同一接口，便于面板侧统一驱动插入、选区与焦点。
 */
export interface WritingEditorHandle {
  focus(): void;
  getSelectedText(): string;
  insertText(before: string, after?: string): void;
  insertLatex(content: string): void;
  focusSourceRange(start: number, end?: number): void;
}
