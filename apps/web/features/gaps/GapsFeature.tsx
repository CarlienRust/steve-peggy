"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { peggyApi, formatApiError, queryKeys, type GapAnalysisRunSummary } from "@/lib/api";
import { SourceCards } from "@/components/SourceCards";
import { EvidenceCoverageMatrix } from "@/components/EvidenceCoverageMatrix";
import { DisabledTooltipButton } from "@/components/DisabledTooltipButton";
import { StatusChip } from "@/components/StatusChip";
import { useAuthSession } from "@/lib/authContext";
import { useResearchQuestionPrefill } from "@/lib/useResearchQuestionPrefill";
import { useWorkspace } from "@/lib/workspaceContext";
import { objectiveDraftFromGap, sourcesForGap } from "@/lib/gapLiterature";
import { monoSx, peggyColors } from "@/theme/peggyTheme";

type Gap = {
  topic?: string;
  status?: string;
  suggested_study?: string;
  evidence_basis?: string;
  paper_count?: number;
  evidence_for?: string;
};

const FULL_TEXT_MIN = 10;

function tagsFromGap(gap: Gap): string[] {
  return suggestedSearchTags(gap);
}

function suggestedSearchTags(gap: Gap): string[] {
  const fromStudy = (gap.suggested_study ?? "").trim();
  if (!fromStudy) return [];
  const parts = fromStudy.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts.slice(0, 4);
  const words = fromStudy.split(/\s+/).filter((w) => w.length > 3);
  if (words.length >= 3) {
    return [words.slice(0, 5).join(" ")];
  }
  return [fromStudy.slice(0, 80)];
}

function statusLabel(status?: string) {
  if (!status) return "Gap";
  return status.replace(/_/g, " ");
}

