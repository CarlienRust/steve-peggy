"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
import { peggyApi, type ExtractionRecord } from "@/lib/api";
import { monoSx, peggyColors } from "@/theme/peggyTheme";

function statusTone(status: ExtractionRecord["status"]) {
  if (status === "confirmed") return "success" as const;
  if (status === "corrected") return "warning" as const;
  return "default" as const;
}

export function ExtractionPaperPanel({
  workspaceId,
  paperId,
  paperTitle,
  compact,
}: {
  workspaceId: string;
  paperId: number;
  paperTitle?: string;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const [moduleId, setModuleId] = useState<string>("core");
  const [edit, setEdit] = useState<ExtractionRecord | null>(null);
  const [draft, setDraft] = useState<{ value: string; source_quote: string; source_page: string; status: "confirmed" | "corrected" }>(
    { value: "", source_quote: "", source_page: "", status: "confirmed" }
  );
  const [jobId, setJobId] = useState<string | null>(null);

  const modules = useQuery({
    queryKey: ["extraction-modules"],
    queryFn: () => peggyApi.listExtractionModules(),
  });

  const extractions = useQuery({
    queryKey: ["extractions", workspaceId, paperId, moduleId],
    queryFn: () =>
      peggyApi.listExtractions(workspaceId, {
        paperId,
        module: moduleId,
      }),
    enabled: !!workspaceId && paperId > 0,
  });

  const jobQuery = useQuery({
    queryKey: ["extraction-job", jobId],
    queryFn: () => peggyApi.getExtractionJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const st = q.state.data?.status;
      if (st === "completed" || st === "failed") return false;
      return 1500;
    },
  });

  useEffect(() => {
    const st = jobQuery.data?.status;
    if (st === "completed" || st === "failed") {
      void queryClient.invalidateQueries({ queryKey: ["extractions", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-papers-summary", workspaceId] });
      if (st === "completed") setJobId(null);
    }
  }, [jobQuery.data?.status, queryClient, workspaceId]);

  const runExtract = useMutation({
    mutationFn: () =>
      peggyApi.startExtraction(workspaceId, {
        paperIds: [paperId],
        modules: [moduleId],
        sourceTypes: ["literature"],
      }),
    onSuccess: (data) => setJobId(data.job_id),
  });

  const patchMut = useMutation({
    mutationFn: async (payload: {
      extractionId: number;
      patch: { value?: string | null; source_quote?: string | null; source_page?: number | null; status: "confirmed" | "corrected" };
    }) => peggyApi.patchExtraction(workspaceId, payload.extractionId, payload.patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["extractions", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-papers-summary", workspaceId] });
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

  const jobRunning = runExtract.isPending || (!!jobId && jobQuery.data?.status !== "completed" && jobQuery.data?.status !== "failed");

  return (
    <Stack spacing={2} sx={{ height: "100%" }}>
      <Box>
        <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent, mb: 0.5 }}>
          EXTRACTION
        </Typography>
        <Typography fontWeight={600} sx={{ mb: 0.5, lineHeight: 1.4 }}>
          {paperTitle ?? `Paper ${paperId}`}
        </Typography>
        {!compact ? (
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Review extracted fields. Confirm or correct before using coverage and gap analysis.
          </Typography>
        ) : null}
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
        <Select
          size="small"
          value={moduleId}
          onChange={(e) => setModuleId(String(e.target.value))}
          sx={{ minWidth: 160 }}
        >
          {(modules.data?.modules ?? []).map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.label}
            </MenuItem>
          ))}
        </Select>
        <Button
          variant="contained"
          size="small"
          disabled={jobRunning}
          onClick={() => runExtract.mutate()}
          sx={{ textTransform: "none" }}
        >
          {jobRunning ? <CircularProgress size={20} color="inherit" /> : "Run extraction"}
        </Button>
      </Stack>

      {runExtract.isError ? <Alert severity="error">Could not start extraction job.</Alert> : null}
      {jobQuery.data?.status === "failed" ? (
        <Alert severity="error">Extraction job failed. Check that a PDF is ingested for this paper.</Alert>
      ) : null}

      {extractions.isError ? (
        <Alert severity="error">Could not load extractions.</Alert>
      ) : (
        <Paper variant="outlined" sx={{ overflow: "auto", flex: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Field</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(extractions.data?.extractions ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No fields yet. Run extraction after ingesting the full PDF.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (extractions.data?.extractions ?? []).map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ ...monoSx, fontSize: 11 }}>{row.field}</TableCell>
                    <TableCell sx={{ maxWidth: compact ? 140 : 220 }}>
                      <Typography variant="body2" noWrap title={row.value ?? ""}>
                        {row.value ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={row.status} color={statusTone(row.status)} />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Button size="small" variant="outlined" onClick={() => openEdit(row, "confirm")} sx={{ textTransform: "none" }}>
                        Confirm
                      </Button>
                      <Button size="small" variant="text" onClick={() => openEdit(row, "correct")} sx={{ textTransform: "none" }}>
                        Edit
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
