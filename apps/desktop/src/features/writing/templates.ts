import type { LatexSnippet, LatexTemplate, WritingTemplateId } from "./shared";

const JOURNAL_TEX = String.raw`% !TeX program = xelatex
% !TeX root = main.tex
\documentclass[UTF8,a4paper,11pt]{ctexart}

\usepackage{amsmath,amssymb,amsfonts}
\usepackage{booktabs}
\usepackage{graphicx}
\usepackage{hyperref}
\usepackage[numbers,sort&compress]{natbib}
\usepackage[margin=2.4cm]{geometry}

\title{面向高效研究流的论文标题}
\author{作者 A \and 作者 B}
\date{\today}

\begin{document}
\maketitle

\begin{abstract}
这里写摘要：问题背景、核心方法、关键结果和结论。建议控制在 150--250 字，并明确指出贡献。
\end{abstract}

\section{引言}
研究问题从这里展开。第一段交代背景，第二段指出现有方法的不足，第三段概括本文贡献。

本文的主要贡献如下：
\begin{itemize}
  \item 提出一个轻量但可复现的研究工作流；
  \item 在多个任务上验证方法的有效性；
  \item 开放必要的配置、数据处理脚本和消融结果。
\end{itemize}

\section{相关工作}
可以按主题组织相关研究，例如方法谱系、任务设定和评测协议。引用示例：\cite{vaswani2017attention}。

\section{方法}
定义问题、符号和模型结构。
\begin{equation}
  \mathcal{L}(\theta) = - \sum_{i=1}^{N} \log p_{\theta}(y_i \mid x_i)
  \label{eq:objective}
\end{equation}

\section{实验}
说明数据集、基线、实现细节和评价指标。表格示例见表 \ref{tab:main-result}。

\begin{table}[htbp]
  \centering
  \caption{主实验结果}
  \label{tab:main-result}
  \begin{tabular}{lcc}
    \toprule
    方法 & 指标 A & 指标 B \\
    \midrule
    Baseline & 0.00 & 0.00 \\
    Ours & 0.00 & 0.00 \\
    \bottomrule
  \end{tabular}
\end{table}

\section{结论}
总结发现、适用边界和下一步工作。

\bibliographystyle{plainnat}
\bibliography{references}
\end{document}
`;

const CONFERENCE_TEX = String.raw`% !TeX program = xelatex
% !TeX root = main.tex
\documentclass[UTF8,11pt]{ctexart}

\usepackage{amsmath,amssymb}
\usepackage{booktabs}
\usepackage{graphicx}
\usepackage{hyperref}
\usepackage[numbers]{natbib}
\usepackage[a4paper,margin=2.2cm]{geometry}

\title{会议论文标题：突出问题、方法和结果}
\author{作者 A \and 作者 B}
\date{}

\begin{document}
\maketitle

\begin{abstract}
用一段话讲清楚动机、方法和结果，避免把摘要写成引言。
\end{abstract}

\section{Introduction}
What is the problem, why is it hard, and why should the reader care?

\section{Method}
Describe the proposed method with enough detail for reproduction.

\section{Experiments}
Report datasets, baselines, metrics, implementation details, and ablations.

\section{Limitations}
State where the method may fail and what assumptions it depends on.

\section{Conclusion}
Close with the main finding and future work.

\bibliographystyle{plainnat}
\bibliography{references}
\end{document}
`;

const THESIS_NOTE_TEX = String.raw`% !TeX program = xelatex
% !TeX root = main.tex
\documentclass[UTF8,a4paper,12pt]{ctexart}

\usepackage{amsmath,amssymb}
\usepackage{booktabs}
\usepackage{graphicx}
\usepackage{hyperref}
\usepackage[numbers]{natbib}
\usepackage[margin=2.6cm]{geometry}

\title{研究笔记式论文草稿}
\author{小妍研究工作台}
\date{\today}

\begin{document}
\maketitle

\section{问题定义}
写清楚研究问题、输入输出、约束条件和评价标准。

\section{核心假设}
列出当前方案依赖的关键假设，并说明如何被实验验证或证伪。

\section{方法草图}
先保留推导过程，后续再收敛为正式论文表达。

\section{证据与实验}
记录实验设置、现象、失败样例和下一轮实验计划。

\section{待补引用}
把需要回查的论文、数据集和工具放在这里，成稿前再整理到 BibTeX。

\bibliographystyle{plainnat}
\bibliography{references}
\end{document}
`;

const DEFAULT_BIBTEX = String.raw`@inproceedings{vaswani2017attention,
  title     = {Attention Is All You Need},
  author    = {Vaswani, Ashish and Shazeer, Noam and Parmar, Niki and Uszkoreit, Jakob and Jones, Llion and Gomez, Aidan N. and Kaiser, Lukasz and Polosukhin, Illia},
  booktitle = {Advances in Neural Information Processing Systems},
  year      = {2017}
}
`;

export const WRITING_TEMPLATES: LatexTemplate[] = [
  {
    id: "journal",
    title: "期刊论文",
    description: "中文友好、结构完整，适合从草稿推进到投稿稿件。",
    mainTex: JOURNAL_TEX,
    bibtex: DEFAULT_BIBTEX,
  },
  {
    id: "conference",
    title: "会议论文",
    description: "更紧凑的章节骨架，适合快速组织英文会议稿。",
    mainTex: CONFERENCE_TEX,
    bibtex: DEFAULT_BIBTEX,
  },
  {
    id: "thesis-note",
    title: "研究笔记",
    description: "先保留推导和证据，适合早期问题收敛。",
    mainTex: THESIS_NOTE_TEX,
    bibtex: DEFAULT_BIBTEX,
  },
];

export const WRITING_SNIPPETS: LatexSnippet[] = [
  {
    id: "section",
    title: "章节",
    description: "\\section{...}",
    before: "\\section{",
    after: "}\n",
  },
  {
    id: "equation",
    title: "公式",
    description: "带编号 equation 环境",
    before: "\\begin{equation}\n  ",
    after: "\n  \\label{eq:change-me}\n\\end{equation}\n",
  },
  {
    id: "figure",
    title: "图",
    description: "figure + includegraphics",
    before: "\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.86\\linewidth]{figures/",
    after: "}\n  \\caption{图题}\n  \\label{fig:change-me}\n\\end{figure}\n",
  },
  {
    id: "table",
    title: "表",
    description: "booktabs 三线表",
    before: "\\begin{table}[htbp]\n  \\centering\n  \\caption{表题}\n  \\label{tab:change-me}\n  \\begin{tabular}{lcc}\n    \\toprule\n    ",
    after: " & 指标 A & 指标 B \\\\\n    \\midrule\n    方法 & 0.00 & 0.00 \\\\\n    \\bottomrule\n  \\end{tabular}\n\\end{table}\n",
  },
  {
    id: "itemize",
    title: "列表",
    description: "itemize 条目",
    before: "\\begin{itemize}\n  \\item ",
    after: "\n\\end{itemize}\n",
  },
  {
    id: "cite",
    title: "引用",
    description: "\\cite{key}",
    before: "\\cite{",
    after: "}",
  },
];

export function getDefaultWritingTemplate(): LatexTemplate {
  return WRITING_TEMPLATES[0];
}

export function getWritingTemplate(id: WritingTemplateId): LatexTemplate {
  return WRITING_TEMPLATES.find((template) => template.id === id) ?? getDefaultWritingTemplate();
}
