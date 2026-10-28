"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { OutputTableDraft } from "@/lib/studyDesign";

type TableEditorDialogProps = {
  open: boolean;
  initial?: OutputTableDraft | null;
  onClose: () => void;
  onSave: (table: Omit<OutputTableDraft, "id" | "createdAt"> & { id?: string; createdAt?: string }) => void;
};

function emptyGrid(cols: number, rows: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
}

export function TableEditorDialog({ open, initial, onClose, onSave }: TableEditorDialogProps) {
  const [title, setTitle] = useState("");
  const [footnotes, setFootnotes] = useState("");
  const [headers, setHeaders] = useState<string[]>(["Column 1", "Column 2"]);
  const [rows, setRows] = useState<string[][]>(emptyGrid(2, 2));

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setFootnotes(initial.footnotes ?? "");
      setHeaders(initial.headers.length ? [...initial.headers] : ["Column 1"]);
      setRows(initial.rows.length ? initial.rows.map((r) => [...r]) : emptyGrid(initial.headers.length || 2, 1));
    } else {
      setTitle("");
      setFootnotes("");
      setHeaders(["Column 1", "Column 2"]);
      setRows(emptyGrid(2, 2));
    }
  }, [open, initial]);

  const syncRowWidths = (nextHeaders: string[], nextRows: string[][]) => {
    const w = nextHeaders.length;
    return nextRows.map((r) => {
      const copy = [...r];
      while (copy.length < w) copy.push("");
      return copy.slice(0, w);
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{initial ? "Edit table" : "New table"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Table title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
          <Typography variant="subtitle2">Headers</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {headers.map((h, i) => (
              <TextField
                key={i}
                size="small"
                label={`Header ${i + 1}`}
                value={h}
                onChange={(e) => {
                  const next = [...headers];
                  next[i] = e.target.value;
                  setHeaders(next);
                  setRows(syncRowWidths(next, rows));
                }}
                sx={{ minWidth: 120 }}
              />
            ))}
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => {
                const next = [...headers, `Column ${headers.length + 1}`];
                setHeaders(next);
                setRows(syncRowWidths(next, rows));
              }}
            >
              Column
            </Button>
          </Stack>
          <Typography variant="subtitle2">Rows</Typography>
          {rows.map((row, ri) => (
            <Stack key={ri} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              {headers.map((_, ci) => (
                <TextField
                  key={ci}
                  size="small"
                  label={headers[ci] || `Col ${ci + 1}`}
                  value={row[ci] ?? ""}
                  onChange={(e) => {
                    const next = rows.map((r) => [...r]);
                    next[ri][ci] = e.target.value;
                    setRows(next);
                  }}
                  sx={{ minWidth: 100 }}
                />
              ))}
              <IconButton size="small" aria-label="Remove row" onClick={() => setRows(rows.filter((_, j) => j !== ri))}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setRows([...rows, Array.from({ length: headers.length }, () => "")])}
            sx={{ alignSelf: "flex-start", textTransform: "none" }}
          >
            Add row
          </Button>
          <TextField
            label="Footnotes (optional)"
            value={footnotes}
            onChange={(e) => setFootnotes(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!title.trim()}
          onClick={() => {
            onSave({
              id: initial?.id,
              createdAt: initial?.createdAt,
              title: title.trim(),
              headers,
              rows,
              footnotes: footnotes.trim() || undefined,
              sourcePaperId: initial?.sourcePaperId,
              sourceLabel: initial?.sourceLabel,
            });
            onClose();
          }}
        >
          Save table
        </Button>
      </DialogActions>
    </Dialog>
  );
}