export function GapsFeature() {
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const { userId } = useAuthSession();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: queryKeys.profile(userId ?? undefined),
    queryFn: () => peggyApi.getProfileOptional(),
    enabled: !!userId,
  });
  const [query, setQuery] = useResearchQuestionPrefill(activeWorkspace, profileQuery.data);
  const [includeFindings, setIncludeFindings] = useState(true);
  const [scanMode, setScanMode] = useState<"abstracts" | "full">("abstracts");
  const [replayRunId, setReplayRunId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(() => new Set());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);
  const [ingestingGapIndex, setIngestingGapIndex] = useState<number | null>(null);

  const papersSummary = useQuery({
    queryKey: ["workspace-papers-summary", activeWorkspace?.id],
    queryFn: () => peggyApi.listWorkspacePapersSummary(activeWorkspace!.id),
    enabled: !!activeWorkspace?.id,
  });

  const literaturePapers = useMemo(
    () => (papersSummary.data?.papers ?? []).filter((p) => p.source_type === "literature"),
    [papersSummary.data]
  );
  const paperCount = literaturePapers.length;
  const fullTextCount = literaturePapers.filter((p) => (p.extraction_count ?? 0) > 0).length;
  const canFullText = fullTextCount >= FULL_TEXT_MIN;
  const abstractsOnly = scanMode === "abstracts";

  const historyQuery = useQuery({
    queryKey: ["gap-history", activeWorkspace?.id],
    queryFn: () => peggyApi.gapAnalysisHistory(activeWorkspace!.id),
    enabled: !!activeWorkspace?.id,
  });

  const replayQuery = useQuery({
    queryKey: ["gap-run", replayRunId],
    queryFn: () => peggyApi.gapAnalysisRun(replayRunId!),
    enabled: !!replayRunId,
  });

  const gap = useMutation({
    mutationFn: (opts: { q: string; mode: "abstracts" | "full" }) =>
      peggyApi.gapAnalysis(opts.q, {
        sourceTypes:
          opts.mode === "full" && includeFindings ? ["literature", "own_findings"] : ["literature"],
        workspaceId: activeWorkspace?.id,
        abstractsOnly: opts.mode === "abstracts",
      }),
    onSuccess: () => {
      setReplayRunId(null);
      setDismissed(new Set());
      if (activeWorkspace?.id) {
        void queryClient.invalidateQueries({ queryKey: ["gap-history", activeWorkspace.id] });
      }
    },
  });

  const displayData = replayRunId && replayQuery.data ? replayQuery.data : gap.data;
  const body = displayData?.body as Record<string, unknown> | undefined;
  const allGaps = (body?.gaps as Gap[]) ?? [];
  const visibleGaps = allGaps
    .map((g, i) => ({ g, index: i }))
    .filter(({ index }) => !dismissed.has(index));
  const gapCount = visibleGaps.length;

  const deleteRun = useMutation({
    mutationFn: (runId: string) => peggyApi.deleteGapAnalysisRun(runId),
    onSuccess: (_data, runId) => {
      if (replayRunId === runId) setReplayRunId(null);
      if (activeWorkspace?.id) {
        void queryClient.invalidateQueries({ queryKey: ["gap-history", activeWorkspace.id] });
      }
    },
  });

  const clearHistory = useMutation({
    mutationFn: () => peggyApi.clearGapAnalysisHistory(activeWorkspace!.id),
    onSuccess: () => {
      setReplayRunId(null);
      gap.reset();
      if (activeWorkspace?.id) {
        void queryClient.invalidateQueries({ queryKey: ["gap-history", activeWorkspace.id] });
      }
    },
  });

  const ingestGapLiterature = useMutation({
    mutationFn: async ({ gap: g }: { gap: Gap; gapIndex: number }) => {
      if (!activeWorkspace?.id || !displayData?.sources?.length) {
        throw new Error("Run a gap scan first.");
      }
      const picked = sourcesForGap(g as Record<string, unknown>, displayData.sources);
      const fallback = tagsFromGap(g)[0] ?? g.topic ?? query.trim();
      return peggyApi.ingestFromCitations({
        workspaceId: activeWorkspace.id,
        sources: picked,
        fallbackTopic: fallback || undefined,
      });
    },
    onMutate: ({ gapIndex }) => setIngestingGapIndex(gapIndex),
    onSettled: () => setIngestingGapIndex(null),
    onSuccess: (job) => {
      setIngestMsg(
        `Queued ${job.pmid_count ?? 0} paper(s) for ingest (job ${job.job_id.slice(0, 8)}…). Check Literature search.`
      );
    },
  });

  return (
    <Stack spacing={3}>
      {!activeWorkspace && (
        <Alert severity="info">Select a project to save history and include study design context.</Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent, mb: 0.5 }}>
          SCAN
        </Typography>
        <Typography fontWeight={600} sx={{ mb: 0.5 }}>
          Quick scan
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
          Reads titles and abstracts only. Gaps below rest on abstracts until you add full texts.
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <StatusChip tone={abstractsOnly ? "accent" : "neutral"} label="Abstracts only" />
          <StatusChip tone="neutral" label={`${paperCount} paper${paperCount === 1 ? "" : "s"}`} />
          <StatusChip tone="neutral" label={`${fullTextCount} with full text`} />
        </Stack>

        <TextField
          placeholder="Research focus or question"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
          multiline
          minRows={2}
          sx={{ mb: 2 }}
        />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            disabled={gap.isPending || !query.trim()}
            onClick={() => {
              setScanMode("abstracts");
              if (query.trim()) gap.mutate({ q: query.trim(), mode: "abstracts" });
            }}
            sx={{ textTransform: "none" }}
          >
            {gap.isPending && scanMode === "abstracts" ? <CircularProgress size={22} color="inherit" /> : "Run scan"}
          </Button>
          <Button
            variant="outlined"
            onClick={() => router.push("/validate/literature?add=1")}
            sx={{ textTransform: "none" }}
          >
            Add papers
          </Button>
          <DisabledTooltipButton
            title={
              canFullText
                ? "Run gap analysis using ingested full texts"
                : `Needs ${FULL_TEXT_MIN} papers with full text. You have ${fullTextCount}.`
            }
          >
            <Button
              variant="outlined"
              disabled={!canFullText || gap.isPending || !query.trim()}
              onClick={() => {
                setScanMode("full");
                if (query.trim()) gap.mutate({ q: query.trim(), mode: "full" });
              }}
              sx={{ textTransform: "none" }}
            >
              {gap.isPending && scanMode === "full" ? <CircularProgress size={22} color="inherit" /> : "Run full-text analysis"}
            </Button>
          </DisabledTooltipButton>
        </Stack>

        {!abstractsOnly && includeFindings ? null : (
          <FormControlRow
            checked={includeFindings}
            onChange={setIncludeFindings}
            label="Include our findings when running full-text analysis"
            disabled={abstractsOnly}
          />
        )}
      </Paper>

      <EvidenceCoverageMatrix />

      {gap.isError && <Alert severity="error">{formatApiError(gap.error)}</Alert>}
      {replayQuery.isError && <Alert severity="error">{formatApiError(replayQuery.error)}</Alert>}
      {ingestGapLiterature.isError && <Alert severity="error">{formatApiError(ingestGapLiterature.error)}</Alert>}
      {ingestMsg && (
        <Alert severity="success" onClose={() => setIngestMsg(null)}>
          {ingestMsg}
        </Alert>
      )}

      {displayData && body ? (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, overflow: "hidden" }}>
          <Typography fontWeight={600} sx={{ mb: 0.5 }}>
            Open gaps
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {gapCount} gap{gapCount === 1 ? "" : "s"} found. Each shows how many papers it rests on.
          </Typography>

          {typeof body.summary === "string" && body.summary ? (
            <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.7, wordBreak: "break-word" }}>
              {body.summary}
            </Typography>
          ) : null}

          <Stack spacing={2}>
            {visibleGaps.map(({ g, index: gapIndex }, i) => {
              const tags = suggestedSearchTags(g);
              const basis = g.evidence_basis === "full_text" ? "Full text" : "Abstracts only";
              return (
                <Box
                  key={`${g.topic}-${gapIndex}`}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: `0.5px solid ${peggyColors.border}`,
                    bgcolor: "background.default",
                    overflow: "hidden",
                    wordBreak: "break-word",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography sx={{ ...monoSx, fontSize: 11, color: "text.secondary" }}>{`G${i + 1}`}</Typography>
                    <StatusChip
                      tone={g.evidence_basis === "full_text" ? "accent" : "neutral"}
                      label={basis}
                    />
                    {g.paper_count != null ? (
                      <StatusChip tone="neutral" label={`${g.paper_count} papers`} />
                    ) : null}
                    {g.status ? (
                      <Chip size="small" label={statusLabel(g.status)} variant="outlined" sx={{ ...monoSx, fontSize: 10 }} />
                    ) : null}
                  </Stack>
                  <Typography fontWeight={600} sx={{ mb: 1, wordBreak: "break-word" }}>
                    {g.topic ?? "Untitled gap"}
                  </Typography>
                  {g.evidence_for ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1.5, lineHeight: 1.6, wordBreak: "break-word" }}
                    >
                      {g.evidence_for}
                    </Typography>
                  ) : null}
                  {tags.length > 0 ? (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1px", color: "text.secondary", mb: 0.75 }}>
                        SUGGESTED SEARCHES
                      </Typography>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        {tags.map((t) => (
                          <Chip
                            key={t}
                            size="small"
                            label={t}
                            variant="outlined"
                            sx={{ ...monoSx, fontSize: 10, maxWidth: "100%", height: "auto", "& .MuiChip-label": { whiteSpace: "normal" } }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  ) : null}
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!activeWorkspace?.id || ingestGapLiterature.isPending}
                      sx={{ textTransform: "none" }}
                      onClick={() => ingestGapLiterature.mutate({ gap: g, gapIndex })}
                    >
                      {ingestingGapIndex === gapIndex ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        "Add papers from gap"
                      )}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ textTransform: "none" }}
                      onClick={() => {
                        const draft = encodeURIComponent(objectiveDraftFromGap(g as Record<string, unknown>));
                        router.push(`/validate/aim?editObjectives=1&objectiveDraft=${draft}`);
                      }}
                    >
                      Add to objectives
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      sx={{ textTransform: "none", color: "text.secondary" }}
                      onClick={() => setDismissed((prev) => new Set(prev).add(gapIndex))}
                    >
                      Dismiss
                    </Button>
                  </Stack>
                </Box>
              );
            })}
          </Stack>

          <Box sx={{ mt: 2 }}>
            <SourceCards
              sources={displayData.sources}
              confidence={displayData.confidence}
              limitations={displayData.limitations}
            />
          </Box>
        </Paper>
      ) : null}

      {activeWorkspace && (historyQuery.data?.length ?? 0) > 0 ? (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, overflow: "hidden" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Button variant="text" onClick={() => setHistoryOpen((v) => !v)} sx={{ textTransform: "none", px: 0 }}>
              Earlier scans ({historyQuery.data?.length ?? 0})
            </Button>
            <Stack direction="row" spacing={1}>
              {replayRunId ? (
                <Button size="small" onClick={() => setReplayRunId(null)} sx={{ textTransform: "none" }}>
                  Back to latest
                </Button>
              ) : null}
              <Button
                size="small"
                color="error"
                variant="outlined"
                disabled={clearHistory.isPending}
                sx={{ textTransform: "none" }}
                onClick={() => {
                  if (window.confirm("Delete all saved gap scans for this project?")) clearHistory.mutate();
                }}
              >
                Clear all
              </Button>
            </Stack>
          </Stack>
          <Collapse in={historyOpen}>
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {(historyQuery.data ?? []).map((run: GapAnalysisRunSummary) => (
                <Stack
                  key={run.id}
                  direction="row"
                  alignItems="flex-start"
                  spacing={0.5}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: replayRunId === run.id ? "action.selected" : "transparent",
                    border: 1,
                    borderColor: "divider",
                  }}
                >
                  <Button
                    variant="text"
                    onClick={() => setReplayRunId(run.id)}
                    sx={{
                      textTransform: "none",
                      justifyContent: "flex-start",
                      textAlign: "left",
                      flex: 1,
                      minWidth: 0,
                      py: 0.5,
                    }}
                  >
                    <Box sx={{ minWidth: 0, width: "100%" }}>
                      <Typography
                        variant="body2"
                        fontWeight={replayRunId === run.id ? 600 : 400}
                        sx={{ wordBreak: "break-word", whiteSpace: "normal" }}
                      >
                        {run.query}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(run.created_at).toLocaleString()}
                      </Typography>
                    </Box>
                  </Button>
                  <Tooltip title="Delete this scan">
                    <IconButton
                      size="small"
                      aria-label="Delete scan"
                      disabled={deleteRun.isPending}
                      onClick={() => deleteRun.mutate(run.id)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          </Collapse>
        </Paper>
      ) : null}
    </Stack>
  );
}

function FormControlRow({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
      <Button
        size="small"
        variant={checked ? "contained" : "outlined"}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        sx={{ textTransform: "none", minWidth: 0 }}
      >
        {checked ? "On" : "Off"}
      </Button>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}
