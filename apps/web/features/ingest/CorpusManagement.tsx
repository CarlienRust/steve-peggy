"use client";

import { useQuery } from "@tanstack/react-query";
import AddIcon from "@mui/icons-material/Add";
import { Alert, Button, Chip, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { peggyApi, queryKeys } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { monoSx } from "@/theme/peggyTheme";
import { IngestModal } from "@/features/ingest/IngestModal";
import { CorpusTable } from "@/features/ingest/CorpusTable";
import { DiscoveryPanel } from "@/features/ingest/DiscoveryPanel";

export function CorpusManagement() {
  const [ingestOpen, setIngestOpen] = useState(false);
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const corpus = useQuery({
    queryKey: queryKeys.corpus("literature", workspaceId),
    queryFn: () => peggyApi.listCorpus("literature", workspaceId),
    enabled: !!workspaceId,
  });
  const suggestions = useQuery({
    queryKey: ["discover-suggestions", workspaceId],
    queryFn: () => peggyApi.discoverSuggestions(workspaceId),
    enabled: !!workspaceId,
  });
  const papers = corpus.data?.papers ?? [];

  return (
    <>
      {!workspaceId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Select a project to scope literature to this workspace.
        </Alert>
      )}
      {papers.length === 0 && (suggestions.data?.suggestions?.length ?? 0) > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            No literature yet. Try a suggested search topic:
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {suggestions.data!.suggestions.slice(0, 6).map((s) => (
              <Chip key={s} label={s} size="small" variant="outlined" />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Use Discover below to run a search, or add papers directly.
          </Typography>
        </Alert>
      )}
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

      <DiscoveryPanel />

      <IngestModal open={ingestOpen} onClose={() => setIngestOpen(false)} variant="literature" />
    </>
  );
}
