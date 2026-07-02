"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/lib/authContext";
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
  const { ready, userId } = useAuthSession();
  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setActiveIdState(loadActiveWorkspaceId());
  }, [ready, userId]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.workspaces(userId ?? undefined),
    queryFn: () => peggyApi.listWorkspaces(),
    enabled: ready && !!userId,
  });

  const workspaces = data?.workspaces ?? [];

  useEffect(() => {
    if (!ready || !userId || isLoading) return;
    if (!activeId) return;
    if (!workspaces.some((workspace) => workspace.id === activeId)) {
      saveActiveWorkspaceId(null);
      setActiveIdState(null);
    }
  }, [ready, userId, isLoading, activeId, workspaces]);

  const setActiveWorkspaceId = useCallback((id: string) => {
    saveActiveWorkspaceId(id);
    setActiveIdState(id);
  }, []);

  const activeWorkspace = useMemo(
    () => (activeId ? workspaces.find((w) => w.id === activeId) ?? null : null),
    [workspaces, activeId]
  );

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      setActiveWorkspaceId,
      isLoading: !ready || isLoading,
      refetch: () => {
        void refetch();
        if (userId) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
        }
      },
    }),
    [workspaces, activeWorkspace, setActiveWorkspaceId, ready, isLoading, refetch, queryClient, userId]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
