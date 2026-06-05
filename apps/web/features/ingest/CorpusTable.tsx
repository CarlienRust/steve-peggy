"use client";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { peggyApi, queryKeys, type PaperRecord } from "@/lib/api";
import { monoSx } from "@/theme/peggyTheme";

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export function CorpusTable({
  papers,
  emptyMessage,
  typeLabel,
}: {
  papers: PaperRecord[];
  emptyMessage: string;
  typeLabel: (p: PaperRecord) => string;
}) {
  const [viewPaper, setViewPaper] = useState<PaperRecord | null>(null);
  const [editPaper, setEditPaper] = useState<PaperRecord | null>(null);
  const [deletePaper, setDeletePaper] = useState<PaperRecord | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<PaperRecord>>({});
  const queryClient = useQueryClient();

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PaperRecord> }) => peggyApi.updatePaper(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corpus"] });
      setEditPaper(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => peggyApi.deletePaper(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corpus"] });
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
    });
  };

  return (
    <>
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
                    {emptyMessage}
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
                    <Chip label={typeLabel(p)} size="small" variant="outlined" />
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

      <Dialog open={!!viewPaper} onClose={() => setViewPaper(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Item details</DialogTitle>
        <DialogContent>
          {viewPaper && (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Field label="Title" value={viewPaper.title} />
              <Field label="Authors" value={viewPaper.authors} />
              <Field label="Year" value={viewPaper.year} />
              <Field label="PMID" value={viewPaper.pmid} />
              <Field label="DOI" value={viewPaper.doi} />
              <Field label="Ingested" value={formatDate(viewPaper.ingested_at)} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewPaper(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editPaper} onClose={() => setEditPaper(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit item</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Title" value={editDraft.title ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))} fullWidth />
            <TextField label="Authors" value={editDraft.authors ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, authors: e.target.value }))} fullWidth />
            <TextField label="Year" value={editDraft.year ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, year: e.target.value }))} fullWidth />
            <TextField label="PMID" value={editDraft.pmid ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, pmid: e.target.value }))} fullWidth />
            <TextField label="DOI" value={editDraft.doi ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, doi: e.target.value }))} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditPaper(null)}>Cancel</Button>
          <Button variant="contained" disabled={!editPaper?.id || updateMut.isPending} onClick={() => editPaper?.id && updateMut.mutate({ id: editPaper.id, data: editDraft })}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deletePaper} onClose={() => setDeletePaper(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete item?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Remove <strong>{deletePaper?.title ?? "this item"}</strong> from the catalog.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletePaper(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={!deletePaper?.id || deleteMut.isPending} onClick={() => deletePaper?.id && deleteMut.mutate(deletePaper.id)}>
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
