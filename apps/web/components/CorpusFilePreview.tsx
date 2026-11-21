"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Typography,
} from "@mui/material";
import { formatApiError, peggyApi, type PaperRecord } from "@/lib/api";

function isPdfName(name: string, type?: string) {
  return type?.includes("pdf") || name.toLowerCase().endsWith(".pdf");
}

export function CorpusFilePreview({
  paper,
  onClose,
}: {
  paper: PaperRecord | null;
  onClose: () => void;
}) {
  const paperQuery = useQuery({
    queryKey: ["paper", paper?.id],
    queryFn: () => peggyApi.getPaper(paper!.id!),
    enabled: !!paper?.id,
  });
  const record = paperQuery.data ?? paper;

  const fileQuery = useQuery({
    queryKey: ["paper-file", record?.id],
    queryFn: () => peggyApi.getPaperFile(record!.id!),
    enabled: !!record?.id && !paperQuery.isLoading,
    retry: 1,
  });
  const textQuery = useQuery({
    queryKey: ["paper-text", record?.id],
    queryFn: () => peggyApi.getPaperText(record!.id!),
    enabled:
      !!record?.id &&
      !fileQuery.isLoading &&
      (fileQuery.isError || !isPdfName(fileQuery.data?.name || record?.original_filename || "", fileQuery.data?.type)),
    retry: false,
  });

  const url = useMemo(() => (fileQuery.data ? URL.createObjectURL(fileQuery.data) : null), [fileQuery.data]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const pdf = !!fileQuery.data && isPdfName(fileQuery.data.name || record?.original_filename || "", fileQuery.data.type);

  return (
    <Dialog open={!!paper} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{record?.title || "Preview"}</DialogTitle>
      <DialogContent dividers>
        {record?.doi ? (
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            <Link href={`https://doi.org/${record.doi}`} target="_blank" rel="noreferrer">
              Open publisher / PDF
            </Link>
          </Typography>
        ) : record?.pmid ? (
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            <Link href={`https://pubmed.ncbi.nlm.nih.gov/${record.pmid}/`} target="_blank" rel="noreferrer">
              Open on PubMed
            </Link>
          </Typography>
        ) : null}
        {paperQuery.isLoading || fileQuery.isLoading ? (
          <CircularProgress size={22} />
        ) : pdf && url ? (
          <iframe title="PDF preview" src={`${url}#toolbar=1`} style={{ width: "100%", height: "70vh", border: 0 }} />
        ) : fileQuery.data && url && !pdf ? (
          <iframe title="File preview" src={url} style={{ width: "100%", height: "50vh", border: 0 }} />
        ) : textQuery.isLoading ? (
          <CircularProgress size={22} />
        ) : textQuery.isError && fileQuery.isError ? (
          <Alert severity="error">{formatApiError(fileQuery.error)}</Alert>
        ) : (
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
            {textQuery.data?.text?.trim() ||
              (fileQuery.isError
                ? formatApiError(fileQuery.error)
                : "No uploaded PDF for this record. Re-upload the PDF in Literature search, or use the publisher link above.")}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        {url ? (
          <Button href={url} download={fileQuery.data?.name || "download"} sx={{ mr: "auto", textTransform: "none" }}>
            Download
          </Button>
        ) : null}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}