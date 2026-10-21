"use client";

import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";
import type { WorkspaceObjective } from "@/lib/objectives";

export type SetupPrivacyMode = "local_only" | "hosted_allowed";
export type SetupStartMode = "idea" | "gap" | "resources";

export type SetupState = {
  start_mode?: SetupStartMode;
  title: string;
  aim: string;
  objectives: WorkspaceObjective[];
  resources: Record<string, unknown>;
  settings: Record<string, unknown>;
  enabled_modules: string[];
  privacy_mode: SetupPrivacyMode;
};

const SetupStateContext = createContext<{
  state: SetupState;
  setState: (patch: Partial<SetupState>) => void;
  reset: () => void;
} | null>(null);

const DEFAULT_STATE: SetupState = {
  title: "",
  aim: "",
  objectives: [],
  resources: {},
  settings: {},
  enabled_modules: ["core"],
  privacy_mode: "local_only",
};

export function SetupStateProvider({ children }: PropsWithChildren) {
  const [state, setRawState] = useState<SetupState>(DEFAULT_STATE);
  const api = useMemo(() => {
    return {
      state,
      setState: (patch: Partial<SetupState>) => setRawState((s) => ({ ...s, ...patch })),
      reset: () => setRawState(DEFAULT_STATE),
    };
  }, [state]);
  return <SetupStateContext.Provider value={api}>{children}</SetupStateContext.Provider>;
}

export function useSetupState() {
  const ctx = useContext(SetupStateContext);
  if (!ctx) throw new Error("useSetupState must be used within SetupStateProvider");
  return ctx;
}

