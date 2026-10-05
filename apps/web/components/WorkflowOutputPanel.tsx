"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { WorkflowResults } from "@/components/WorkflowResults";
import { SourceCards } from "@/components/SourceCards";
import type { SourceCitation } from "@/lib/api";

type WorkflowOutputPanelProps = {
  mode: string;
  title?: string;
  body: Record<string, unknown> | null | undefined;
  sources?: SourceCitation[];
  confidence?: string;
  limitations?: string[];
  /** Fresh LLM output not yet written to project */
  hasUnsavedResult?: boolean;
  hasSavedResult?: boolean;
  onSaveResult?: () => void;
  onClearSaved?: () => void;
  saving?: boolean;
  userNotes?: string;
  onUserNotesChange?: (notes: string) => void;
};

export function WorkflowOutputPanel({
  mode,
  title = "Result",
  body,
  sources,
  confidence,
  limitations,
  hasUnsavedResult,
  hasSavedResult,
  onSaveResult,
  onClearSaved,
  saving,
  userNotes,
  onUserNotesChange,
}: WorkflowOutputPanelProps) {
  const [clearOpen, setClearOpen] = useState(false);

  if (!body) return null;

  const showSources = sources && sources.length > 0;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Typography variant="subtitle2">{title}</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {hasUnsavedResult && onSaveResult && (
              <Button size="small" variant="contained" disabled={saving} onClick={onSaveResult}>
                {saving ? "Saving…" : "Save result to project"}
              </Button>
            )}
            {hasSavedResult && onClearSaved && (
              <Button size="small" variant="outlined" color="warning" disabled={saving} onClick={() => setClearOpen(true)}>
                Clear saved result
              </Button>
            )}
          </Stack>
        </Stack>

        {hasUnsavedResult && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            New result — save to keep it after you leave this page.
          </Alert>
        )}
        {!hasUnsavedResult && hasSavedResult && (
          <Typography variant="caption" color="text.secondary">
            Saved to this project.
          </Typography>
        )}

        <WorkflowResults mode={mode} body={body} />

        {showSources && (
          <SourceCards sources={sources} confidence={confidence} limitations={limitations} />
        )}

        {onUserNotesChange && (
          <TextField
            label="Your notes (optional)"
            placeholder="Copy key points here or add your own comments"
            value={userNotes ?? ""}
            onChange={(e) => onUserNotesChange(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            size="small"
            helperText="Saved with the section when you click Save below."
          />
        )}
      </Stack>

      <Dialog open={clearOpen} onClose={() => setClearOpen(false)}>
        <DialogTitle>Clear saved result?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This removes the saved output from the project. Your form fields and plan steps are not affected.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearOpen(false)}>Cancel</Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => {
              setClearOpen(false);
              onClearSaved?.();
            }}
          >
            Clear
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
