"use client";

import { useMutation } from "@tanstack/react-query";
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
import { peggyApi, type DiscoveryCandidate, type DiscoveryResponse } from "@/lib/api";
import { eyebrowSx, monoSx } from "@/theme/peggyTheme";

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
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Checkbox checked={selected} onChange={onToggle} sx={{ mt: -0.5 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 0.5 }}>
            <Chip
              label={candidate.source === "europe_pmc" ? "Europe PMC" : "PubMed"}
              size="small"
              variant="outlined"
            />
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
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<DiscoveryResponse | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);

  const discover = useMutation({
    mutationFn: () => peggyApi.discover(topic.trim() || undefined),
    onSuccess: (data) => {
      setResult(data);
      setSelected(new Set());
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
        if (c.pmid) pmids.push(c.pmid);
        else if (c.doi) dois.push(c.doi);
      }
      if (pmids.length === 0 && dois.length === 0) {
        throw new Error("Selected papers have no PMID or DOI for ingest");
      }
      return peggyApi.ingestPubmed({ pmids, dois });
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
    setSelected(new Set(result.candidates.map((_, i) => i)));
  };

  return (
    <Stack spacing={2} sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: "divider" }}>
      <Typography sx={eyebrowSx}>Discover new literature</Typography>
      <Typography variant="body2" color="text.secondary">
        Search PubMed and Europe PMC for papers relevant to your corpus. Review results before ingesting — nothing is
        added automatically.
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          label="Topic (optional)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Leave empty to derive keywords from your literature corpus"
          fullWidth
          size="small"
        />
        <Button
          variant="contained"
          startIcon={discover.isPending ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
          disabled={discover.isPending}
          onClick={() => discover.mutate()}
          sx={{ whiteSpace: "nowrap", minWidth: 140 }}
        >
          Discover
        </Button>
      </Stack>

      {discover.isError && <Alert severity="error">{(discover.error as Error).message}</Alert>}

      {result && (
        <Stack spacing={1.5}>
          <Typography variant="caption" color="text.secondary">
            Query: {result.query_used || "(none)"} · Found {result.total_found}, {result.total_after_dedup} new after
            dedup
          </Typography>

          {result.candidates.length === 0 ? (
            <Alert severity="info">No new papers found.</Alert>
          ) : (
            <>
              <Stack direction="row" spacing={1} alignItems="center">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selected.size === result.candidates.length && result.candidates.length > 0}
                      indeterminate={selected.size > 0 && selected.size < result.candidates.length}
                      onChange={() => (selected.size === result.candidates.length ? setSelected(new Set()) : selectAll())}
                    />
                  }
                  label="Select all"
                />
                <Button
                  variant="contained"
                  size="small"
                  disabled={selected.size === 0 || ingestMut.isPending}
                  onClick={() => ingestMut.mutate([...selected])}
                >
                  {ingestMut.isPending ? <CircularProgress size={18} /> : `Ingest selected (${selected.size})`}
                </Button>
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
      {ingestMut.isError && <Alert severity="error">{(ingestMut.error as Error).message}</Alert>}
    </Stack>
  );
}
