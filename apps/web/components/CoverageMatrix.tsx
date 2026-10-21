"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { peggyApi } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { monoSx } from "@/theme/peggyTheme";

export function CoverageMatrix(props?: { dimension?: string; dimension2?: string; title?: string; description?: string }) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const dimension = props?.dimension ?? "core.design";
  const dimension2 = props?.dimension2 ?? "core.setting";

  const coverage = useQuery({
    queryKey: ["coverage", workspaceId, dimension, dimension2],
    queryFn: () => peggyApi.getWorkspaceCoverage(workspaceId!, { dimension, dimension2 }),
    enabled: !!workspaceId,
  });

  const matrix = useMemo(() => {
    const cells = coverage.data?.cells ?? [];
    const rows = Array.from(new Set(cells.map((c) => c.value))).sort();
    const cols = Array.from(new Set(cells.map((c) => c.value2 ?? "(missing)"))).sort();
    const lookup = new Map<string, number>();
    for (const c of cells) {
      lookup.set(`${c.value}||${c.value2 ?? "(missing)"}`, c.paper_count);
    }
    return { rows, cols, lookup };
  }, [coverage.data]);

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <Box>
          <Typography sx={{ ...monoSx, fontSize: 12, color: "text.secondary" }}>
            {props?.title ?? "Coverage matrix"}
          </Typography>
          {props?.description ? (
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              {props.description}
            </Typography>
          ) : null}
        </Box>

        {coverage.isLoading ? (
          <Box sx={{ display: "grid", placeItems: "center", minHeight: 160 }}>
            <CircularProgress />
          </Box>
        ) : coverage.isError ? (
          <Alert severity="error">Could not load coverage.</Alert>
        ) : (
          <Box sx={{ overflow: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell />
                  {matrix.cols.map((c) => (
                    <TableCell key={c}>
                      <Typography variant="caption" sx={monoSx}>
                        {c}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {matrix.rows.map((r) => (
                  <TableRow key={r} hover>
                    <TableCell>
                      <Typography variant="caption" sx={monoSx}>
                        {r}
                      </Typography>
                    </TableCell>
                    {matrix.cols.map((c) => (
                      <TableCell key={`${r}-${c}`}>{matrix.lookup.get(`${r}||${c}`) ?? 0}</TableCell>
                    ))}
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

