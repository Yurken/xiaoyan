import { useCallback, useEffect, useState } from "react";
import type { ReaderPageLayout } from "./pageLayout";

const STORAGE_KEY = "xiaoyan.reader.pageLayout.v1";

function readStoredLayout(): ReaderPageLayout {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "spread" ? "spread" : "single";
  } catch {
    return "single";
  }
}

/** 单页/双页偏好：所有论文共用一份，记在本地，默认单页。 */
export function useReaderPageLayout() {
  const [layout, setLayout] = useState<ReaderPageLayout>(readStoredLayout);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, layout);
    } catch {
      // 存储不可用时只在本次会话生效。
    }
  }, [layout]);

  const toggleLayout = useCallback(() => {
    setLayout((current) => (current === "single" ? "spread" : "single"));
  }, []);

  return { layout, setLayout, toggleLayout, spread: layout === "spread" };
}
