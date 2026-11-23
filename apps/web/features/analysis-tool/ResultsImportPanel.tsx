"use client";

import { Alert, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { parseImportedResults } from "@/lib/analysis/importResults";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function ResultsImportPanel({
  onSave,
}: {
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography fontWeight={600}>Import class D results</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Paste JSON written by export_for_peggy(). Participant tables are refused.
      </Typography>
      <TextField
        multiline
        minRows={4}
        fullWidth
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"schema":"ols-coefficients-v1","n":20,"coefficients":[]}'
      />
      {error ? <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert> : null}
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button
          variant="outlined"
          onClick={() => {
            const parsed = parseImportedResults(text);
            if (!parsed.ok) {
              setError(parsed.error);
              setPreview(null);
              return;
            }
            setError(null);
            setPreview(JSON.stringify(parsed.data.payload, null, 2).slice(0, 1200));
            setPending(parsed.data.payload);
          }}
        >
          Preview
        </Button>
      </Stack>
      <ConfirmDialog
        open={!!pending}
        title="Save imported aggregates?"
        body={`Class D only. Preview:\n${(preview || "").slice(0, 800)}`}
        confirmLabel="Save"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) onSave(pending);
          setPending(null);
        }}
      />
    </Paper>
  );
}
