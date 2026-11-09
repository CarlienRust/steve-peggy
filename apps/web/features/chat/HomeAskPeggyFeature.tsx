"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  formatApiError,
  peggyApi,
  queryKeys,
  type AgentResponse,
  type AgentStreamEvent,
  type ChatMode,
  type SourceCitation,
} from "@/lib/api";
import { UsageQuotaBanner } from "@/features/chat/UsageQuotaBanner";
import { WhatPeggyUsedDrawer } from "@/components/WhatPeggyUsedDrawer";
import { DisabledTooltipButton } from "@/components/DisabledTooltipButton";
import { StatusChip } from "@/components/StatusChip";
import { LocalDevBanner } from "@/components/LocalDevBanner";
import { ProjectContextImport } from "@/components/ProjectContextImport";
import { WorkflowResults } from "@/components/WorkflowResults";
import { useAuthSession } from "@/lib/authContext";
import { useResearchQuestionPrefill } from "@/lib/useResearchQuestionPrefill";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { useOptionalWorkspace } from "@/lib/workspaceContext";
import { eyebrowSx, monoSx, peggyColors } from "@/theme/peggyTheme";

const HOME_MODES: { id: ChatMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "chat", label: "Ask" },
];

const PROJECT_MODES: { id: ChatMode; label: string }[] = [
  ...HOME_MODES,
  { id: "gap_analysis", label: "Gaps" },
  { id: "compare", label: "Compare" },
];

const SUGGESTED_QUESTIONS = [
  "Summarise the evidence for...",
  "Compare findings across studies",
  "Identify inconsistencies in the literature",
  "What research gaps remain?",
];

type SourceChoice = "literature" | "own_findings" | "both";

function sourceTypesFromChoice(choice: SourceChoice): string[] {
  if (choice === "own_findings") return ["own_findings"];
  if (choice === "both") return ["literature", "own_findings"];
  return ["literature"];
}

function sessionKey(locked: boolean) {
  return locked ? "peggy_chat_session_id" : "peggy_home_chat_session_id";
}

