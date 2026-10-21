"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatApiError,
  peggyApi,
  queryKeys,
  type AgentResponse,
  type AgentStreamEvent,
  type ChatMode,
  type SourceCitation,
} from "@/lib/api";
import { WorkflowResults } from "@/components/WorkflowResults";
import { UsageQuotaBanner } from "@/features/chat/UsageQuotaBanner";
import { ProjectContextImport } from "@/components/ProjectContextImport";
import { WhatPeggyUsedDrawer } from "@/components/WhatPeggyUsedDrawer";
import { DisabledTooltipButton } from "@/components/DisabledTooltipButton";
import { StatusChip } from "@/components/StatusChip";
import { useResearchQuestionPrefill } from "@/lib/useResearchQuestionPrefill";
import { useWorkspace } from "@/lib/workspaceContext";
import { useAuthSession } from "@/lib/authContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { normalizeObjectives } from "@/lib/objectives";
import { eyebrowSx, monoSx, peggyColors } from "@/theme/peggyTheme";

const MODES: { id: ChatMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "chat", label: "Ask" },
  { id: "gap_analysis", label: "Gaps" },
  { id: "compare", label: "Compare" },
];

const SESSION_KEY = "peggy_chat_session_id";

function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const TOOL_LABELS: Record<string, string> = {
  search_corpus: "Searching corpus",
  list_corpus: "Listing papers",
  search_pubmed: "Searching PubMed",
  get_paper_metadata: "Fetching metadata",
  run_gap_analysis: "Running gap analysis",
  compare_finding: "Comparing finding",
  summarise_context: "Summarising context",
};

type ChatTurn = {
  id: string;
  role: "user" | "peggy";
  text: string;
  sources?: SourceCitation[];
  limitations?: string[];
  body?: Record<string, unknown> | null;
  error?: boolean;
};

function sourceChipLabel(source: SourceCitation, index: number) {
  const author = (source.authors || source.title || "Source").split(",")[0]?.trim() || "Source";
  const year = source.year || "";
  return `[${index + 1}] ${author}${year ? `, ${year}` : ""}`;
}

function projectStage(opts: {
  objectives: ReturnType<typeof normalizeObjectives>;
  hasMethods: boolean;
  hasEthics: boolean;
  hasFindings: boolean;
}) {
  if (opts.hasFindings) return "Results";
  if (opts.hasEthics) return "Ethics and admin";
  if (opts.hasMethods) return "Design";
  if (opts.objectives.length > 0) return "Aim and objectives";
  return "Idea or gap";
}

