"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Box, Button, IconButton, Stack, TextField, Typography } from "@mui/material";
import { ObjectiveLinkSelect } from "@/components/ObjectiveLinkSelect";
import { linkTargetOptions, type WorkspaceObjective } from "@/lib/objectives";
import type { PlanStep } from "@/lib/studyDesign";

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

export function PlanStepsEditor({ steps, aim, objectives, onChange, disabled }: PlanStepsEditorProps) {
  const options = linkTargetOptions(aim, objectives);

  const updateAt = (index: number, patch: Partial<PlanStep>) => {
    onChange(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  };

  const removeAt = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">Steps</Typography>
      <Typography variant="body2" color="text.secondary">
        Break the plan into steps and link each step to the aim or specific objectives.
      </Typography>
      {steps.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No steps yet.
        </Typography>
      )}
      {steps.map((step, index) => (
        <Box
          key={step.id}
          sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                label={`Step ${index + 1}`}
                value={step.title}
                onChange={(e) => updateAt(index, { title: e.target.value })}
                fullWidth
                disabled={disabled}
              />
              <IconButton aria-label="Remove step" disabled={disabled} onClick={() => removeAt(index)} sx={{ mt: 0.5 }}>
                <DeleteOutlineIcon />
              </IconButton>
            </Stack>
            <ObjectiveLinkSelect
              options={options}
              value={step.objectiveIds}
              onChange={(ids) => updateAt(index, { objectiveIds: ids })}
              disabled={disabled}
            />
          </Stack>
        </Box>
      ))}
      <Button
        startIcon={<AddIcon />}
        onClick={() => onChange([...steps, newStep()])}
        disabled={disabled}
        sx={{ alignSelf: "flex-start", textTransform: "none" }}
      >
        Add step
      </Button>
    </Stack>
  );
}
