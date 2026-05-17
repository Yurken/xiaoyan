import {
  BookOpen,
  Braces,
  CaseSensitive,
  FileCode2,
  Hash,
  Heading1,
  Image,
  List,
  Pilcrow,
  Quote,
  Sigma,
  Table2,
  TextCursorInput,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const latex = String.raw;

export interface WritingContextMenuSnippet {
  id: string;
  title: string;
  hint: string;
  before: string;
  after?: string;
}

export interface WritingContextMenuGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  snippets: WritingContextMenuSnippet[];
}

export interface WritingContextMenuQuickInsert extends WritingContextMenuSnippet {
  icon: LucideIcon;
}

export const CONTEXT_MENU_GROUPS: WritingContextMenuGroup[] = [
  {
    id: "structure",
    title: "标题与结构",
    icon: Heading1,
    snippets: [
      { id: "section", title: "一级标题", hint: latex`\section{...}`, before: latex`\section{`, after: "}\n" },
      { id: "subsection", title: "二级标题", hint: latex`\subsection{...}`, before: latex`\subsection{`, after: "}\n" },
      { id: "subsubsection", title: "三级标题", hint: latex`\subsubsection{...}`, before: latex`\subsubsection{`, after: "}\n" },
      { id: "paragraph", title: "段落标题", hint: latex`\paragraph{...}`, before: latex`\paragraph{`, after: "}\n" },
      {
        id: "abstract",
        title: "摘要",
        hint: "abstract 环境",
        before: latex`\begin{abstract}
`,
        after: latex`
\end{abstract}
`,
      },
      {
        id: "keywords",
        title: "关键词",
        hint: "中文关键词行",
        before: latex`\noindent\textbf{关键词：`,
        after: "}\n",
      },
      {
        id: "appendix",
        title: "附录章节",
        hint: latex`\appendix`,
        before: latex`\appendix
\section{`,
        after: "}\n",
      },
      {
        id: "title-block",
        title: "题名信息",
        hint: "title / author / date",
        before: latex`\title{`,
        after: latex`}
\author{作者姓名}
\date{\today}
`,
      },
    ],
  },
  {
    id: "math",
    title: "公式与推导",
    icon: Sigma,
    snippets: [
      { id: "inline-math", title: "行内公式", hint: "$...$", before: "$", after: "$" },
      {
        id: "display-math",
        title: "独立公式",
        hint: latex`\[...\]`,
        before: latex`\[
  `,
        after: latex`
\]
`,
      },
      {
        id: "equation",
        title: "编号公式",
        hint: "equation + label",
        before: latex`\begin{equation}
  `,
        after: latex`
  \label{eq:change-me}
\end{equation}
`,
      },
      {
        id: "align",
        title: "多行对齐",
        hint: "align 环境",
        before: latex`\begin{align}
  `,
        after: latex`
  \label{eq:change-me}
\end{align}
`,
      },
      {
        id: "cases",
        title: "分段函数",
        hint: "cases 环境",
        before: latex`\begin{cases}
  `,
        after: latex` & \text{if } x > 0 \\
  0 & \text{otherwise}
\end{cases}`,
      },
      {
        id: "split",
        title: "公式拆行",
        hint: "equation + split",
        before: latex`\begin{equation}
\begin{split}
  `,
        after: latex`
\end{split}
\end{equation}
`,
      },
      { id: "fraction", title: "分式", hint: latex`\frac{}{}`, before: latex`\frac{`, after: "}{}" },
      { id: "sqrt", title: "根号", hint: latex`\sqrt{}`, before: latex`\sqrt{`, after: "}" },
      { id: "sum", title: "求和", hint: latex`\sum_{i=1}^{N}`, before: latex`\sum_{i=1}^{N} ` },
      { id: "integral", title: "积分", hint: latex`\int_{a}^{b}`, before: latex`\int_{a}^{b} ` },
      { id: "limit", title: "极限", hint: latex`\lim_{n \to \infty}`, before: latex`\lim_{n \to \infty} ` },
      {
        id: "derivative",
        title: "导数",
        hint: latex`\frac{d}{dx}`,
        before: latex`\frac{d `,
        after: latex`}{d x}`,
      },
      {
        id: "partial-derivative",
        title: "偏导",
        hint: latex`\frac{\partial}{\partial x}`,
        before: latex`\frac{\partial `,
        after: latex`}{\partial x}`,
      },
      { id: "norm", title: "范数", hint: latex`\lVert...\rVert`, before: latex`\lVert `, after: latex` \rVert` },
      { id: "paren", title: "自适应括号", hint: latex`\left( ... \right)`, before: latex`\left( `, after: latex` \right)` },
      {
        id: "matrix",
        title: "矩阵",
        hint: "pmatrix",
        before: latex`\begin{pmatrix}
  `,
        after: latex` & 0 \\
  0 & 1
\end{pmatrix}`,
      },
    ],
  },
  {
    id: "media",
    title: "图表",
    icon: Table2,
    snippets: [
      {
        id: "figure",
        title: "图片",
        hint: "figure + caption",
        before: latex`\begin{figure}[htbp]
  \centering
  \includegraphics[width=0.86\linewidth]{figures/`,
        after: latex`}
  \caption{图题}
  \label{fig:change-me}
\end{figure}
`,
      },
      {
        id: "includegraphics",
        title: "插入图片",
        hint: latex`\includegraphics`,
        before: latex`\includegraphics[width=0.86\linewidth]{`,
        after: "}",
      },
      {
        id: "two-figures",
        title: "双图并排",
        hint: "minipage 双栏",
        before: latex`\begin{figure}[htbp]
  \centering
  \begin{minipage}{0.48\linewidth}
    \centering
    \includegraphics[width=\linewidth]{figures/`,
        after: latex`}
    \caption{左图题}
    \label{fig:left}
  \end{minipage}
  \hfill
  \begin{minipage}{0.48\linewidth}
    \centering
    \includegraphics[width=\linewidth]{figures/change-me.pdf}
    \caption{右图题}
    \label{fig:right}
  \end{minipage}
\end{figure}
`,
      },
      {
        id: "table",
        title: "三线表",
        hint: "booktabs",
        before: latex`\begin{table}[htbp]
  \centering
  \caption{表题}
  \label{tab:change-me}
  \begin{tabular}{lcc}
    \toprule
    `,
        after: latex` & 指标 A & 指标 B \\
    \midrule
    方法 & 0.00 & 0.00 \\
    \bottomrule
  \end{tabular}
\end{table}
`,
      },
      {
        id: "tabular",
        title: "表格主体",
        hint: "tabular",
        before: latex`\begin{tabular}{lcc}
  \toprule
  `,
        after: latex` & 指标 A & 指标 B \\
  \midrule
  方法 & 0.00 & 0.00 \\
  \bottomrule
\end{tabular}
`,
      },
      {
        id: "resizebox",
        title: "缩放表格",
        hint: latex`\resizebox{\linewidth}{!}`,
        before: latex`\resizebox{\linewidth}{!}{%
`,
        after: latex`
}
`,
      },
    ],
  },
  {
    id: "references",
    title: "引用与链接",
    icon: BookOpen,
    snippets: [
      { id: "label", title: "标签", hint: latex`\label{...}`, before: latex`\label{`, after: "}" },
      { id: "ref", title: "交叉引用", hint: latex`\ref{...}`, before: latex`\ref{`, after: "}" },
      { id: "eqref", title: "公式引用", hint: latex`\eqref{...}`, before: latex`\eqref{`, after: "}" },
      { id: "cite", title: "文献引用", hint: latex`\cite{...}`, before: latex`\cite{`, after: "}" },
      { id: "citep", title: "括号引用", hint: latex`\citep{...}`, before: latex`\citep{`, after: "}" },
      { id: "citet", title: "叙述引用", hint: latex`\citet{...}`, before: latex`\citet{`, after: "}" },
      { id: "url", title: "链接", hint: latex`\url{...}`, before: latex`\url{`, after: "}" },
      {
        id: "bibliography",
        title: "参考文献",
        hint: "plainnat + references",
        before: latex`\bibliographystyle{plainnat}
\bibliography{references}
`,
      },
    ],
  },
  {
    id: "lists",
    title: "列表与区块",
    icon: List,
    snippets: [
      {
        id: "itemize",
        title: "无序列表",
        hint: "itemize",
        before: latex`\begin{itemize}
  \item `,
        after: latex`
\end{itemize}
`,
      },
      {
        id: "enumerate",
        title: "有序列表",
        hint: "enumerate",
        before: latex`\begin{enumerate}
  \item `,
        after: latex`
\end{enumerate}
`,
      },
      {
        id: "description",
        title: "描述列表",
        hint: "description",
        before: latex`\begin{description}
  \item[`,
        after: latex`] 描述内容
\end{description}
`,
      },
      { id: "item", title: "列表项", hint: latex`\item`, before: latex`\item ` },
      { id: "check-item", title: "待办项", hint: latex`\item[$\square$]`, before: latex`\item[$\square$] ` },
      {
        id: "quote",
        title: "引用块",
        hint: "quote",
        before: latex`\begin{quote}
`,
        after: latex`
\end{quote}
`,
      },
      {
        id: "center",
        title: "居中块",
        hint: "center",
        before: latex`\begin{center}
`,
        after: latex`
\end{center}
`,
      },
      { id: "line-break", title: "换行", hint: latex`\\`, before: latex`\\` + "\n" },
    ],
  },
  {
    id: "text",
    title: "文本格式",
    icon: Type,
    snippets: [
      { id: "bold", title: "加粗", hint: latex`\textbf{...}`, before: latex`\textbf{`, after: "}" },
      { id: "emph", title: "强调", hint: latex`\emph{...}`, before: latex`\emph{`, after: "}" },
      { id: "italic", title: "斜体", hint: latex`\textit{...}`, before: latex`\textit{`, after: "}" },
      { id: "underline", title: "下划线", hint: latex`\underline{...}`, before: latex`\underline{`, after: "}" },
      { id: "mono", title: "等宽", hint: latex`\texttt{...}`, before: latex`\texttt{`, after: "}" },
      { id: "small-caps", title: "小型大写", hint: latex`\textsc{...}`, before: latex`\textsc{`, after: "}" },
      { id: "footnote", title: "脚注", hint: latex`\footnote{...}`, before: latex`\footnote{`, after: "}" },
      { id: "comment", title: "注释", hint: "% ...", before: "% " },
      { id: "newpage", title: "分页", hint: latex`\newpage`, before: latex`\newpage` + "\n" },
      { id: "clearpage", title: "清页", hint: latex`\clearpage`, before: latex`\clearpage` + "\n" },
    ],
  },
];

export const QUICK_INSERTS: WritingContextMenuQuickInsert[] = [
  { id: "label", title: "标签", hint: latex`\label{...}`, icon: Hash, before: latex`\label{`, after: "}" },
  { id: "cite", title: "引用", hint: latex`\cite{...}`, icon: Braces, before: latex`\cite{`, after: "}" },
  { id: "ref", title: "交叉引用", hint: latex`\ref{...}`, icon: FileCode2, before: latex`\ref{`, after: "}" },
  { id: "image", title: "图片", hint: latex`\includegraphics`, icon: Image, before: latex`\includegraphics[width=0.86\linewidth]{`, after: "}" },
  {
    id: "quote",
    title: "引用块",
    hint: "quote",
    icon: Quote,
    before: latex`\begin{quote}
`,
    after: latex`
\end{quote}
`,
  },
  { id: "mono", title: "等宽", hint: latex`\texttt{...}`, icon: CaseSensitive, before: latex`\texttt{`, after: "}" },
  { id: "paragraph", title: "段落", hint: latex`\paragraph{...}`, icon: Pilcrow, before: latex`\paragraph{`, after: "}\n" },
  { id: "cursor", title: "占位", hint: "TODO", icon: TextCursorInput, before: "TODO: " },
];
