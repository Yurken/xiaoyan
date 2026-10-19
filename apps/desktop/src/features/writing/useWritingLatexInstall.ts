import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { formatErrorMessage, writingApi } from "../../lib/client";
import { LATEX_INSTALL_SUPPORT } from "./shared";

interface InstallScope {
  draftId: string;
}

interface InstallLifetime {
  scope: InstallScope;
}

type InstallAction = "installer" | "guide";

interface InstallRequest {
  lifetime: InstallLifetime;
}

interface UseWritingLatexInstallOptions {
  draftId: string;
  onMessage: (message: string) => void;
  onError: (error: string) => void;
  clearStatus: () => void;
}

/** Native open requests outlive draft navigation; their feedback does not. */
export function useWritingLatexInstall({
  draftId,
  onMessage,
  onError,
  clearStatus,
}: UseWritingLatexInstallOptions) {
  const [storedScope, setStoredScope] = useState<InstallScope>(() => ({ draftId }));
  let scope = storedScope;
  if (storedScope.draftId !== draftId) {
    scope = { draftId };
    setStoredScope(scope);
  }
  const activeLifetime = useRef<InstallLifetime | null>(null);
  const pending = useRef<Partial<Record<InstallAction, InstallRequest>>>({});
  const [latexInstallerStatus, setLatexInstallerStatus] = useState<"idle" | "opening">("idle");

  useLayoutEffect(() => {
    // Publish only a committed visit. StrictMode cleanup/setup creates a new
    // lifetime even when the draft id and scope object have not changed.
    const lifetime: InstallLifetime = { scope };
    activeLifetime.current = lifetime;
    setLatexInstallerStatus(pending.current.installer ? "opening" : "idle");
    return () => {
      if (activeLifetime.current === lifetime) activeLifetime.current = null;
      // The OS opener has no cancellation API. Keep its lock until it settles.
    };
  }, [scope]);

  const open = useCallback(async (action: InstallAction) => {
    const lifetime = activeLifetime.current;
    if (!lifetime || lifetime.scope !== scope || pending.current[action]) return;
    const request: InstallRequest = { lifetime };
    // Reserve before setting state: batched clicks must start only one request.
    pending.current[action] = request;
    if (action === "installer") setLatexInstallerStatus("opening");
    const isCurrent = () => activeLifetime.current === request.lifetime;

    try {
      if (action === "installer") clearStatus();
      // A synchronous owner callback can unmount or change the committed visit.
      if (!isCurrent()) return;
      if (action === "installer") await writingApi.openMactexInstaller();
      else await writingApi.openMactexDownloadPage();
      if (!isCurrent()) return;
      onMessage(action === "installer"
        ? LATEX_INSTALL_SUPPORT.installerOpenedMessage ??
          "已打开 LaTeX 安装器，请完成安装后重新编译。"
        : LATEX_INSTALL_SUPPORT.installGuideOpenedMessage);
    } catch (error) {
      if (isCurrent()) onError(formatErrorMessage(error));
    } finally {
      if (pending.current[action] === request) {
        delete pending.current[action];
        // Release the machine-level busy indicator even after draft navigation,
        // but never set React state after this hook has unmounted.
        if (action === "installer" && activeLifetime.current) {
          setLatexInstallerStatus("idle");
        }
      }
    }
  }, [clearStatus, onError, onMessage, scope]);

  const openLatexInstaller = useCallback(() => open("installer"), [open]);
  const openLatexDownloadPage = useCallback(() => open("guide"), [open]);

  return { latexInstallerStatus, openLatexInstaller, openLatexDownloadPage };
}
