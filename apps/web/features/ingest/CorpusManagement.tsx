"use client";

import { useQuery } from "@tanstack/react-query";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { Button, Chip, Menu, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useMemo, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { peggyApi, type PaperRecord } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { monoSx } from "@/theme/peggyTheme";
import { IngestModal } from "@/features/ingest/IngestModal";

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
  const [ingestOpen, setIngestOpen] = useState(false);
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<null | "to_read" | "included" | "excluded">(null);

  const papersSummary = useQuery({
    queryKey: ["workspace-papers-summary", workspaceId, filter, search],
    queryFn: () =>
      peggyApi.listWorkspacePapersSummary(workspaceId!, {
        screeningStatus: filter ?? undefined,
        q: search || undefined,
      }),
    enabled: !!workspaceId,
  });

  const papers = (papersSummary.data?.papers ?? []).filter((p) => p.source_type === "literature");
  const counts = papersSummary.data?.screening_counts;
  const subtitle = useMemo(() => {
    const n = counts?.all ?? 0;
    return `${n} paper${n === 1 ? "" : "s"} in this project. Sample data shown.`;
  }, [counts?.all]);

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
            <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={() => {
              const rows = papers.map((p) => ({
                Title: p.title ?? "",
                Authors: p.authors ?? "",
                Year: p.year ?? "",
                Journal: p.journal ?? "",
                DOI: p.doi ?? "",
                Status: screeningLabel(p.screening_status),
              }));
              downloadCsv("literature.csv", rows);
            }}>
              Export CSV
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIngestOpen(true)}>
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

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Authors</TableCell>
              <TableCell>Year</TableCell>
              <TableCell>Journal</TableCell>
              <TableCell>DOI</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {papers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No papers match your filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              papers.map((p) => (
                <TableRow
                  key={p.id}
                  hover
                  onClick={() => p.id && router.push(`/validate/literature/extraction-review?paperId=${p.id}`)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell sx={{ maxWidth: 360 }}>
                    <Typography variant="body2" noWrap title={p.title ?? ""}>
                      {p.title || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>
                    <Typography variant="body2" noWrap title={p.authors ?? ""}>
                      {p.authors || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>{p.year || "—"}</TableCell>
                  <TableCell sx={{ maxWidth: 180 }}>
                    <Typography variant="body2" noWrap title={p.journal ?? ""}>
                      {p.journal || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 180 }}>
                    <Typography variant="body2" noWrap title={p.doi ?? ""}>
                      {p.doi || "—"}
                    </Typography>
                  </TableCell>
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
