"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { peggyApi, formatApiError, type DiscoveryCandidate, type DiscoveryResponse } from "@/lib/api";
import { useResearchQuestionPrefill } from "@/lib/useResearchQuestionPrefill";
import { useAuthSession } from "@/lib/authContext";
import { useWorkspace } from "@/lib/workspaceContext";
import { queryKeys } from "@/lib/api";
import { eyebrowSx, monoSx } from "@/theme/peggyTheme";

const SOURCE_LABELS: Record<string, string> = {
  pubmed: "PubMed",
  europe_pmc: "Europe PMC",
  openalex: "OpenAlex",
};

function CandidateCard({
  candidate,
  selected,
  onToggle,
}: {
  candidate: DiscoveryCandidate;
  selected: boolean;
  onToggle: () => void;
}) {
  const score =
    candidate.relevance_score != null ? `${(candidate.relevance_score * 100).toFixed(0)}%` : "—";
  return (
    <Paper variant="outlined" sx={{ p: 2, opacity: candidate.already_in_corpus ? 0.85 : 1 }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Checkbox checked={selected} onChange={onToggle} sx={{ mt: -0.5 }} disabled={candidate.already_in_corpus} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 0.5 }}>
            <Chip label={SOURCE_LABELS[candidate.source] ?? candidate.source} size="small" variant="outlined" />
            {candidate.already_in_corpus && (
              <Chip label="In corpus" size="small" color="default" variant="filled" />
            )}
            {candidate.year != null && (
              <Chip label={String(candidate.year)} size="small" variant="outlined" />
            )}
            <Chip label={`Relevance ${score}`} size="small" color="primary" variant="outlined" />
          </Stack>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {candidate.title}
          </Typography>
          {candidate.pmid && (
            <Typography sx={{ ...monoSx, fontSize: 11, color: "text.secondary" }}>
              PMID {candidate.pmid}
              {candidate.doi ? ` · DOI ${candidate.doi}` : ""}
            </Typography>
          )}
          {candidate.abstract && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.5 }}>
              {candidate.abstract.length > 400 ? `${candidate.abstract.slice(0, 400)}…` : candidate.abstract}
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

export function DiscoveryPanel() {
  const { activeWorkspace } = useWorkspace();
  const { userId } = useAuthSession();
  const profileQuery = useQuery({
    queryKey: queryKeys.profile(userId ?? undefined),
    queryFn: () => peggyApi.getProfileOptional(),
    enabled: !!userId,
  });
  const [topic, setTopic] = useResearchQuestionPrefill(activeWorkspace, profileQuery.data);
  const [result, setResult] = useState<DiscoveryResponse | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const suggestionsQuery = useQuery({
    queryKey: ["discover-suggestions", activeWorkspace?.id],
    queryFn: () => peggyApi.discoverSuggestions(activeWorkspace?.id),
  });

  const discover = useMutation({
    mutationFn: (nextOffset: number) =>
      peggyApi.discover({
        topic: topic.trim() || undefined,
        workspaceId: activeWorkspace?.id,
        offset: nextOffset,
      }),
    onSuccess: (data, nextOffset) => {
      if (nextOffset === 0) {
        setResult(data);
        setSelected(new Set());
      } else if (result) {
        setResult({
          ...data,
          candidates: [...result.candidates, ...data.candidates],
        });
      } else {
        setResult(data);
      }
      setOffset(nextOffset + data.candidates.length);
      setIngestMsg(null);
    },
  });

  const ingestMut = useMutation({
    mutationFn: async (indices: number[]) => {
      if (!result) return;
      const pmids: string[] = [];
      const dois: string[] = [];
      for (const i of indices) {
        const c = result.candidates[i];
        if (c.already_in_corpus) continue;
        if (c.pmid) pmids.push(c.pmid);
        else if (c.doi) dois.push(c.doi);
      }
      if (pmids.length === 0 && dois.length === 0) {
        throw new Error("Selected papers have no PMID or DOI for ingest");
      }
      return peggyApi.ingestPubmed({ pmids, dois, workspaceId: activeWorkspace?.id });
    },
    onSuccess: (job) => {
      if (job) setIngestMsg(`Ingest job queued: ${job.job_id}`);
      setSelected(new Set());
    },
  });

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    if (!result) return;
    const ingestable = result.candidates
      .map((c, i) => (c.already_in_corpus ? -1 : i))
      .filter((i) => i >= 0);
    setSelected(new Set(ingestable));
  };

  const runDiscover = () => {
    setOffset(0);
    discover.mutate(0);
  };

  const hasMore = result ? result.total_after_dedup > result.candidates.length : false;

  return (
    <Stack spacing={2} sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: "divider" }}>
      <Typography sx={eyebrowSx}>Discover new literature</Typography>
      <Typography variant="body2" color="text.secondary">
        Peggy searches PubMed, Europe PMC, and OpenAlex — not the full web. Paste PMIDs or DOIs from Google Scholar if
        needed. Review results before ingesting.
      </Typography>

      {(suggestionsQuery.data?.suggestions?.length ?? 0) > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {suggestionsQuery.data!.suggestions.map((s) => (
            <Chip key={s} label={s} size="small" onClick={() => setTopic(s)} variant="outlined" />
          ))}
        </Stack>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          label="Topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic or pick a suggestion above"
          fullWidth
          size="small"
        />
        <Button
          variant="contained"
          startIcon={discover.isPending ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
          disabled={discover.isPending}
          onClick={runDiscover}
          sx={{ whiteSpace: "nowrap", minWidth: 140 }}
        >
          Discover
        </Button>
      </Stack>

      {discover.isError && <Alert severity="error">{formatApiError(discover.error)}</Alert>}

      {result && (
        <Stack spacing={1.5}>
          <Typography variant="caption" color="text.secondary">
            Query: {result.query_used || "(none)"} · Found {result.total_found}, {result.total_after_dedup} after dedup
          </Typography>
          {(result.queries_tried?.length ?? 0) > 1 && (
            <Typography variant="caption" color="text.secondary">
              Searched: {result.queries_tried.join(" · ")}
            </Typography>
          )}

          {result.candidates.length === 0 ? (
            <Alert severity="info">No papers found for this query.</Alert>
          ) : (
            <>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selected.size > 0 && selected.size === result.candidates.filter((c) => !c.already_in_corpus).length}
                      indeterminate={selected.size > 0 && selected.size < result.candidates.filter((c) => !c.already_in_corpus).length}
                      onChange={() => (selected.size > 0 ? setSelected(new Set()) : selectAll())}
                    />
                  }
                  label="Select all (not in corpus)"
                />
                <Button
                  variant="contained"
                  size="small"
                  disabled={selected.size === 0 || ingestMut.isPending}
                  onClick={() => ingestMut.mutate([...selected])}
                >
                  {ingestMut.isPending ? <CircularProgress size={18} /> : `Ingest selected (${selected.size})`}
                </Button>
                {hasMore && (
                  <Button
                    size="small"
                    disabled={discover.isPending}
                    onClick={() => discover.mutate(offset)}
                  >
                    Show more
                  </Button>
                )}
              </Stack>
              {result.candidates.map((c, i) => (
                <CandidateCard
                  key={`${c.pmid ?? c.doi ?? c.title}-${i}`}
                  candidate={c}
                  selected={selected.has(i)}
                  onToggle={() => toggle(i)}
                />
              ))}
            </>
          )}
        </Stack>
      )}

      {ingestMsg && <Alert severity="success">{ingestMsg}</Alert>}
      {ingestMut.isError && <Alert severity="error">{formatApiError(ingestMut.error)}</Alert>}
    </Stack>
  );
}
