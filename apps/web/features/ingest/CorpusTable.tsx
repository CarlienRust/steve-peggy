"use client";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
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
import { ObjectiveLinkSelect, type LinkTargetOption } from "@/components/ObjectiveLinkSelect";
import { peggyApi, queryKeys, type PaperRecord } from "@/lib/api";
import { findingLinkForPaper, type FindingLink } from "@/lib/studyDesign";
import { monoSx } from "@/theme/peggyTheme";

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

type CorpusTableProps = {
  papers: PaperRecord[];
  emptyMessage: string;
  typeLabel: (p: PaperRecord) => string;
  findingLinks?: FindingLink[];
  linkOptions?: LinkTargetOption[];
  onSaveFindingLinks?: (paperId: number, objectiveIds: string[]) => void | Promise<void>;
  onDeletePaper?: (paperId: number) => void | Promise<void>;
};

export function CorpusTable({
  papers,
  emptyMessage,
  typeLabel,
  findingLinks,
  linkOptions,
  onSaveFindingLinks,
  onDeletePaper,
}: CorpusTableProps) {
  const [viewPaper, setViewPaper] = useState<PaperRecord | null>(null);
  const [editPaper, setEditPaper] = useState<PaperRecord | null>(null);
  const [tagPaper, setTagPaper] = useState<PaperRecord | null>(null);
  const [deletePaper, setDeletePaper] = useState<PaperRecord | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<PaperRecord>>({});
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const queryClient = useQueryClient();
  const showLinks = !!onSaveFindingLinks && !!linkOptions;

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PaperRecord> }) => peggyApi.updatePaper(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corpus"] });
      setEditPaper(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => peggyApi.deletePaper(id),
    onSuccess: async (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["corpus"] });
      await onDeletePaper?.(id);
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

  const openTags = (p: PaperRecord) => {
    if (!p.id) return;
    setTagPaper(p);
    setTagDraft(findingLinkForPaper(findingLinks, p.id));
  };

  const saveTags = async () => {
    if (!tagPaper?.id || !onSaveFindingLinks) return;
    setSavingTags(true);
    try {
      await onSaveFindingLinks(tagPaper.id, tagDraft);
      setTagPaper(null);
    } finally {
      setSavingTags(false);
    }
  };

  const renderLinkChips = (paperId?: number) => {
    if (!showLinks || paperId == null || !linkOptions?.length) return null;
    const ids = findingLinkForPaper(findingLinks, paperId);
    if (ids.length === 0) return null;
    return (
      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
        {ids.map((id) => (
          <Chip key={id} label={linkOptions.find((o) => o.id === id)?.label ?? id} size="small" variant="outlined" />
        ))}
      </Stack>
    );
  };

  return (
    <>
      <Paper variant="outlined" sx={{ overflow: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              {showLinks && <TableCell>Objectives</TableCell>}
              <TableCell>Year</TableCell>
              <TableCell>Ingested</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {papers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showLinks ? 6 : 5}>
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
                  {showLinks && (
                    <TableCell sx={{ maxWidth: 220 }}>
                      {renderLinkChips(p.id) ?? (
                        <Typography variant="caption" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                  )}
                  <TableCell>{p.year || "—"}</TableCell>
                  <TableCell>{formatDate(p.ingested_at)}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" aria-label="View" onClick={() => setViewPaper(p)}>
                      <VisibilityOutlinedIcon fontSize="small" />
                    </IconButton>
                    {showLinks && (
                      <IconButton size="small" aria-label="Edit objective tags" onClick={() => openTags(p)}>
                        <LabelOutlinedIcon fontSize="small" />
                      </IconButton>
                    )}
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

      <Dialog open={!!tagPaper} onClose={() => setTagPaper(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Link to objectives</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Tag <strong>{tagPaper?.title ?? "this finding set"}</strong> to the aim or specific objectives.
            </Typography>
            {linkOptions && (
              <ObjectiveLinkSelect options={linkOptions} value={tagDraft} onChange={setTagDraft} />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagPaper(null)}>Cancel</Button>
          <Button variant="contained" disabled={savingTags} onClick={() => void saveTags()}>
            Save tags
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
