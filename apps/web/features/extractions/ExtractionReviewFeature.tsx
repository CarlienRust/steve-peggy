"use client";

import { Alert } from "@mui/material";
import { ExtractionPaperPanel } from "@/features/extractions/ExtractionPaperPanel";
import { useWorkspace } from "@/lib/workspaceContext";

export function ExtractionReviewFeature({ initialPaperId }: { initialPaperId?: number | null }) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  if (!workspaceId) {
    return <Alert severity="info">Select a project to review extractions.</Alert>;
  }

  if (initialPaperId == null || initialPaperId <= 0) {
    return <Alert severity="info">Choose a paper on Literature search.</Alert>;
  }

  return <ExtractionPaperPanel workspaceId={workspaceId} paperId={initialPaperId} />;
}
