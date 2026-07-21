import { describe, expect, it } from "vitest";
import {
  buildReaderQuestionContext,
  deriveOutlineFromPages,
  searchReaderPages,
  supplementSparseOutline,
  type ReaderPageContent,
} from "../../../features/reader/readerNavigation";

const pages: ReaderPageContent[] = [
  {
    page: 1,
    lines: ["A Study of Reading", "Abstract", "This paper presents an annotation system."],
    text: "A Study of Reading\nAbstract\nThis paper presents an annotation system.",
  },
  {
    page: 2,
    lines: ["1 Introduction", "Readers need reliable full-text search."],
    text: "1 Introduction\nReaders need reliable full-text search.",
  },
  {
    page: 3,
    lines: ["2.1 Method", "The method combines text selection and visual regions."],
    text: "2.1 Method\nThe method combines text selection and visual regions.",
  },
];

describe("reader navigation", () => {
  it("从论文文本推断目录并保留章节层级", () => {
    const outline = deriveOutlineFromPages(pages);

    expect(outline.map((entry) => [entry.title, entry.page, entry.depth])).toEqual([
      ["Abstract", 1, 0],
      ["1 Introduction", 2, 0],
      ["2.1 Method", 3, 1],
    ]);
  });

  it("不会把代码、公式或正文编号误识别成目录", () => {
    const outline = deriveOutlineFromPages([{
      page: 4,
      text: "5 annotate ( train : Examples , fn : Transformation )",
      lines: [
        "5 annotate ( train : Examples , fn : Transformation )",
        "1 sample ( train : Examples , k: int )",
        "1 from dsp import generate",
        "15 return x",
        "1 My task is to write a simple query that gathers",
        "3 def pipeline (x):",
      ],
      lineDetails: [
        "5 annotate ( train : Examples , fn : Transformation )",
        "1 sample ( train : Examples , k: int )",
        "1 from dsp import generate",
        "15 return x",
        "1 My task is to write a simple query that gathers",
        "3 def pipeline (x):",
      ].map((text) => ({ text, fontSize: 10 })),
    }, {
      page: 5,
      text: "2 System Design",
      lines: ["2 System Design", "The system is evaluated on three datasets."],
      lineDetails: [
        { text: "2 System Design", fontSize: 15 },
        { text: "The system is evaluated on three datasets.", fontSize: 10 },
      ],
    }]);

    expect(outline.map((entry) => entry.title)).toEqual(["2 System Design"]);
  });

  it("保留包含领域术语的学术章节标题", () => {
    const outline = deriveOutlineFromPages([{
      page: 3,
      text: "3 Query Strategy\n4 Training Pipeline",
      lines: ["3 Query Strategy", "4 Training Pipeline"],
      lineDetails: [
        { text: "3 Query Strategy", fontSize: 15 },
        { text: "4 Training Pipeline", fontSize: 15 },
        { text: "This section explains the strategy in detail.", fontSize: 10 },
        { text: "The query selects informative samples for training.", fontSize: 10 },
        { text: "We compare the resulting pipeline with prior work.", fontSize: 10 },
      ],
    }]);

    expect(outline.map((entry) => entry.title)).toEqual(["3 Query Strategy", "4 Training Pipeline"]);
  });

  it("识别编号末尾带句点的论文目录", () => {
    const outline = deriveOutlineFromPages([{
      page: 2,
      text: "2. DEMONSTRATE–SEARCH–PREDICT\n2.1. Pretrained Modules: LM and RM\n2.2. Datatypes and Control Flow",
      lines: [
        "2. DEMONSTRATE–SEARCH–PREDICT",
        "2.1. Pretrained Modules: LM and RM",
        "2.2. Datatypes and Control Flow",
      ],
      lineDetails: [
        { text: "2. DEMONSTRATE–SEARCH–PREDICT", fontSize: 16 },
        { text: "2.1. Pretrained Modules: LM and RM", fontSize: 14 },
        { text: "A DSP program defines the communication between models.", fontSize: 10 },
        { text: "2.2. Datatypes and Control Flow", fontSize: 14 },
        { text: "The present section introduces the core data types.", fontSize: 10 },
        { text: "The framework provides composable functions for programs.", fontSize: 10 },
        { text: "These modules communicate through typed interfaces.", fontSize: 10 },
      ],
    }]);

    expect(outline.map((entry) => [entry.title, entry.depth])).toEqual([
      ["2. DEMONSTRATE–SEARCH–PREDICT", 0],
      ["2.1. Pretrained Modules: LM and RM", 1],
      ["2.2. Datatypes and Control Flow", 1],
    ]);
  });

  it("PDF 自带目录仅有摘要时用推断章节补齐", () => {
    const nativeOutline = [{ id: "native-abstract", title: "Abstract", page: 1, depth: 0 }];
    const derivedOutline = [
      { id: "derived-abstract", title: "Abstract", page: 1, depth: 0 },
      { id: "derived-section", title: "2. DEMONSTRATE–SEARCH–PREDICT", page: 2, depth: 0 },
    ];

    expect(supplementSparseOutline(nativeOutline, derivedOutline).map((entry) => entry.title)).toEqual([
      "Abstract",
      "2. DEMONSTRATE–SEARCH–PREDICT",
    ]);
  });

  it("全文搜索按相关度返回页码与上下文摘要", () => {
    const results = searchReaderPages(pages, "full-text search");

    expect(results[0]?.page).toBe(2);
    expect(results[0]?.snippet).toContain("full-text search");
  });

  it("问答上下文包含页码来源并优先相关页面", () => {
    const context = buildReaderQuestionContext(pages, "visual regions", 1);

    expect(context).toMatch(/^\[第 3 页\]/);
    expect(context).toContain("[第 1 页]");
  });
});
