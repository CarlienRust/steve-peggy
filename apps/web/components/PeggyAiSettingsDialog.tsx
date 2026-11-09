"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { ChoiceCard } from "@/components/ChoiceCard";
import { TrainingOptOutTable } from "@/components/TrainingOptOutTable";
import { formatApiError, peggyApi, queryKeys } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { useWorkspace } from "@/lib/workspaceContext";

function asMode(raw: string | undefined): "standard" | "strict" {
  if (raw === "strict" || raw === "local_only") return "strict";
  return "standard";
}

export function PeggyAiSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeWorkspace, refetch } = useWorkspace();
  const { userId } = useAuthSession();
  const qc = useQueryClient();
  const [privacy, setPrivacy] = useState<"standard" | "strict">("standard");

  useEffect(() => {
    if (open) setPrivacy(asMode(activeWorkspace?.privacy_mode));
  }, [open, activeWorkspace?.privacy_mode]);

  const save = useMutation({
    mutationFn: () => {
      if (!activeWorkspace) throw new Error("No project selected");
      return peggyApi.updateWorkspace(activeWorkspace.id, { privacy_mode: privacy });
    },
    onSuccess: () => {
      refetch();
      if (userId) void qc.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Peggy AI settings</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {!activeWorkspace ? (
            <Alert severity="info">Open a project first to set Strict or Standard for that project.</Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                This applies to {activeWorkspace.title}. Default is Standard (Ask Peggy on). Platform Gemini stays the
                model until you can link your own key later.
              </Typography>
              <ChoiceCard
                title="Standard (recommended)"
                description="Ask Peggy, planners, and abstracts may send project text to the hosted model. Opt out of training in that provider account."
                selected={privacy === "standard"}
                onSelect={() => setPrivacy("standard")}
                tag={{ label: "Hosted AI", tone: "warning" }}
              />
              <ChoiceCard
                title="Strict (AI help off)"
                description="Peggy will not send this project's aim, plans, findings, chat, or dataset summaries to a hosted model. Literature search and saved records still work."
                selected={privacy === "strict"}
                onSelect={() => setPrivacy("strict")}
                tag={{ label: "No project AI", tone: "neutral" }}
              />
              {privacy === "standard" ? <TrainingOptOutTable /> : null}
            </>
          )}
          {save.isError ? <Alert severity="error">{formatApiError(save.error)}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Close
        </Button>
        <Button
          variant="contained"
          disabled={!activeWorkspace || save.isPending}
          onClick={() => save.mutate()}
          sx={{ textTransform: "none" }}
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
