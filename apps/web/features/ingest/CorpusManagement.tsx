"use client";

import { useQuery } from "@tanstack/react-query";
import AddIcon from "@mui/icons-material/Add";
import { Button, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { peggyApi, queryKeys } from "@/lib/api";
import { monoSx } from "@/theme/peggyTheme";
import { IngestModal } from "@/features/ingest/IngestModal";
import { CorpusTable } from "@/features/ingest/CorpusTable";

export function CorpusManagement() {
  const [ingestOpen, setIngestOpen] = useState(false);
  const corpus = useQuery({
    queryKey: queryKeys.corpus("literature"),
    queryFn: () => peggyApi.listCorpus("literature"),
  });
  const papers = corpus.data?.papers ?? [];

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography sx={{ ...monoSx, fontSize: 12, color: "text.secondary" }}>
          {papers.length} literature item{papers.length === 1 ? "" : "s"}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIngestOpen(true)}>
          Add literature
        </Button>
      </Stack>

      <CorpusTable
        papers={papers}
        emptyMessage='No literature yet. Use "Add literature" for PubMed IDs or PDF papers.'
        typeLabel={() => "Literature"}
      />

      <IngestModal open={ingestOpen} onClose={() => setIngestOpen(false)} variant="literature" />
    </>
  );
}
