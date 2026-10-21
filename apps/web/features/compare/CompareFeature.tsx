"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CircularProgress,
  Drawer,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { peggyApi, formatApiError, queryKeys } from "@/lib/api";
import { StatusChip } from "@/components/StatusChip";
import { monoSx, peggyColors } from "@/theme/peggyTheme";
import { useWorkspace } from "@/lib/workspaceContext";

export function CompareFeature() {
  const { activeWorkspace } = useWorkspace();
  const [finding, setFinding] = useState("");
  const [selectedPaperId, setSelectedPaperId] = useState<number | "">("");
  const [usedOpen, setUsedOpen] = useState(false);

  const findings = useQuery({
    queryKey: queryKeys.corpus("own_findings", activeWorkspace?.id),
    queryFn: () => peggyApi.listCorpus("own_findings", activeWorkspace?.id),
    enabled: !!activeWorkspace?.id,
  });
  const findingPapers = findings.data?.papers ?? [];

  const compare = useMutation({
    mutationFn: (f: string) =>
      peggyApi.compare(f, {
        workspaceId: activeWorkspace?.id,
        sourceTypes: ["literature", "own_findings", "sample_datasets"],
      }),
  });

  const body = (compare.data?.body ?? {}) as Record<string, unknown>;
  const agreement = (body.agreement as string[]) ?? [];
  const discrepancy = (body.discrepancy as string[]) ?? [];
  const unclear = (body.unclear as string[]) ?? [];

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: "text.secondary" }}>
          FINDING SET
        </Typography>
        <FormControl size="small" sx={{ minWidth: 260 }}>
          <InputLabel id="finding-set-label">Finding set</InputLabel>
          <Select
            labelId="finding-set-label"
            value={selectedPaperId}
            label="Finding set"
            onChange={(e) => {
              const v = e.target.value as number | "";
              setSelectedPaperId(v);
              const paper = findingPapers.find((p) => p.id === v);
              if (paper?.title) setFinding(`Finding set: ${paper.title}`);
            }}
          >
            <MenuItem value="">
              <em>Choose…</em>
            </MenuItem>
            {findingPapers.map((p) => (
              <MenuItem key={p.id ?? p.title} value={p.id ?? ""}>
                {p.title ?? "Untitled"}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <StatusChip tone="neutral" label={`${Math.max(0, compare.data?.sources?.length ?? 0)} sources`} />
        <div style={{ flex: 1 }} />
        <Button
          variant="outlined"
          disabled={!finding.trim() || compare.isPending}
          onClick={() => compare.mutate(finding)}
          sx={{ textTransform: "none" }}
        >
          {compare.isPending ? <CircularProgress size={22} /> : "Run comparison"}
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        {[
          { label: "Agrees", tone: "accent" as const, value: agreement.length, sub: "papers point the same way as your result" },
          { label: "Differs", tone: "warning" as const, value: discrepancy.length, sub: "papers found a different effect" },
          { label: "Unclear", tone: "neutral" as const, value: unclear.length, sub: "reviews or results not pooled" },
        ].map((c) => (
          <Paper key={c.label} variant="outlined" sx={{ p: 2.5, flex: 1 }}>
            <StatusChip tone={c.tone} label={c.label} />
            <Typography variant="h3" sx={{ mt: 0.75, fontSize: 36, fontWeight: 600, letterSpacing: "-0.72px" }}>
              {c.value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {c.sub}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Stack spacing={0.5} sx={{ px: 2.5, py: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Effect comparison
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your findings compared with similar papers.
          </Typography>
        </Stack>
        <Divider />
        <Stack direction="row" spacing={2} sx={{ px: 2, py: 1, bgcolor: peggyColors.surface, ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: "text.secondary" }}>
          <div style={{ flex: 1 }}>SOURCE</div>
          <div style={{ width: 110 }}>DESIGN</div>
          <div style={{ width: 64 }}>n</div>
          <div style={{ width: 100 }}>DIRECTION</div>
          <div style={{ width: 150 }}>ESTIMATE</div>
          <div style={{ width: 96 }}>RESULT</div>
        </Stack>
        <Divider />
        {/* Minimal rendering: use sources list until backend provides structured table rows */}
        <Stack spacing={1} sx={{ p: 2 }}>
          {compare.data?.sources?.length ? (
            compare.data.sources.slice(0, 8).map((s, idx) => (
              <Stack key={`${s.chunk_id}-${idx}`} direction="row" spacing={2} alignItems="center" sx={{ py: 1, borderBottom: `0.5px solid ${peggyColors.border}` }}>
                <Typography fontWeight={600} sx={{ flex: 1 }}>
                  {s.title || "Source"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ width: 110 }}>
                  —
                </Typography>
                <Typography sx={{ ...monoSx, width: 64 }}>
                  —
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ width: 100 }}>
                  —
                </Typography>
                <Typography sx={{ ...monoSx, width: 150 }}>
                  —
                </Typography>
                <StatusChip tone="neutral" label="Used" sx={{ width: 96, justifyContent: "center" }} />
              </Stack>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              Run a comparison to populate this table.
            </Typography>
          )}
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1}>
        <Button variant="outlined" onClick={() => setUsedOpen(true)} sx={{ textTransform: "none" }}>
          What Peggy used
        </Button>
      </Stack>

      {compare.isError && <Alert severity="error">{formatApiError(compare.error)}</Alert>}

      <Drawer anchor="right" open={usedOpen} onClose={() => setUsedOpen(false)}>
        <Stack spacing={2} sx={{ width: 420, p: 2.5 }}>
          <Typography variant="h6">What Peggy used</Typography>
          <Typography variant="body2" color="text.secondary">
            Sources and limitations from the comparison run.
          </Typography>
          <Divider />
          <Typography sx={{ ...monoSx, fontSize: 12 }}>Confidence: {compare.data?.confidence ?? "—"}</Typography>
          {(compare.data?.limitations ?? []).length ? (
            <Stack spacing={0.5}>
              <Typography fontWeight={600}>Limitations</Typography>
              {(compare.data?.limitations ?? []).map((l, i) => (
                <Typography key={i} variant="body2" color="text.secondary">
                  {l}
                </Typography>
              ))}
            </Stack>
          ) : null}
          <Stack spacing={1}>
            <Typography fontWeight={600}>Sources</Typography>
            {(compare.data?.sources ?? []).map((s) => (
              <Paper key={s.chunk_id} variant="outlined" sx={{ p: 1.5 }}>
                <Typography fontWeight={600}>{s.title || "Untitled"}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {s.authors} {s.year ? `· ${s.year}` : ""}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
                  {s.excerpt}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Stack>
      </Drawer>
    </Stack>
  );
}
