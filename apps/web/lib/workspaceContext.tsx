"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { peggyApi, queryKeys } from "@/lib/api";
import { loadActiveWorkspaceId, saveActiveWorkspaceId, type Workspace } from "@/lib/userProfile";

type WorkspaceContextValue = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: string) => void;
  isLoading: boolean;
  refetch: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    setActiveIdState(loadActiveWorkspaceId());
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: () => peggyApi.listWorkspaces(),
  });

  const workspaces = data?.workspaces ?? [];

  useEffect(() => {
    if (!workspaces.length) return;
    const stored = loadActiveWorkspaceId();
    const valid = stored && workspaces.some((w) => w.id === stored);
    if (!valid) {
      const first = workspaces[0].id;
      saveActiveWorkspaceId(first);
      setActiveIdState(first);
    }
  }, [workspaces]);

  const setActiveWorkspaceId = useCallback(
    (id: string) => {
      saveActiveWorkspaceId(id);
      setActiveIdState(id);
    },
    []
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? null,
    [workspaces, activeId]
  );

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      setActiveWorkspaceId,
      isLoading,
      refetch: () => {
        void refetch();
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      },
    }),
    [workspaces, activeWorkspace, setActiveWorkspaceId, isLoading, refetch, queryClient]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
