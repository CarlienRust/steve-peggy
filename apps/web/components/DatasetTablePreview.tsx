"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { formatApiError, peggyApi, type PaperRecord } from "@/lib/api";
import { parsePastedTable } from "@/lib/parsePastedTable";
import { datasetFileName, looksLikeSavFile, parseSavTable } from "@/lib/parseSavTable";

const PREVIEW_ROWS = 20;

export function DatasetTablePreview({
  paper,
  onClose,
}: {
  paper: PaperRecord | null;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ["dataset-table-preview", paper?.id],
    queryFn: async () => {
      const raw = await peggyApi.getPaperFile(paper!.id!);
      const name = datasetFileName(paper!, raw);
      const file = new File([raw], name, { type: raw.type || paper?.content_type || "application/octet-stream" });
      const lower = name.toLowerCase();
      const sav = lower.endsWith(".sav") || lower.endsWith(".zsav") || (await looksLikeSavFile(file));
      if (sav) {
        const parsed = await parseSavTable(file);
        if ("error" in parsed) throw new Error(parsed.error);
        return { name, headers: parsed.headers, rows: parsed.rows, warning: parsed.warning };
      }
      if (lower.endsWith(".pdf") || file.type === "application/pdf") {
        throw new Error("This is a PDF. Upload CSV, TSV, TXT, or SAV to preview a data table.");
      }
      const parsed = parsePastedTable(await file.text());
      if ("error" in parsed) throw new Error(parsed.error);
      return { name, headers: parsed.headers, rows: parsed.rows, warning: parsed.warning };
    },
    enabled: !!paper?.id,
    retry: false,
  });

  const headers = query.data?.headers ?? [];
  const rows = (query.data?.rows ?? []).slice(0, PREVIEW_ROWS);

  return (
    <Dialog open={!!paper} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{paper?.title || query.data?.name || "Dataset"}</DialogTitle>
      <DialogContent dividers>
        {query.isLoading ? (
          <CircularProgress size={22} />
        ) : query.isError ? (
          <Alert severity="error">{formatApiError(query.error)}</Alert>
        ) : (
          <>
            {query.data?.warning ? (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                {query.data.warning}
              </Alert>
            ) : null}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Showing {rows.length} of {query.data?.rows.length ?? 0} rows.
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {headers.map((h) => (
                      <TableCell key={h} sx={{ whiteSpace: "nowrap" }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      {headers.map((_, c) => (
                        <TableCell key={c} sx={{ whiteSpace: "nowrap" }}>
                          {row[c] ?? ""}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
