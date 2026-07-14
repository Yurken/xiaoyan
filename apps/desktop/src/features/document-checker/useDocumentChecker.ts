import { useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { formatErrorMessage } from "../../lib/client";
import { inspectDocx } from "./docxParser";
import { inspectPdf } from "./pdfParser";
import { DOCUMENT_TEMPLATES, evaluateDocument, getDocumentTemplate, type DocumentCheckReport, type DocumentCheckRules, type DocumentTemplate } from "./shared";

export function useDocumentChecker() {
  const [templateId, setTemplateId] = useState<DocumentTemplate["id"]>("cn-thesis");
  const [customRules, setCustomRules] = useState<DocumentCheckRules>(DOCUMENT_TEMPLATES[0].rules);
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<DocumentCheckReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const rules = useMemo(() => templateId === "custom" ? customRules : getDocumentTemplate(templateId).rules, [customRules, templateId]);

  const chooseFile = async () => {
    const selected = await open({ multiple: false, filters: [{ name: "论文与申请材料", extensions: ["pdf", "docx"] }] });
    if (!selected || Array.isArray(selected)) return;
    setFilePath(selected);
    setFileName(selected.split(/[\\/]/).pop() ?? selected);
    setReport(null);
    setError("");
  };

  const runCheck = async () => {
    if (!filePath || loading) return;
    try {
      setLoading(true);
      setError("");
      const bytes = await readFile(filePath);
      const inspection = fileName.toLocaleLowerCase().endsWith(".pdf")
        ? await inspectPdf(bytes, fileName)
        : await inspectDocx(bytes, fileName);
      setReport(evaluateDocument(inspection, rules));
    } catch (nextError) {
      setReport(null);
      setError(formatErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const updateRule = <K extends keyof DocumentCheckRules>(key: K, value: DocumentCheckRules[K]) => setCustomRules((current) => ({ ...current, [key]: value }));

  return { templateId, customRules, rules, fileName, report, loading, error, setTemplateId, updateRule, chooseFile, runCheck };
}
