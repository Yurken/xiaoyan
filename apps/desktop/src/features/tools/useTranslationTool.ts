import { useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";

export function useTranslationTool() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("zh");

  const submit = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setLoading(true);
    setError("");
    setResult("");
    try {
      const nextResult = await apiClient.translate.translate(
        text,
        targetLang,
        sourceLang === "auto" ? undefined : sourceLang,
      );
      setResult(nextResult);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return {
    input,
    result,
    loading,
    error,
    sourceLang,
    targetLang,
    setInput,
    setSourceLang,
    setTargetLang,
    submit,
  };
}
