"use client";

import { useQuery } from "@tanstack/react-query";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import {
  Box,
  Button,
  Chip,
  Menu,
  MenuItem,
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
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { peggyApi, type PaperRecord } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { monoSx } from "@/theme/peggyTheme";
import { IngestModal } from "@/features/ingest/IngestModal";
import { ExtractionPaperPanel } from "@/features/extractions/ExtractionPaperPanel";
import { StatusChip } from "@/components/StatusChip";

function screeningLabel(v?: string) {
  if (v === "included") return "Included";
  if (v === "excluded") return "Excluded";
  return "To read";
}

function screeningTone(v?: string): "default" | "success" | "error" | "warning" {
  if (v === "included") return "success";
  if (v === "excluded") return "error";
  return "warning";
}

function extractionChipTone(p: PaperRecord): "neutral" | "accent" | "warning" {
  const s = p.extraction_review_status ?? p.status;
  if (s === "reviewed") return "accent";
  if (s === "needs_review") return "warning";
  return "neutral";
}

function extractionChipLabel(p: PaperRecord) {
  const s = p.extraction_review_status ?? p.status;
  if (s === "reviewed") return "Reviewed";
  if (s === "needs_review") return "Needs review";
  return "Not extracted";
}

function csvEscape(s: string) {
  const needs = /[",\n]/.test(s);
  const v = s.replaceAll('"', '""');
  return needs ? `"${v}"` : v;
}

function downloadCsv(filename: string, rows: Array<Record<string, string>>) {
  const headers = Object.keys(rows[0] ?? {});
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h] ?? "")).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function CorpusManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ingestOpen, setIngestOpen] = useState(false);
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<null | "to_read" | "included" | "excluded">(null);
  const [selectedPaperId, setSelectedPaperId] = useState<number | null>(null);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearch(q);
    const raw = searchParams.get("paperId");
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) setSelectedPaperId(n);
    }
  }, [searchParams]);

  const papersSummary = useQuery({
    queryKey: ["workspace-papers-summary", workspaceId, filter, search],
    queryFn: () =>
      peggyApi.listWorkspacePapersSummary(workspaceId!, {
        screeningStatus: filter ?? undefined,
        q: search || undefined,
      }),
    enabled: !!workspaceId,
  });

  const papers = useMemo(
    () => (papersSummary.data?.papers ?? []).filter((p) => p.source_type === "literature"),
    [papersSummary.data]
  );
  const counts = papersSummary.data?.screening_counts;
  const subtitle = useMemo(() => {
    const n = counts?.all ?? 0;
    return `${n} paper${n === 1 ? "" : "s"} in this project.`;
  }, [counts?.all]);

  const selectedPaper = papers.find((p) => p.id === selectedPaperId);

  const [statusAnchor, setStatusAnchor] = useState<null | HTMLElement>(null);
  const [statusPaper, setStatusPaper] = useState<PaperRecord | null>(null);

  const openStatusMenu = (e: MouseEvent<HTMLElement>, p: PaperRecord) => {
    setStatusAnchor(e.currentTarget);
    setStatusPaper(p);
  };

  const closeStatusMenu = () => {
    setStatusAnchor(null);
    setStatusPaper(null);
  };

  const setPaperStatus = async (next: "to_read" | "included" | "excluded") => {
    if (!statusPaper?.id) return;
    await peggyApi.updatePaper(statusPaper.id, { screening_status: next });
    closeStatusMenu();
    papersSummary.refetch();
  };

  const selectPaper = (id: number) => {
    setSelectedPaperId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("paperId", String(id));
    router.replace(`/validate/literature?${params.toString()}`, { scroll: false });
  };

  return (
    <>
      <Stack spacing={2}>
        <Typography sx={{ ...monoSx, fontSize: 12, color: "text.secondary" }}>{subtitle}</Typography>

        <Stack direction={{ xs: "column", sm: "row" }} gap={1} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }}>
          <TextField
            size="small"
            placeholder="Search title, author or DOI"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: { xs: "100%", sm: 360 } }}
          />
          <Stack direction="row" gap={1}>
            <Button
              variant="outlined"
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={() => {
                const rows = papers.map((p) => ({
                  Title: p.title ?? "",
                  Authors: p.authors ?? "",
                  Year: p.year ?? "",
                  Journal: p.journal ?? "",
                  DOI: p.doi ?? "",
                  Status: screeningLabel(p.screening_status),
                  Extraction: extractionChipLabel(p),
                }));
                downloadCsv("literature.csv", rows);
              }}
              sx={{ textTransform: "none" }}
            >
              Export CSV
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIngestOpen(true)} sx={{ textTransform: "none" }}>
              Add by DOI or PMID
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" gap={1} flexWrap="wrap">
          <Chip label={`All ${counts?.all ?? 0}`} variant={filter === null ? "filled" : "outlined"} onClick={() => setFilter(null)} />
          <Chip label={`To read ${counts?.to_read ?? 0}`} variant={filter === "to_read" ? "filled" : "outlined"} onClick={() => setFilter("to_read")} />
          <Chip label={`Included ${counts?.included ?? 0}`} variant={filter === "included" ? "filled" : "outlined"} onClick={() => setFilter("included")} />
          <Chip label={`Excluded ${counts?.excluded ?? 0}`} variant={filter === "excluded" ? "filled" : "outlined"} onClick={() => setFilter("excluded")} />
        </Stack>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems="stretch">
          <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, overflow: "auto", borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Journal</TableCell>
                  <TableCell>Year</TableCell>
                  <TableCell>Screening</TableCell>
                  <TableCell>Extraction</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {papers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Box sx={{ py: 3, px: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          No papers in this project yet.
                        </Typography>
                        <Button variant="contained" size="small" onClick={() => setIngestOpen(true)} sx={{ textTransform: "none" }}>
                          Add by DOI or PMID
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  papers.map((p) => (
                    <TableRow
                      key={p.id}
                      hover
                      selected={p.id === selectedPaperId}
                      onClick={() => p.id && selectPaper(p.id)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Typography variant="body2" noWrap title={p.title ?? ""}>
                          {p.title || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 140 }}>
                        <Typography variant="body2" noWrap title={p.journal ?? ""}>
                          {p.journal || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>{p.year || "—"}</TableCell>
                      <TableCell>
                        <Chip
                          label={screeningLabel(p.screening_status)}
                          color={screeningTone(p.screening_status)}
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            openStatusMenu(e, p);
                          }}
                          sx={{ cursor: "pointer" }}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusChip label={extractionChipLabel(p)} tone={extractionChipTone(p)} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Paper>

          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              minWidth: 0,
              p: 2,
              borderRadius: 2,
              minHeight: 320,
              bgcolor: selectedPaperId ? "background.paper" : "background.default",
            }}
          >
            {!workspaceId ? (
              <Typography variant="body2" color="text.secondary">
                Select a project to review extractions.
              </Typography>
            ) : !selectedPaperId || !selectedPaper ? (
              <Stack spacing={1} sx={{ py: 4, px: 1, textAlign: "center" }}>
                <Typography fontWeight={600}>Select a paper</Typography>
                <Typography variant="body2" color="text.secondary">
                  Click a row to review extracted fields or run extraction on the full PDF.
                </Typography>
              </Stack>
            ) : (
              <ExtractionPaperPanel
                workspaceId={workspaceId}
                paperId={selectedPaperId}
                paperTitle={selectedPaper.title}
                compact
              />
            )}
          </Paper>
        </Stack>
      </Stack>

      <Menu anchorEl={statusAnchor} open={!!statusAnchor} onClose={closeStatusMenu}>
        <MenuItem onClick={() => void setPaperStatus("to_read")}>To read</MenuItem>
        <MenuItem onClick={() => void setPaperStatus("included")}>Included</MenuItem>
        <MenuItem onClick={() => void setPaperStatus("excluded")}>Excluded</MenuItem>
      </Menu>

      <IngestModal open={ingestOpen} onClose={() => setIngestOpen(false)} variant="literature" />
    </>
  );
}
