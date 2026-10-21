"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { peggyApi, queryKeys, type ExtractionRecord, type PaperRecord } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";

function statusTone(status: ExtractionRecord["status"]) {
  if (status === "confirmed") return "success" as const;
  if (status === "corrected") return "warning" as const;
  return "default" as const;
}

export function ExtractionReviewFeature({ initialPaperId }: { initialPaperId?: number | null }) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const queryClient = useQueryClient();
  const [paperId, setPaperId] = useState<number | "">(() => (initialPaperId != null ? initialPaperId : ""));
  const [moduleId, setModuleId] = useState<string>("core");
  const [edit, setEdit] = useState<ExtractionRecord | null>(null);
  const [draft, setDraft] = useState<{ value: string; source_quote: string; source_page: string; status: "confirmed" | "corrected" }>(
    { value: "", source_quote: "", source_page: "", status: "confirmed" }
  );

  const modules = useQuery({
    queryKey: ["extraction-modules"],
    queryFn: () => peggyApi.listExtractionModules(),
  });

  const corpus = useQuery({
    queryKey: queryKeys.corpus("literature", workspaceId),
    queryFn: () => peggyApi.listCorpus("literature", workspaceId),
    enabled: !!workspaceId,
  });

  const papers = useMemo(() => {
    return (corpus.data?.papers ?? []).filter((p) => p.source_type === "literature" && p.id != null) as PaperRecord[];
  }, [corpus.data]);

  const extractions = useQuery({
    queryKey: ["extractions", workspaceId, paperId, moduleId],
    queryFn: () =>
      peggyApi.listExtractions(workspaceId!, {
        paperId: typeof paperId === "number" ? paperId : undefined,
        module: moduleId,
      }),
    enabled: !!workspaceId && typeof paperId === "number",
  });

  const patchMut = useMutation({
    mutationFn: async (payload: { extractionId: number; patch: { value?: string | null; source_quote?: string | null; source_page?: number | null; status: "confirmed" | "corrected" } }) =>
      peggyApi.patchExtraction(workspaceId!, payload.extractionId, payload.patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["extractions", workspaceId] });
      setEdit(null);
    },
  });

  const openEdit = (row: ExtractionRecord, mode: "confirm" | "correct") => {
    setEdit(row);
    setDraft({
      value: row.value ?? "",
      source_quote: row.source_quote ?? "",
      source_page: row.source_page != null ? String(row.source_page) : "",
      status: mode === "confirm" ? "confirmed" : "corrected",
    });
  };

  if (!workspaceId) {
    return <Alert severity="info">Select a project to review extractions.</Alert>;
  }

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
          <Box sx={{ minWidth: 260, flex: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              Paper
            </Typography>
            <Select fullWidth value={paperId} onChange={(e) => setPaperId(e.target.value as any)} displayEmpty>
              <MenuItem value="">
                <em>Select a paper…</em>
              </MenuItem>
              {papers.map((p) => (
                <MenuItem key={p.id} value={p.id!}>
                  {p.title ?? `Paper ${p.id}`}
                </MenuItem>
              ))}
            </Select>
          </Box>
          <Box sx={{ minWidth: 220 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              Module
            </Typography>
            <Select fullWidth value={moduleId} onChange={(e) => setModuleId(String(e.target.value))}>
              {(modules.data?.modules ?? []).map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.label}
                </MenuItem>
              ))}
            </Select>
          </Box>
        </Stack>
      </Paper>

      {typeof paperId !== "number" ? (
        <Alert severity="info">Choose a paper to see extracted fields.</Alert>
      ) : extractions.isError ? (
        <Alert severity="error">Could not load extractions.</Alert>
      ) : (
        <Paper variant="outlined" sx={{ overflow: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Field</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Quote</TableCell>
                <TableCell>Page</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(extractions.data?.extractions ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No extracted fields yet for this module. Run extraction first from Validate.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (extractions.data?.extractions ?? []).map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.field}</TableCell>
                    <TableCell sx={{ maxWidth: 260 }}>
                      <Typography variant="body2" noWrap title={row.value ?? ""}>
                        {row.value ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 260 }}>
                      <Typography variant="body2" noWrap title={row.source_quote ?? ""}>
                        {row.source_quote ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.source_page ?? "—"}</TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={row.status} color={statusTone(row.status)} />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" onClick={() => openEdit(row, "confirm")} sx={{ textTransform: "none" }}>
                        Confirm
                      </Button>
                      <Button size="small" variant="text" onClick={() => openEdit(row, "correct")} sx={{ textTransform: "none", ml: 1 }}>
                        Correct
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={!!edit} onClose={() => setEdit(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Review extraction</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Value" value={draft.value} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))} fullWidth />
            <TextField
              label="Source quote"
              value={draft.source_quote}
              onChange={(e) => setDraft((d) => ({ ...d, source_quote: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Source page"
              value={draft.source_page}
              onChange={(e) => setDraft((d) => ({ ...d, source_page: e.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setEdit(null)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!edit || patchMut.isPending}
            onClick={() =>
              edit &&
              patchMut.mutate({
                extractionId: edit.id,
                patch: {
                  value: draft.value.trim() ? draft.value.trim() : null,
                  source_quote: draft.source_quote.trim() ? draft.source_quote.trim() : null,
                  source_page: draft.source_page.trim() ? Number(draft.source_page) : null,
                  status: draft.status,
                },
              })
            }
            sx={{ textTransform: "none" }}
          >
            {patchMut.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

