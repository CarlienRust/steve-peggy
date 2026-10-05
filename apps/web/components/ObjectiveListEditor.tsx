"use client";

import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { countObjectiveLinkUsage, type StudyDesignData } from "@/lib/studyDesign";
import { newObjective, normalizeObjectives, type WorkspaceObjective } from "@/lib/objectives";

type ObjectiveListEditorProps = {
  value: WorkspaceObjective[];
  onChange: (objectives: WorkspaceObjective[]) => void;
  disabled?: boolean;
  studyDesign?: StudyDesignData;
};

export function ObjectiveListEditor({ value, onChange, disabled, studyDesign }: ObjectiveListEditorProps) {
  const objectives = normalizeObjectives(value);
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);

  const updateAt = (index: number, patch: Partial<WorkspaceObjective>) => {
    const next = objectives.map((obj, i) => (i === index ? { ...obj, ...patch } : obj));
    onChange(next);
  };

  const confirmRemove = () => {
    if (pendingRemoveIndex == null) return;
    onChange(objectives.filter((_, i) => i !== pendingRemoveIndex));
    setPendingRemoveIndex(null);
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...objectives];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  const moveDown = (index: number) => {
    if (index >= objectives.length - 1) return;
    const next = [...objectives];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  };

  const pendingObjective = pendingRemoveIndex != null ? objectives[pendingRemoveIndex] : null;
  const pendingUsage =
    pendingObjective && studyDesign ? countObjectiveLinkUsage(pendingObjective.id, studyDesign) : null;

  return (
    <>
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          Add objectives with stable IDs. Mark complete when done (manual only).
        </Typography>
        {objectives.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No objectives yet.
          </Typography>
        )}
        {objectives.map((obj, index) => (
          <Box
            key={obj.id}
            sx={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: 1,
              alignItems: "flex-start",
              p: 1.5,
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: obj.status === "done" ? "action.hover" : "background.paper",
            }}
          >
            <Stack spacing={0.25} sx={{ pt: 1 }}>
              <IconButton size="small" aria-label="Move up" disabled={disabled || index === 0} onClick={() => moveUp(index)}>
                <DragIndicatorIcon fontSize="small" sx={{ transform: "rotate(90deg)" }} />
              </IconButton>
              <IconButton
                size="small"
                aria-label="Move down"
                disabled={disabled || index === objectives.length - 1}
                onClick={() => moveDown(index)}
              >
                <DragIndicatorIcon fontSize="small" sx={{ transform: "rotate(-90deg)" }} />
              </IconButton>
            </Stack>
            <Stack spacing={1}>
              <TextField
                label={`Objective ${index + 1}`}
                value={obj.text}
                onChange={(e) => updateAt(index, { text: e.target.value })}
                fullWidth
                multiline
                minRows={1}
                disabled={disabled}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={obj.status === "done"}
                    onChange={(e) => updateAt(index, { status: e.target.checked ? "done" : "open" })}
                    disabled={disabled}
                  />
                }
                label={obj.status === "done" ? "Complete" : "Open"}
              />
            </Stack>
            <IconButton
              size="small"
              aria-label="Remove objective"
              disabled={disabled}
              onClick={() => setPendingRemoveIndex(index)}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button
          startIcon={<AddIcon />}
          onClick={() => onChange([...objectives, newObjective("")])}
          disabled={disabled}
          sx={{ alignSelf: "flex-start", textTransform: "none" }}
        >
          Add objective
        </Button>
      </Stack>

      <Dialog open={pendingRemoveIndex != null} onClose={() => setPendingRemoveIndex(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove objective?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            {pendingObjective && (
              <Typography variant="body2" sx={{ mb: 1.5, fontStyle: "italic" }}>
                {pendingObjective.text || "(empty objective)"}
              </Typography>
            )}
            {pendingUsage && pendingUsage.total > 0 ? (
              <>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  This objective is linked to {pendingUsage.methodsSteps} methods step
                  {pendingUsage.methodsSteps === 1 ? "" : "s"},{" "}
                  {pendingUsage.analysisSteps} analysis step{pendingUsage.analysisSteps === 1 ? "" : "s"}, and{" "}
                  {pendingUsage.findings} finding set{pendingUsage.findings === 1 ? "" : "s"}.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  When you save the project, those links will be removed automatically.
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No linked work in methods, analysis, or findings for this objective.
              </Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRemoveIndex(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmRemove}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
