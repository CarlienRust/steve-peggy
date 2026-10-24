"use client";

import { useCallback, useEffect, useState } from "react";
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
import { useAuthSession } from "@/lib/authContext";
import { eyebrowSx, monoSx, peggyColors } from "@/theme/peggyTheme";

const HOME_MODES: { id: ChatMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "chat", label: "Ask" },
];

const SESSION_KEY = "peggy_home_chat_session_id";

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
  summarise_context: "Summarising context",
};

type ChatTurn = {
  id: string;
  role: "user" | "peggy";
  text: string;
  sources?: SourceCitation[];
  limitations?: string[];
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
};

/** Ask Peggy from the home shell — general help, optional project for corpus context. */
export function HomeAskPeggyFeature({ embedded = false }: HomeAskPeggyFeatureProps) {
  const { ready, userId } = useAuthSession();
  const queryClient = useQueryClient();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ChatMode>("chat");
  const [sessionId, setSessionId] = useState("");
  const [agentData, setAgentData] = useState<AgentResponse | null>(null);
  const [agentPending, setAgentPending] = useState(false);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [usedOpen, setUsedOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);

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

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

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

  const chat = useMutation({
    mutationFn: (q: string) =>
      peggyApi.chat(q, { mode, sourceTypes: ["literature"], workspaceId }),
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
        },
      ]);
    }
  }

  const runAgent = useCallback(
    async (q: string) => {
      setAgentPending(true);
      setAgentData(null);
      setStepLabel("Starting agent…");
      const sid = sessionId || getSessionId();
      try {
        for await (const event of peggyApi.agentStream(q, {
          sessionId: sid,
          sourceTypes: ["literature"],
          mode: "auto",
          workspaceId,
        })) {
          applyStreamEvent(event);
        }
        refreshUsage();
      } catch (err) {
        const message = formatApiError(err);
        setTurns((prev) => [...prev, { id: crypto.randomUUID(), role: "peggy", text: message, error: true }]);
        refreshUsage();
      } finally {
        setAgentPending(false);
        setStepLabel(null);
      }
    },
    [sessionId, refreshUsage, workspaceId]
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
      {!embedded ? <LocalDevBanner /> : null}
      {!embedded ? (
        <Stack spacing={1}>
          <Typography sx={{ ...eyebrowSx, color: peggyColors.accent }}>ASK PEGGY</Typography>
          <Typography variant="h1" sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 600, letterSpacing: "-0.02em" }}>
            General help
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, maxWidth: 720 }}>
            Ask about research methods, study design, or how to use Peggy. Pick a project below when you want answers
            grounded in that project&apos;s literature.
          </Typography>
        </Stack>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <FormControl fullWidth size="small">
          <InputLabel id="home-ask-project-label">Project context (optional)</InputLabel>
          <Select
            labelId="home-ask-project-label"
            label="Project context (optional)"
            value={selectedWorkspaceId}
            onChange={(e) => setSelectedWorkspaceId(e.target.value)}
          >
            <MenuItem value="">
              <em>No project — general guidance only</em>
            </MenuItem>
            {workspaces.map((ws) => (
              <MenuItem key={ws.id} value={ws.id}>
                {ws.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {selectedWorkspaceId ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Literature in this project: {literatureQuery.isLoading ? "…" : literatureCount} paper
            {literatureCount === 1 ? "" : "s"}
            {literatureCount === 0 ? " — add papers in the project for cited answers." : ""}
          </Typography>
        ) : null}
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
            <Typography variant="body2" color="text.secondary">
              {selectedWorkspaceId && literatureCount === 0
                ? "This project has no literature yet. You can still ask general questions, or add papers in the project first."
                : "Try: “How should I phrase a primary outcome?” or “What belongs in an ethics application?”"}
            </Typography>
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

          {latestPeggy && !isPending && (latestPeggy.sources?.length ?? 0) > 0 && (
            <Button variant="text" onClick={() => setUsedOpen(true)} sx={{ textTransform: "none", color: peggyColors.accent, alignSelf: "flex-start" }}>
              What Peggy used
            </Button>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <TextField
          id="peggy-home-chat-query"
          name="query"
          placeholder="Ask a general research or methods question…"
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
          {HOME_MODES.map((m) => (
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
