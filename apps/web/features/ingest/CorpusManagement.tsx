"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { peggyApi, queryKeys, type PaperRecord } from "@/lib/api";
import { monoSx } from "@/theme/peggyTheme";
import { IngestModal } from "@/features/ingest/IngestModal";

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export function CorpusManagement() {
  const [ingestOpen, setIngestOpen] = useState(false);
  const [viewPaper, setViewPaper] = useState<PaperRecord | null>(null);
  const [editPaper, setEditPaper] = useState<PaperRecord | null>(null);
  const [deletePaper, setDeletePaper] = useState<PaperRecord | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<PaperRecord>>({});
  const queryClient = useQueryClient();

  const corpus = useQuery({ queryKey: queryKeys.corpus(), queryFn: () => peggyApi.listCorpus() });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PaperRecord> }) => peggyApi.updatePaper(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.corpus() });
      setEditPaper(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => peggyApi.deletePaper(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.corpus() });
      setDeletePaper(null);
    },
  });

  const openEdit = (p: PaperRecord) => {
    setEditPaper(p);
    setEditDraft({
      title: p.title ?? "",
      authors: p.authors ?? "",
      year: p.year ?? "",
      pmid: p.pmid ?? "",
      doi: p.doi ?? "",
      source_type: p.source_type ?? "literature",
    });
  };

  const papers = corpus.data?.papers ?? [];

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography sx={{ ...monoSx, fontSize: 12, color: "text.secondary" }}>
          {corpus.data?.count ?? 0} item{(corpus.data?.count ?? 0) === 1 ? "" : "s"} in corpus
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIngestOpen(true)}>
          Add to corpus
        </Button>
      </Stack>

      {corpus.isError && <Alert severity="error">Could not load corpus. Is the API running?</Alert>}

      <Paper variant="outlined" sx={{ overflow: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Year</TableCell>
              <TableCell>Ingested</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {papers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No papers yet. Use &quot;Add to corpus&quot; to ingest PubMed IDs, PDFs, or internal findings.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              papers.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <Typography variant="body2" noWrap title={p.title ?? "Untitled"}>
                      {p.title ?? "Untitled"}
                    </Typography>
                    {p.pmid && (
                      <Typography variant="caption" color="text.secondary" sx={monoSx}>
                        PMID {p.pmid}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={p.source_type === "own_findings" ? "Internal" : "Literature"}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{p.year || "—"}</TableCell>
                  <TableCell>{formatDate(p.ingested_at)}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" aria-label="View" onClick={() => setViewPaper(p)}>
                      <VisibilityOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label="Edit" onClick={() => openEdit(p)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label="Delete" onClick={() => setDeletePaper(p)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      <IngestModal
        open={ingestOpen}
        onClose={() => setIngestOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.corpus() });
        }}
      />

      <Dialog open={!!viewPaper} onClose={() => setViewPaper(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Corpus item</DialogTitle>
        <DialogContent>
          {viewPaper && (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Field label="Title" value={viewPaper.title} />
              <Field label="Authors" value={viewPaper.authors} />
              <Field label="Year" value={viewPaper.year} />
              <Field label="PMID" value={viewPaper.pmid} />
              <Field label="DOI" value={viewPaper.doi} />
              <Field label="Type" value={viewPaper.source_type} />
              <Field label="Ingested" value={formatDate(viewPaper.ingested_at)} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewPaper(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editPaper} onClose={() => setEditPaper(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit corpus item</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Title"
              value={editDraft.title ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Authors"
              value={editDraft.authors ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, authors: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Year"
              value={editDraft.year ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, year: e.target.value }))}
              fullWidth
            />
            <TextField
              label="PMID"
              value={editDraft.pmid ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, pmid: e.target.value }))}
              fullWidth
            />
            <TextField
              label="DOI"
              value={editDraft.doi ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, doi: e.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditPaper(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!editPaper?.id || updateMut.isPending}
            onClick={() => editPaper?.id && updateMut.mutate({ id: editPaper.id, data: editDraft })}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deletePaper} onClose={() => setDeletePaper(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete from corpus?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Remove <strong>{deletePaper?.title ?? "this item"}</strong> from the catalog. Vector chunks in Qdrant are
            not removed yet (stub).
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletePaper(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!deletePaper?.id || deleteMut.isPending}
            onClick={() => deletePaper?.id && deleteMut.mutate(deletePaper.id)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value || "—"}</Typography>
    </Box>
  );
}
