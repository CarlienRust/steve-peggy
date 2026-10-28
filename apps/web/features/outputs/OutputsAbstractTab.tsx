"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { WorkflowOutputPanel } from "@/components/WorkflowOutputPanel";
import { formatApiError, peggyApi } from "@/lib/api";
import { hasAbstractSections, normalizeWorkflowBody } from "@/lib/normalizeWorkflowBody";
import type { AbstractDraft } from "@/lib/studyDesign";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { useWorkspace } from "@/lib/workspaceContext";

export function OutputsAbstractTab() {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, commitSection, savingSection } = useStudyDesign(activeWorkspace?.id);
  const outputs = studyDesign.outputs ?? {};
  const drafts = outputs.abstractDrafts ?? [];
  const [minWords, setMinWords] = useState(250);
  const [selectedId, setSelectedId] = useState<string | null>(outputs.activeAbstractId ?? drafts[0]?.id ?? null);

  const selected = useMemo(
    () => drafts.find((d) => d.id === selectedId) ?? drafts[0] ?? null,
    [drafts, selectedId]
  );
  const body = normalizeWorkflowBody(selected?.body);

  const generate = useMutation({
    mutationFn: () => peggyApi.conferenceAbstract(activeWorkspace!.id, minWords),
    onSuccess: async (data) => {
      const normalized = normalizeWorkflowBody(data.body as Record<string, unknown>);
      if (!normalized || !hasAbstractSections(normalized)) return;
      const label = `Version ${drafts.length + 1}`;
      const draft: AbstractDraft = {
        id: crypto.randomUUID(),
        label,
        createdAt: new Date().toISOString(),
        minWords,
        body: normalized,
      };
      const nextDrafts = [draft, ...drafts];
      await commitSection("outputs", {
        ...outputs,
        abstractDrafts: nextDrafts,
        activeAbstractId: draft.id,
      });
      setSelectedId(draft.id);
    },
  });

  const removeDraft = async (id: string) => {
    const next = drafts.filter((d) => d.id !== id);
    const nextActive = selectedId === id ? next[0]?.id : selectedId;
    await commitSection("outputs", {
      ...outputs,
      abstractDrafts: next,
      activeAbstractId: nextActive ?? undefined,
    });
    setSelectedId(nextActive ?? null);
  };

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to draft abstracts.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
          Each generate creates a new version you can compare. Versions are saved on this project.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-end" }}>
          <TextField
            label="Minimum words"
            type="number"
            size="small"
            value={minWords}
            onChange={(e) => setMinWords(Math.max(100, Math.min(600, Number(e.target.value) || 250)))}
            inputProps={{ min: 100, max: 600, step: 25 }}
            sx={{ width: { sm: 160 } }}
          />
          <Button
            variant="contained"
            disabled={generate.isPending || savingSection === "outputs"}
            onClick={() => generate.mutate()}
            sx={{ textTransform: "none" }}
          >
            {generate.isPending ? <CircularProgress size={22} color="inherit" /> : "Generate new version"}
          </Button>
        </Stack>
        {generate.isError && <Alert severity="error" sx={{ mt: 2 }}>{formatApiError(generate.error)}</Alert>}
      </Paper>

      {drafts.length > 0 ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          {drafts.map((d) => (
            <Chip
              key={d.id}
              label={`${d.label} · ${new Date(d.createdAt).toLocaleDateString()}`}
              variant={d.id === selected?.id ? "filled" : "outlined"}
              color={d.id === selected?.id ? "primary" : "default"}
              onClick={() => setSelectedId(d.id)}
              onDelete={drafts.length > 1 ? () => void removeDraft(d.id) : undefined}
              deleteIcon={<DeleteOutlineIcon />}
            />
          ))}
        </Stack>
      ) : (
        <Alert severity="info">No abstract versions yet. Click Generate new version.</Alert>
      )}

      {body && hasAbstractSections(body) && selected ? (
        <WorkflowOutputPanel
          mode="conference_abstract"
          title={selected.label}
          body={body}
          hasUnsavedResult={false}
          hasSavedResult
        />
      ) : null}
    </Stack>
  );
}
