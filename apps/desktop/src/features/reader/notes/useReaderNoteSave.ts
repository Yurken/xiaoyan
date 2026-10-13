import { useCallback, useEffect, useRef, useState } from "react";

/** Keep the draft mounted until persistence confirms success; suppress duplicate submits. */
export function useReaderNoteSave() {
  const busy = useRef(false);
  const mounted = useRef(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const save = useCallback(async (action: () => void | boolean | Promise<boolean | void>) => {
    if (busy.current) return false;
    busy.current = true;
    setSaving(true);
    setStatus("");
    try {
      const result = await action();
      if (mounted.current) setStatus(result === false ? "保存失败，草稿已保留，请重试" : "已保存");
      return result !== false;
    } catch (error) {
      if (mounted.current) setStatus(error instanceof Error ? error.message : "保存失败，草稿已保留，请重试");
      return false;
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }, []);
  return { saving, status, save };
}