function getSessionId(locked: boolean): string {
  if (typeof window === "undefined") return "server";
  const key = sessionKey(locked);
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
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

type HomeAskPeggyFeatureProps = {
  /** Side drawer in HomeAppShell — omit page chrome. */
  embedded?: boolean;
  /** In-project Ask Peggy: lock the current workspace and keep Gaps/Compare. */
  lockedWorkspaceId?: string;
  projectExtras?: boolean;
};

/** Ask Peggy — same layout on Home `/ask` and in a project `/chat`. */
export function HomeAskPeggyFeature({
  embedded = false,
  lockedWorkspaceId,
  projectExtras = false,
}: HomeAskPeggyFeatureProps) {
  const router = useRouter();
  const { ready, userId } = useAuthSession();
  const queryClient = useQueryClient();
  const workspaceCtx = useOptionalWorkspace();
  const activeWorkspace = workspaceCtx?.activeWorkspace ?? null;
  const { studyDesign, saveSection, commitSection } = useStudyDesign(
    projectExtras ? lockedWorkspaceId ?? activeWorkspace?.id : undefined
  );
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(lockedWorkspaceId ?? "");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ChatMode>("chat");
  const [sessionId, setSessionId] = useState("");
  const [agentData, setAgentData] = useState<AgentResponse | null>(null);
  const [agentPending, setAgentPending] = useState(false);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [usedOpen, setUsedOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sourceChoice, setSourceChoice] = useState<SourceChoice>("both");
  const abortRef = useRef<AbortController | null>(null);

  const proposalsQuery = useQuery({
    queryKey: ["agent-proposals", selectedWorkspaceId],
    queryFn: () => peggyApi.listAgentProposals(selectedWorkspaceId),
    enabled: !!selectedWorkspaceId,
  });

  const workspacesQuery = useQuery({
    queryKey: queryKeys.workspaces(userId ?? undefined),
    queryFn: () => peggyApi.listWorkspaces(),
    enabled: ready && !!userId,
  });

  const literatureQuery = useQuery({
    queryKey: queryKeys.corpus("literature", selectedWorkspaceId || undefined),
    queryFn: () => peggyApi.listCorpus("literature", selectedWorkspaceId),
    enabled: !!selectedWorkspaceId,
  });
  const findingsQuery = useQuery({
    queryKey: queryKeys.corpus("own_findings", selectedWorkspaceId || undefined),
    queryFn: () => peggyApi.listCorpus("own_findings", selectedWorkspaceId),
    enabled: !!selectedWorkspaceId,
  });

  useEffect(() => {
    if (lockedWorkspaceId) setSelectedWorkspaceId(lockedWorkspaceId);
  }, [lockedWorkspaceId]);

  useEffect(() => {
    setSessionId(getSessionId(!!lockedWorkspaceId));
  }, [lockedWorkspaceId]);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(userId ?? undefined),
    queryFn: () => peggyApi.getProfileOptional(),
    enabled: projectExtras && !!userId,
  });
  const workspaceForPrefill = projectExtras
    ? activeWorkspace ??
      workspacesQuery.data?.workspaces.find((w) => w.id === (lockedWorkspaceId ?? selectedWorkspaceId))
    : undefined;
  const [prefillQuery] = useResearchQuestionPrefill(workspaceForPrefill, profileQuery.data);

  useEffect(() => {
    if (projectExtras && mode === "gap_analysis" && !query && prefillQuery) {
      setQuery(prefillQuery);
    }
  }, [projectExtras, mode, prefillQuery, query]);

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
  const workspaceId = selectedWorkspaceId || undefined;
  const literatureCount = literatureQuery.data?.count ?? 0;
  const findingsCount = findingsQuery.data?.count ?? 0;
  const sourceTypes = sourceTypesFromChoice(sourceChoice);

  const chat = useMutation({
    mutationFn: (q: string) =>
      peggyApi.chat(q, { mode, sourceTypes, workspaceId }),
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

  function applyStreamEvent(event: AgentStreamEvent) {
    if (event.type === "error" && event.message) {
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

  const runAgent = useCallback(
    async (q: string) => {
      setAgentPending(true);
      setAgentData(null);
      setStepLabel("Starting agent…");
      const sid = sessionId || getSessionId(!!lockedWorkspaceId);
      try {
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        for await (const event of peggyApi.agentStream(q, {
          sessionId: sid,
          sourceTypes,
          mode: "auto",
          workspaceId,
          signal: abortRef.current.signal,
        })) {
          applyStreamEvent(event);
        }
        refreshUsage();
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const message = formatApiError(err);
        setTurns((prev) => [...prev, { id: crypto.randomUUID(), role: "peggy", text: message, error: true }]);
        refreshUsage();
      } finally {
        setAgentPending(false);
        setStepLabel(null);
      }
    },
    [sessionId, refreshUsage, workspaceId, sourceChoice, lockedWorkspaceId]
  );

  const handleSend = () => {
    if (!query || queryTooLong || quotaExhausted) return;
    const text = query;
    setQuery("");
    setTurns((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text }]);
    if (mode === "auto") {
      void runAgent(text);
    } else {
      chat.mutate(text);
    }
  };

  const isPending = mode === "auto" ? agentPending : chat.isPending;
  const sendDisabled = !query.trim() || isPending || queryTooLong || quotaExhausted;
  const latestPeggy = [...turns].reverse().find((t) => t.role === "peggy" && !t.error);

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

  const workspaces = workspacesQuery.data?.workspaces ?? [];

  return (
    <Stack spacing={embedded ? 2 : 3}>
      {!embedded && !lockedWorkspaceId ? <LocalDevBanner /> : null}
      {limitsQuery.data?.llm?.notice ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {limitsQuery.data.llm.notice}
        </Alert>
      ) : null}
      {!embedded ? (
        <Stack spacing={1}>
          <Typography sx={{ ...eyebrowSx, color: peggyColors.accent }}>ASK PEGGY</Typography>
          <Typography variant="h1" sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Research assistant
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, maxWidth: 720 }}>
            Ask questions grounded in your research.
          </Typography>
        </Stack>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        {!embedded ? (
          <Typography sx={{ ...eyebrowSx, mb: 1.5 }}>Research context</Typography>
        ) : null}
        <Stack spacing={1.5}>
          <FormControl fullWidth size="small">
            <InputLabel id="home-ask-project-label">Project</InputLabel>
            <Select
              labelId="home-ask-project-label"
              label="Project"
              value={selectedWorkspaceId}
              disabled={!!lockedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
            >
              {!lockedWorkspaceId ? (
                <MenuItem value="">
                  <em>Select project</em>
                </MenuItem>
              ) : null}
              {workspaces.map((ws) => (
                <MenuItem key={ws.id} value={ws.id}>
                  {ws.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel id="home-ask-sources-label">Sources</InputLabel>
            <Select
              labelId="home-ask-sources-label"
              label="Sources"
              value={sourceChoice}
              onChange={(e) => setSourceChoice(e.target.value as SourceChoice)}
            >
              <MenuItem value="literature">Literature</MenuItem>
              <MenuItem value="own_findings">Own findings</MenuItem>
              <MenuItem value="both">Literature + Own findings</MenuItem>
            </Select>
          </FormControl>
        </Stack>
        {selectedWorkspaceId ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            {literatureQuery.isLoading || findingsQuery.isLoading
              ? "…"
              : `${literatureCount} literature paper${literatureCount === 1 ? "" : "s"} · ${findingsCount} internal finding${findingsCount === 1 ? "" : "s"}`}
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Pick a project when you want answers cited from that corpus.
          </Typography>
        )}
      </Paper>

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
            <Stack spacing={1.5} sx={{ textAlign: embedded ? "left" : "center", py: embedded ? 0 : 2 }}>
              {!embedded ? (
                <Typography sx={{ ...monoSx, fontSize: 12, letterSpacing: "1.2px", color: peggyColors.accent }}>
                  Peggy
                </Typography>
              ) : null}
              <Typography variant="body2" color="text.secondary">
                {embedded
                  ? "Ask a research question."
                  : "What would you like to investigate?"}
              </Typography>
              {!embedded ? (
                <>
                  <Typography variant="caption" color="text.secondary">
                    Suggested questions
                  </Typography>
                  <Stack spacing={0.75} alignItems="center">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <Button key={q} size="small" variant="text" onClick={() => setQuery(q)}>
                        {q}
                      </Button>
                    ))}
                  </Stack>
                </>
              ) : null}
            </Stack>
          )}

          {turns.map((turn) =>
            turn.role === "user" ? (
              <Stack key={turn.id} direction="row" justifyContent="flex-end" sx={{ pl: { sm: 12 } }}>
                <Box
                  sx={{
                    bgcolor: peggyColors.primary,
                    color: peggyColors.primaryForeground,
                    px: 2,
                    py: 1,
                    borderRadius: 1,
                    maxWidth: "100%",
                  }}
                >
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

          {latestPeggy && !isPending && (projectExtras || (latestPeggy.sources?.length ?? 0) > 0) && (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {projectExtras ? (
                <>
                  <Button variant="outlined" onClick={addToMethods}>
                    Add to Methods plan
                  </Button>
                  <Button variant="text" onClick={() => router.push("/validate/literature")} sx={{ color: peggyColors.accent }}>
                    Open papers
                  </Button>
                </>
              ) : null}
              {(latestPeggy.sources?.length ?? 0) > 0 ? (
                <Button variant="text" onClick={() => setUsedOpen(true)} sx={{ color: peggyColors.accent }}>
                  What Peggy used
                </Button>
              ) : null}
            </Stack>
          )}
        </Stack>
      </Paper>

      {projectExtras && !embedded ? (
        <ProjectContextImport
          sections={["samples", "methods", "analysis", "findings"]}
          onImport={(text) => setQuery((prev) => (prev.trim() ? `${prev.trim()}\n\n---\n\n${text}` : text))}
        />
      ) : null}

      {(proposalsQuery.data?.proposals ?? []).filter((p) => p.status === "pending").map((p) => (
        <Paper key={p.id} variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="body2" fontWeight={600}>
            Proposal: {p.kind}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button size="small" onClick={() => void peggyApi.acceptAgentProposal(p.id).then(() => proposalsQuery.refetch())}>
              Accept
            </Button>
            <Button size="small" onClick={() => void peggyApi.dismissAgentProposal(p.id).then(() => proposalsQuery.refetch())}>
              Dismiss
            </Button>
          </Stack>
        </Paper>
      ))}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <TextField
          id="peggy-home-chat-query"
          name="query"
          placeholder="Ask a research question..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
          multiline
          minRows={2}
          error={queryTooLong}
          helperText={queryTooLong ? `Question must be under ${maxQueryLen.toLocaleString()} characters.` : undefined}
          InputProps={{ disableUnderline: true }}
          variant="standard"
        />
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          {(projectExtras ? PROJECT_MODES : HOME_MODES).map((m) => (
            <Chip key={m.id} label={m.label} onClick={() => setMode(m.id)} sx={chipSx(mode === m.id)} />
          ))}
          <Box sx={{ flex: 1 }} />
          <DisabledTooltipButton title={!query.trim() ? "Type a question first" : quotaExhausted ? "Hourly limit reached" : ""}>
            <span>
              {agentPending ? (
                <Button
                  variant="outlined"
                  onClick={() => abortRef.current?.abort()}
                  sx={{ textTransform: "none" }}
                >
                  Stop
                </Button>
              ) : null}
              <Button variant="contained" disabled={sendDisabled} onClick={handleSend} sx={{ textTransform: "none" }}>
                {isPending ? <CircularProgress size={22} color="inherit" /> : "Send"}
              </Button>
            </span>
          </DisabledTooltipButton>
        </Stack>
      </Paper>

      <WhatPeggyUsedDrawer
        open={usedOpen}
        onClose={() => setUsedOpen(false)}
        sources={latestPeggy?.sources ?? agentData?.sources ?? chat.data?.sources ?? []}
        confidence={agentData?.confidence ?? chat.data?.confidence}
        limitations={latestPeggy?.limitations ?? agentData?.limitations ?? chat.data?.limitations}
        toolsUsed={agentData?.tools_used}
        steps={agentData?.steps}
        datasetSummary={Boolean(studyDesign.analysisTool?.sharedAt)}
      />
    </Stack>
  );
}
