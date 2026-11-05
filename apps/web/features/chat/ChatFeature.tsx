"use client";

import { Alert } from "@mui/material";
import { HomeAskPeggyFeature } from "@/features/chat/HomeAskPeggyFeature";
import { useWorkspace } from "@/lib/workspaceContext";

export function ChatFeature() {
  const { activeWorkspace } = useWorkspace();
  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to ask Peggy.</Alert>;
  }
  return <HomeAskPeggyFeature lockedWorkspaceId={activeWorkspace.id} projectExtras />;
}
