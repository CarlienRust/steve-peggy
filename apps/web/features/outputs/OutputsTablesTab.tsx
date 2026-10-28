"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { TableEditorDialog } from "@/features/outputs/TableEditorDialog";
import { extractHtmlTables } from "@/lib/extractHtmlTables";
import { peggyApi, queryKeys } from "@/lib/api";
import type { OutputTableDraft } from "@/lib/studyDesign";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { useWorkspace } from "@/lib/workspaceContext";

export function OutputsTablesTab() {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, commitSection } = useStudyDesign(activeWorkspace?.id);
  const outputs = studyDesign.outputs ?? {};
  const tables = outputs.tables ?? [];

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<OutputTableDraft | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const findings = useQuery({
    queryKey: queryKeys.corpus("own_findings", activeWorkspace?.id),
    queryFn: () => peggyApi.listCorpus("own_findings", activeWorkspace?.id),
    enabled: !!activeWorkspace?.id,
  });

  const importHtml = useMutation({
    mutationFn: async () => {
      const papers = findings.data?.papers ?? [];
      if (!papers.length) throw new Error("Upload HTML or PDF findings first.");
      const imported: OutputTableDraft[] = [];
      for (const paper of papers) {
        if (!paper.id) continue;
        const res = await peggyApi.getPaperText(paper.id);
        const text = res.text ?? "";
        if (!text.toLowerCase().includes("<table")) continue;
        const parsed = extractHtmlTables(text, paper.title ?? "Findings table");
        for (const p of parsed) {
          imported.push({
            id: crypto.randomUUID(),
            title: p.title,
            headers: p.headers,
            rows: p.rows,
            sourcePaperId: paper.id,
            sourceLabel: paper.title,
            createdAt: new Date().toISOString(),
          });
        }
      }
      if (!imported.length) throw new Error("No HTML tables found in uploaded findings text.");
      return imported;
    },
    onSuccess: async (imported) => {
      const next = [...imported, ...tables];
      await commitSection("outputs", { ...outputs, tables: next });
      setImportMsg(`Added ${imported.length} table(s) from findings uploads.`);
    },
  });

  const persistTables = async (next: OutputTableDraft[]) => {
    await commitSection("outputs", { ...outputs, tables: next });
  };

  const onSaveTable = async (
    draft: Omit<OutputTableDraft, "id" | "createdAt"> & { id?: string; createdAt?: string }
  ) => {
    const now = new Date().toISOString();
    if (draft.id) {
      const next = tables.map((t) =>
        t.id === draft.id
          ? {
              ...t,
              title: draft.title,
              headers: draft.headers,
              rows: draft.rows,
              footnotes: draft.footnotes,
            }
          : t
      );
      await persistTables(next);
      return;
    }
    const row: OutputTableDraft = {
      id: crypto.randomUUID(),
      createdAt: now,
      title: draft.title,
      headers: draft.headers,
      rows: draft.rows,
      footnotes: draft.footnotes,
      sourcePaperId: draft.sourcePaperId,
      sourceLabel: draft.sourceLabel,
    };
    await persistTables([row, ...tables]);
  };

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to manage output tables.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          variant="contained"
          sx={{ textTransform: "none" }}
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          Create table
        </Button>
        <Button
          variant="outlined"
          disabled={importHtml.isPending || !findings.data?.papers?.length}
          sx={{ textTransform: "none" }}
          onClick={() => importHtml.mutate()}
        >
          {importHtml.isPending ? <CircularProgress size={20} /> : "Import from findings HTML"}
        </Button>
      </Stack>

      {importHtml.isError && <Alert severity="error">{(importHtml.error as Error).message}</Alert>}
      {importMsg && (
        <Alert severity="success" onClose={() => setImportMsg(null)}>
          {importMsg}
        </Alert>
      )}

      {tables.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="body2" color="text.secondary">
            No tables yet. Create one manually or import from HTML findings uploads.
          </Typography>
        </Paper>
      ) : (
        tables.map((t) => (
          <Paper key={t.id} variant="outlined" sx={{ p: 2, overflow: "auto" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
              <BoxMeta table={t} />
              <Stack direction="row">
                <IconButton
                  size="small"
                  aria-label="Edit table"
                  onClick={() => {
                    setEditing(t);
                    setEditorOpen(true);
                  }}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Delete table"
                  onClick={() => void persistTables(tables.filter((x) => x.id !== t.id))}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {t.headers.map((h) => (
                    <TableCell key={h}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {t.rows.map((row, i) => (
                  <TableRow key={i}>
                    {t.headers.map((_, ci) => (
                      <TableCell key={ci}>{row[ci] ?? ""}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {t.footnotes ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                {t.footnotes}
              </Typography>
            ) : null}
          </Paper>
        ))
      )}

      <TableEditorDialog open={editorOpen} initial={editing} onClose={() => setEditorOpen(false)} onSave={onSaveTable} />
    </Stack>
  );
}

function BoxMeta({ table }: { table: OutputTableDraft }) {
  return (
    <Stack spacing={0.25}>
      <Typography fontWeight={600}>{table.title}</Typography>
      {table.sourceLabel ? (
        <Typography variant="caption" color="text.secondary">
          From {table.sourceLabel}
        </Typography>
      ) : null}
    </Stack>
  );
}
