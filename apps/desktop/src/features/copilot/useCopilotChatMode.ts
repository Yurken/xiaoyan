import { useEffect, useState } from "react";
import type { ChatMode } from "@research-copilot/types";

const STORAGE_KEY = "rc_copilot_chat_mode";

function readStoredChatMode(): ChatMode {
  if (typeof window === "undefined") {
    return "direct";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "task" ? "task" : "direct";
}

export function useCopilotChatMode() {
  const [chatMode, setChatMode] = useState<ChatMode>(readStoredChatMode);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, chatMode);
  }, [chatMode]);

  return {
    chatMode,
    setChatMode,
  };
}
