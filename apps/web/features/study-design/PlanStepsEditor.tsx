"use client";

import { useState } from "react";
import { Box, Button, IconButton, Stack, TextField, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { ObjectiveLinkSelect } from "@/components/ObjectiveLinkSelect";
import { StatusChip } from "@/components/StatusChip";
import { AIM_LINK_ID, linkTargetOptions, type WorkspaceObjective } from "@/lib/objectives";
import type { PlanStep } from "@/lib/studyDesign";
import { peggyColors } from "@/theme/peggyTheme";

function newStep(): PlanStep {
  return { id: crypto.randomUUID(), title: "", objectiveIds: [] };
}

type PlanStepsEditorProps = {
  steps: PlanStep[];
  aim?: string;
  objectives: WorkspaceObjective[];
  onChange: (steps: PlanStep[]) => void;
  disabled?: boolean;
};

function chipLabel(id: string, objectives: WorkspaceObjective[]) {
  if (id === AIM_LINK_ID) return "Aim";
  const idx = objectives.findIndex((o) => o.id === id);
  return idx >= 0 ? `O${idx + 1}` : "Linked";
}

export function PlanStepsEditor({ steps, aim, objectives, onChange, disabled }: PlanStepsEditorProps) {
  const options = linkTargetOptions(aim, objectives);
  const [editingId, setEditingId] = useState<string | null>(null);

  const updateAt = (index: number, patch: Partial<PlanStep>) => {
    onChange(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  };

  const removeAt = (index: number) => {
    const id = steps[index]?.id;
    onChange(steps.filter((_, i) => i !== index));
    if (id && editingId === id) setEditingId(null);
  };

  return (
    <Stack spacing={0.5} sx={{ width: "100%" }}>
      {steps.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          No steps yet.
        </Typography>
      )}
      {steps.map((step, index) => {
        const changed = Array.isArray(step.objectiveChangedObjectiveIds) && step.objectiveChangedObjectiveIds.length > 0;
        const editing = editingId === step.id;
        const links = step.objectiveIds ?? [];
        return (
          <Box key={step.id} sx={{ borderBottom: `0.5px solid ${peggyColors.border}` }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ minHeight: 52, py: 1, px: 1 }}>
              <Typography sx={{ fontFamily: "var(--font-jetbrains), ui-monospace, monospace", fontSize: 11, color: peggyColors.accent, width: 24, flexShrink: 0 }}>
                {index + 1}
              </Typography>
              {editing ? (
                <TextField
                  value={step.title}
                  onChange={(e) => updateAt(index, { title: e.target.value })}
                  placeholder="Describe this step"
                  fullWidth
                  size="small"
                  disabled={disabled}
                />
              ) : (
                <Typography fontWeight={500} sx={{ flex: 1, minWidth: 0 }}>
                  {step.title.trim() || "Untitled step"}
                </Typography>
              )}
              <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ width: 230, flexShrink: 0, flexWrap: "wrap" }}>
                {links.length === 0 ? (
                  <StatusChip tone="neutral" label="Not linked" />
                ) : (
                  links.map((id) => (
                    <StatusChip key={id} tone={id === AIM_LINK_ID ? "neutral" : "accent"} label={chipLabel(id, objectives)} />
                  ))
                )}
                {changed ? (
                  <StatusChip
                    tone="warning"
                    label="Objective changed"
                    sx={{ bgcolor: peggyColors.warning, color: peggyColors.foreground, borderColor: "transparent" }}
                  />
                ) : null}
              </Stack>
              <Button
                variant="text"
                disabled={disabled}
                onClick={() => setEditingId(editing ? null : step.id)}
                sx={{ textTransform: "none", color: peggyColors.accent, flexShrink: 0 }}
              >
                {editing ? "Done" : "Edit"}
              </Button>
            </Stack>
            {editing && (
              <Stack spacing={1.5} sx={{ px: 1, pb: 1.5, pl: 6 }}>
                <ObjectiveLinkSelect
                  options={options}
                  value={step.objectiveIds}
                  onChange={(ids) => updateAt(index, { objectiveIds: ids })}
                  disabled={disabled}
                />
                <IconButton aria-label="Remove step" disabled={disabled} onClick={() => removeAt(index)} sx={{ alignSelf: "flex-start" }}>
                  <DeleteOutlineIcon />
                </IconButton>
              </Stack>
            )}
          </Box>
        );
      })}
      <Button
        variant="outlined"
        onClick={() => {
          const next = newStep();
          onChange([...steps, next]);
          setEditingId(next.id);
        }}
        disabled={disabled}
        sx={{ alignSelf: "flex-start", textTransform: "none", mt: 1 }}
      >
        Add step
      </Button>
    </Stack>
  );
}
