import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { formatErrorMessage } from "../../lib/client";
import { inspectDocx } from "./docxParser";
import { inspectPdf } from "./pdfParser";
import {
  compareDocuments,
  type DocumentComparisonReport,
  type DocumentInspection,
  type DocumentRole,
  type SelectedDocumentFile,
} from "./shared";

const ROLE_LABELS: Record<DocumentRole, string> = {
  reference: "规范文档",
  candidate: "待校验文档",
};

async function inspectFile(file: SelectedDocumentFile): Promise<DocumentInspection> {
  const bytes = await readFile(file.path);
  return file.name.toLocaleLowerCase().endsWith(".pdf")
    ? inspectPdf(bytes, file.name)
    : inspectDocx(bytes, file.name);
}

export function useDocumentChecker() {
  const [referenceFile, setReferenceFile] = useState<SelectedDocumentFile | null>(null);
  const [candidateFile, setCandidateFile] = useState<SelectedDocumentFile | null>(null);
  const [report, setReport] = useState<DocumentComparisonReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const chooseFile = async (role: DocumentRole) => {
    const selected = await open({
      title: `选择${ROLE_LABELS[role]}`,
      multiple: false,
      filters: [{ name: "PDF 或 DOCX 文档", extensions: ["pdf", "docx"] }],
    });
    if (!selected || Array.isArray(selected)) return;

    const file = {
      path: selected,
      name: selected.split(/[\\/]/).pop() ?? selected,
    };
    if (role === "reference") setReferenceFile(file);
    else setCandidateFile(file);
    setReport(null);
    setError("");
  };

  const clearFile = (role: DocumentRole) => {
    if (role === "reference") setReferenceFile(null);
    else setCandidateFile(null);
    setReport(null);
    setError("");
  };

  const runComparison = async () => {
    if (!referenceFile || !candidateFile || loading) return;
    try {
      setLoading(true);
      setError("");
      const [reference, candidate] = await Promise.all([
        inspectFile(referenceFile).catch((cause) => {
          throw new Error(`规范文档解析失败：${formatErrorMessage(cause)}`);
        }),
        inspectFile(candidateFile).catch((cause) => {
          throw new Error(`待校验文档解析失败：${formatErrorMessage(cause)}`);
        }),
      ]);
      setReport(compareDocuments(reference, candidate));
    } catch (nextError) {
      setReport(null);
      setError(formatErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  return {
    referenceFile,
    candidateFile,
    report,
    loading,
    error,
    canCompare: Boolean(referenceFile && candidateFile),
    chooseFile,
    clearFile,
    runComparison,
  };
}
