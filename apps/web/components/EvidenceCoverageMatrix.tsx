"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { peggyApi } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { monoSx, peggyColors } from "@/theme/peggyTheme";
import { StatusChip } from "@/components/StatusChip";

function cellLevel(count: number, max: number): "none" | "low" | "medium" | "high" {
  if (count <= 0 || max <= 0) return "none";
  const ratio = count / max;
  if (ratio >= 0.75) return "high";
  if (ratio >= 0.4) return "medium";
  return "low";
}

function cellSx(level: ReturnType<typeof cellLevel>) {
  if (level === "high") return { bgcolor: peggyColors.accent, color: peggyColors.primaryForeground };
  if (level === "medium") return { bgcolor: "rgba(74, 124, 111, 0.55)", color: peggyColors.foreground };
  if (level === "low") return { bgcolor: "rgba(74, 124, 111, 0.25)", color: peggyColors.foreground };
  return { bgcolor: peggyColors.muted, color: peggyColors.mutedForeground };
}

export function EvidenceCoverageMatrix() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  const coverage = useQuery({
    queryKey: ["coverage", workspaceId, "core.design", "core.setting"],
    queryFn: () =>
      peggyApi.getWorkspaceCoverage(workspaceId!, { dimension: "core.design", dimension2: "core.setting" }),
    enabled: !!workspaceId,
  });

  const matrix = useMemo(() => {
    const cells = coverage.data?.cells ?? [];
    const rows = Array.from(new Set(cells.map((c) => c.value))).sort();
    const cols = Array.from(new Set(cells.map((c) => c.value2 ?? "(missing)"))).sort();
    const lookup = new Map<string, number>();
    let max = 0;
    for (const c of cells) {
      const n = c.paper_count ?? 0;
      lookup.set(`${c.value}||${c.value2 ?? "(missing)"}`, n);
      if (n > max) max = n;
    }
    return { rows, cols, lookup, max };
  }, [coverage.data]);

  const underRep = useMemo(() => {
    if (matrix.cols.length < 2 || matrix.rows.length === 0) return null;
    const colTotals = matrix.cols.map((col) =>
      matrix.rows.reduce((sum, row) => sum + (matrix.lookup.get(`${row}||${col}`) ?? 0), 0)
    );
    const minTotal = Math.min(...colTotals);
    const maxTotal = Math.max(...colTotals);
    if (maxTotal > 0 && minTotal / maxTotal < 0.35) {
      const idx = colTotals.indexOf(minTotal);
      return matrix.cols[idx];
    }
    return null;
  }, [matrix]);

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "flex-start" }}>
          <Box>
            <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent, mb: 0.5 }}>
              EVIDENCE COVERAGE
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, maxWidth: 520 }}>
              Darker cells have more papers with extracted fields. Light cells are gaps. Based on design and setting
              fields when extractions exist.
            </Typography>
          </Box>
          {underRep ? (
            <StatusChip tone="warning" label={`${underRep} is under-represented`} />
          ) : null}
        </Stack>

        {coverage.isLoading ? (
          <Box sx={{ display: "grid", placeItems: "center", minHeight: 160 }}>
            <CircularProgress size={28} />
          </Box>
        ) : coverage.isError ? (
          <Alert severity="info">Coverage appears after papers are extracted. Run extraction from Literature search.</Alert>
        ) : matrix.rows.length === 0 ? (
          <Alert severity="info">No coverage data yet. Extract fields from your literature to populate this matrix.</Alert>
        ) : (
          <Box sx={{ overflow: "auto" }}>
            <Table size="small" sx={{ "& td, & th": { borderBottom: "none", py: 0.75 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 120 }} />
                  {matrix.cols.map((c) => (
                    <TableCell key={c} align="center">
                      <Typography variant="caption" sx={{ ...monoSx, color: "text.secondary" }}>
                        {c}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {matrix.rows.map((r) => (
                  <TableRow key={r}>
                    <TableCell>
                      <Typography variant="caption" sx={{ ...monoSx, color: "text.secondary" }}>
                        {r}
                      </Typography>
                    </TableCell>
                    {matrix.cols.map((c) => {
                      const count = matrix.lookup.get(`${r}||${c}`) ?? 0;
                      const level = cellLevel(count, matrix.max);
                      return (
                        <TableCell key={`${r}-${c}`} align="center">
                          <Box
                            sx={{
                              width: 64,
                              height: 40,
                              mx: "auto",
                              borderRadius: 1,
                              display: "grid",
                              placeItems: "center",
                              ...cellSx(level),
                            }}
                          >
                            <Typography sx={{ ...monoSx, fontSize: 11 }}>{count}</Typography>
                          </Box>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
