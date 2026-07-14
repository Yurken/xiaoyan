import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_MODULE_VISIBILITY,
  MODULE_VISIBILITY_CHANGE_EVENT,
  MODULE_VISIBILITY_STORAGE_KEY,
  persistModuleVisibility,
  readModuleVisibility,
  type ExperimentModuleKey,
  type ModuleGroupKey,
  type ModuleVisibilityConfig,
  type ToolModuleKey,
} from "./shared";

type ModuleKeyForGroup<T extends ModuleGroupKey> = T extends "experiment"
  ? ExperimentModuleKey
  : ToolModuleKey;

export function useModuleVisibility() {
  const [config, setConfig] = useState<ModuleVisibilityConfig>(() => readModuleVisibility());

  useEffect(() => {
    const sync = () => setConfig(readModuleVisibility());
    const syncCustom = (event: Event) => {
      const next = (event as CustomEvent<ModuleVisibilityConfig>).detail;
      setConfig(next ?? readModuleVisibility());
    };
    window.addEventListener("storage", sync);
    window.addEventListener(MODULE_VISIBILITY_CHANGE_EVENT, syncCustom);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(MODULE_VISIBILITY_CHANGE_EVENT, syncCustom);
    };
  }, []);

  const toggle = useCallback(<T extends ModuleGroupKey>(group: T, key: ModuleKeyForGroup<T>) => {
    setConfig((current) => {
      const currentGroup = current[group] as Record<string, boolean>;
      const nextValue = !currentGroup[key];
      if (!nextValue && Object.entries(currentGroup).filter(([itemKey, visible]) => itemKey !== key && visible).length === 0) {
        return current;
      }
      const next = {
        ...current,
        [group]: { ...currentGroup, [key]: nextValue },
      } as ModuleVisibilityConfig;
      persistModuleVisibility(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    persistModuleVisibility(DEFAULT_MODULE_VISIBILITY);
    setConfig(DEFAULT_MODULE_VISIBILITY);
  }, []);

  return { config, toggle, reset };
}

export { MODULE_VISIBILITY_STORAGE_KEY };