export function ChatFeature() {
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const { userId } = useAuthSession();
  const { studyDesign, saveSection, commitSection } = useStudyDesign(activeWorkspace?.id);
  const profileQuery = useQuery({
    queryKey: queryKeys.profile(userId ?? undefined),
    queryFn: () => peggyApi.getProfileOptional(),
    enabled: !!userId,
  });
  const literatureQuery = useQuery({
    queryKey: queryKeys.corpus("literature", activeWorkspace?.id),
    queryFn: () => peggyApi.listCorpus("literature", activeWorkspace?.id),
    enabled: !!activeWorkspace?.id,
  });
  const findingsQuery = useQuery({
    queryKey: queryKeys.corpus("own_findings", activeWorkspace?.id),
    queryFn: () => peggyApi.listCorpus("own_findings", activeWorkspace?.id),
    enabled: !!activeWorkspace?.id,
  });
  const [prefillQuery] = useResearchQuestionPrefill(activeWorkspace, profileQuery.data);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ChatMode>("auto");
  const [includeFindings, setIncludeFindings] = useState(true);
  const [sessionId, setSessionId] = useState("");
  const [agentData, setAgentData] = useState<AgentResponse | null>(null);
  const [agentPending, setAgentPending] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [usedOpen, setUsedOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  useEffect(() => {
    if (mode === "gap_analysis" && !query && prefillQuery) {
      setQuery(prefillQuery);
    }
  }, [mode, prefillQuery, query]);

  const sourceTypes = includeFindings ? ["literature", "own_findings"] : ["literature"];

  const queryClient = useQueryClient();

  const refreshUsage = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.usage });
  }, [queryClient]);

  const usageQuery = useQuery({
    queryKey: [...queryKeys.usage, mode],
    queryFn: () => peggyApi.usage(),
    retry: 1,
  });
  const limitsQuery = useQuery({
    queryKey: queryKeys.limits,
    queryFn: () => peggyApi.limits(),
    staleTime: 5 * 60_000,
  });

  const activeBucket = mode === "auto" ? usageQuery.data?.agent : usageQuery.data?.chat;
  const maxQueryLen = usageQuery.data?.max_text_query_len ?? 4000;
  const queryTooLong = query.length > maxQueryLen;
  const quotaExhausted = activeBucket?.remaining === 0;
  const unitLabel = mode === "auto" ? "agent runs" : "messages";

  const chat = useMutation({
    mutationFn: (q: string) => peggyApi.chat(q, { mode, sourceTypes, workspaceId: activeWorkspace?.id }),
    onSuccess: (data) => {
      refreshUsage();
      setTurns((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "peggy",
          text: data.response ?? "",
          sources: data.sources,
          limitations: data.limitations,
          body: data.body,
        },
      ]);
    },
    onError: (err: unknown) => {
      setTurns((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "peggy", text: formatApiError(err), error: true },
      ]);
    },
  });

  const runAgent = useCallback(
    async (q: string) => {
      setAgentPending(true);
      setAgentError(null);
      setAgentData(null);
      setStepLabel("Starting agent…");
      const sid = sessionId || getSessionId();
      try {
        for await (const event of peggyApi.agentStream(q, {
          sessionId: sid,
          sourceTypes,
          mode: "auto",
          workspaceId: activeWorkspace?.id,
        })) {
          applyStreamEvent(event);
        }
        refreshUsage();
      } catch (err) {
        const message = formatApiError(err);
        setAgentError(message);
        setTurns((prev) => [...prev, { id: crypto.randomUUID(), role: "peggy", text: message, error: true }]);
        refreshUsage();
      } finally {
        setAgentPending(false);
        setStepLabel(null);
      }
    },
    [sessionId, sourceTypes, refreshUsage, activeWorkspace?.id]
  );

  function applyStreamEvent(event: AgentStreamEvent) {
    if (event.type === "error" && event.message) {
      setAgentError(event.message);
      setTurns((prev) => [...prev, { id: crypto.randomUUID(), role: "peggy", text: event.message ?? "Error", error: true }]);
    }
    if (event.type === "step_start") {
      setStepLabel(event.summary ?? "Working…");
    }
    if (event.type === "tool_call" && event.tool) {
      setStepLabel(TOOL_LABELS[event.tool] ?? event.tool);
    }
    if (event.type === "tool_result" && event.tool) {
      setStepLabel(`Done: ${TOOL_LABELS[event.tool] ?? event.tool}`);
    }
    if (event.type === "final" && event.response) {
      setAgentData(event.response);
      setStepLabel(null);
      setTurns((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "peggy",
          text: event.response!.answer,
          sources: event.response!.sources,
          limitations: event.response!.limitations,
          body: event.response!.body,
        },
      ]);
    }
  }

  const handleSend = () => {
    if (!query || queryTooLong || quotaExhausted) return;
    const text = query;
    setTurns((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text }]);
    if (mode === "auto") {
      void runAgent(text);
    } else {
      chat.mutate(text);
    }
  };

  const isPending = mode === "auto" ? agentPending : chat.isPending;
  const sendDisabled = !query || isPending || queryTooLong || quotaExhausted;
  const latestPeggy = [...turns].reverse().find((t) => t.role === "peggy" && !t.error);
  const literatureCount = literatureQuery.data?.count ?? literatureQuery.data?.papers?.length ?? 0;
  const findingsCount = findingsQuery.data?.count ?? findingsQuery.data?.papers?.length ?? 0;
  const objectives = normalizeObjectives(activeWorkspace?.objectives);
  const stage = projectStage({
    objectives,
    hasMethods: !!(studyDesign.methodsPlan?.userPlan?.trim() || (studyDesign.methodsPlan?.steps?.length ?? 0)),
    hasEthics: !!(studyDesign.ethics?.approvalObtained || studyDesign.ethics?.fmhsTrack),
    hasFindings: findingsCount > 0,
  });

  const addToMethods = () => {
    if (!latestPeggy?.text) return;
    const existing = studyDesign.methodsPlan?.userPlan ?? "";
    const next = existing.trim() ? `${existing.trim()}\n\n${latestPeggy.text}` : latestPeggy.text;
    saveSection("methodsPlan", { userPlan: next });
    void commitSection("methodsPlan", { ...(studyDesign.methodsPlan ?? {}), userPlan: next });
    router.push("/study-design/methods-plan");
  };

  const chipSx = (active: boolean) =>
    active
      ? { bgcolor: peggyColors.primary, color: peggyColors.primaryForeground, "& .MuiChip-label": { ...monoSx, fontSize: 11 } }
      : {
          bgcolor: peggyColors.muted,
          border: `0.5px solid ${peggyColors.border}`,
          "& .MuiChip-label": { ...monoSx, fontSize: 11, color: peggyColors.mutedForeground },
        };

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography sx={{ ...eyebrowSx, color: peggyColors.accent }}>ASK PEGGY</Typography>
        <Typography variant="h1" sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 600, letterSpacing: "-0.02em" }}>
          Ask Peggy
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          Answers cite your papers. Peggy says when the evidence is thin.
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
          <StatusChip tone="neutral" label={`Stage: ${stage}`} />
          <StatusChip tone="accent" label={`Literature ${literatureCount}`} />
          <StatusChip tone="neutral" label={`Our findings ${findingsCount}`} />
        </Stack>
      </Stack>

      <UsageQuotaBanner
        isError={usageQuery.isError}
        bucket={activeBucket}
        unitLabel={unitLabel}
        quotaExhausted={quotaExhausted}
        freeTierNotice={limitsQuery.data?.llm?.free_tier ? limitsQuery.data.llm.notice : undefined}
      />

      <Paper variant="outlined" sx={{ p: 2.5, bgcolor: peggyColors.surface }}>
        <Stack spacing={2}>
          {turns.length === 0 && !isPending && (
            <Typography variant="body2" color="text.secondary">
              {literatureCount === 0
                ? "No papers yet. Add literature so answers can cite your corpus."
                : "Ask about your papers, your plan or your findings."}
            </Typography>
          )}

          {turns.map((turn) =>
            turn.role === "user" ? (
              <Stack key={turn.id} direction="row" justifyContent="flex-end" sx={{ pl: { sm: 12 } }}>
                <Box sx={{ bgcolor: peggyColors.primary, color: peggyColors.primaryForeground, px: 2, py: 1, borderRadius: 1, maxWidth: "100%" }}>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {turn.text}
                  </Typography>
                </Box>
              </Stack>
            ) : (
              <Stack key={turn.id} direction="row" justifyContent="flex-start" sx={{ pr: { sm: 12 } }}>
                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent, mb: 1 }}>
                    PEGGY
                  </Typography>
                  {turn.error ? (
                    <Alert severity="error">{turn.text}</Alert>
                  ) : (
                    <>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: peggyColors.foreground }}>
                        {turn.text}
                      </Typography>
                      {turn.body ? <WorkflowResults mode={mode === "auto" ? "chat" : mode} body={turn.body} /> : null}
                      {(turn.sources?.length ?? 0) > 0 && (
                        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                          {turn.sources!.map((s, i) => (
                            <StatusChip key={s.chunk_id} tone="neutral" label={sourceChipLabel(s, i)} />
                          ))}
                        </Stack>
                      )}
                      {(turn.limitations?.length ?? 0) > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                          Limits: {turn.limitations!.join(" ")}
                        </Typography>
                      )}
                    </>
                  )}
                </Paper>
              </Stack>
            )
          )}

          {isPending && (
            <Stack direction="row" justifyContent="flex-start" sx={{ pr: { sm: 12 } }}>
              <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent, mb: 1 }}>
                  PEGGY
                </Typography>
                <LinearProgress />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  {stepLabel ?? "Working…"}
                </Typography>
              </Paper>
            </Stack>
          )}

          {latestPeggy && !isPending && (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button variant="outlined" onClick={addToMethods} sx={{ textTransform: "none" }}>
                Add to Methods plan
              </Button>
              <Button variant="text" onClick={() => router.push("/validate/literature")} sx={{ textTransform: "none", color: peggyColors.accent }}>
                Open papers
              </Button>
              <Button variant="text" onClick={() => setUsedOpen(true)} sx={{ textTransform: "none", color: peggyColors.accent }}>
                What Peggy used
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      {(mode === "compare" || mode === "gap_analysis") && (
        <ProjectContextImport
          onImport={(text) => setQuery((prev) => (prev.trim() ? `${prev.trim()}\n\n---\n\n${text}` : text))}
        />
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <TextField
          id="peggy-chat-query"
          name="query"
          placeholder="Ask about your papers, your plan or your findings"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
          multiline
          minRows={2}
          error={queryTooLong}
          helperText={
            queryTooLong ? `Question must be under ${maxQueryLen.toLocaleString()} characters.` : undefined
          }
          InputProps={{ disableUnderline: true }}
          variant="standard"
        />
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          {MODES.map((m) => (
            <Chip key={m.id} label={m.label} onClick={() => setMode(m.id)} sx={chipSx(mode === m.id)} />
          ))}
          <Box sx={{ flex: 1 }} />
          <DisabledTooltipButton title={!query.trim() ? "Type a question first" : quotaExhausted ? "Hourly limit reached" : ""}>
            <span>
              <Button variant="contained" disabled={sendDisabled} onClick={handleSend} sx={{ textTransform: "none" }}>
                {isPending ? <CircularProgress size={22} color="inherit" /> : "Send"}
              </Button>
            </span>
          </DisabledTooltipButton>
        </Stack>
        <FormControlLabel
          control={
            <Switch
              id="peggy-include-findings"
              name="include_findings"
              checked={includeFindings}
              onChange={(e) => setIncludeFindings(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="caption">Include our findings in retrieval</Typography>}
          sx={{ mt: 1, ml: 0 }}
        />
      </Paper>

      <WhatPeggyUsedDrawer
        open={usedOpen}
        onClose={() => setUsedOpen(false)}
        sources={latestPeggy?.sources ?? agentData?.sources ?? chat.data?.sources ?? []}
        confidence={agentData?.confidence ?? chat.data?.confidence}
        limitations={latestPeggy?.limitations ?? agentData?.limitations ?? chat.data?.limitations}
      />
    </Stack>
  );
}
