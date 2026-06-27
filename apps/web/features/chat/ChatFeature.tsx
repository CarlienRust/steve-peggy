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
import {
  PeggyApiError,
  peggyApi,
  queryKeys,
  type AgentResponse,
  type AgentStreamEvent,
  type ChatMode,
  type RateLimitBucket,
} from "@/lib/api";
import { SourceCards } from "@/components/SourceCards";
import { WorkflowResults } from "@/components/WorkflowResults";

const MODES: { id: ChatMode; label: string; hint: string }[] = [
  { id: "auto", label: "Auto", hint: "Reactive agent — searches corpus and picks tools automatically" },
  { id: "chat", label: "Ask", hint: "Grounded Q&A with citations" },
  { id: "gap_analysis", label: "Gaps", hint: "Structured gap table vs corpus" },
  { id: "compare", label: "Compare", hint: "Your finding vs literature (paste finding in the question)" },
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

function formatResetsAt(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function usageLabel(bucket: RateLimitBucket, unitLabel: string): string {
  if (bucket.remaining === 0) {
    return `No ${unitLabel} left this hour · resets ${formatResetsAt(bucket.resets_at)}`;
  }
  return `${bucket.remaining} of ${bucket.limit} ${unitLabel} left · resets ${formatResetsAt(bucket.resets_at)}`;
}

function formatApiError(err: unknown): string {
  if (err instanceof PeggyApiError) {
    if (err.resetsAt) {
      return `${err.message} Resets ${formatResetsAt(err.resetsAt)}.`;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
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

export function ChatFeature() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ChatMode>("auto");
  const [includeFindings, setIncludeFindings] = useState(true);
  const [sessionId, setSessionId] = useState("");
  const [agentData, setAgentData] = useState<AgentResponse | null>(null);
  const [agentPending, setAgentPending] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [stepLabel, setStepLabel] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  const sourceTypes = includeFindings ? ["literature", "own_findings"] : ["literature"];

  const queryClient = useQueryClient();

  const refreshUsage = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.usage });
  }, [queryClient]);

  const usageQuery = useQuery({
    queryKey: [...queryKeys.usage, mode],
    queryFn: () => peggyApi.usage(),
  });

  const activeBucket = mode === "auto" ? usageQuery.data?.agent : usageQuery.data?.chat;
  const maxQueryLen = usageQuery.data?.max_text_query_len ?? 4000;
  const queryTooLong = query.length > maxQueryLen;
  const quotaExhausted = activeBucket?.remaining === 0;
  const unitLabel = mode === "auto" ? "agent runs" : "messages";

  const chat = useMutation({
    mutationFn: (q: string) => peggyApi.chat(q, { mode, sourceTypes }),
    onSuccess: refreshUsage,
  });

  const runAgent = useCallback(
    async (q: string) => {
      setAgentPending(true);
      setAgentError(null);
      setAgentData(null);
      setStepLabel("Starting agent…");
      const sid = sessionId || getSessionId();
      try {
        for await (const event of peggyApi.agentStream(q, { sessionId: sid, sourceTypes, mode: "auto" })) {
          applyStreamEvent(event);
        }
        refreshUsage();
      } catch (err) {
        setAgentError(formatApiError(err));
        refreshUsage();
      } finally {
        setAgentPending(false);
        setStepLabel(null);
      }
    },
    [sessionId, sourceTypes, refreshUsage]
  );

  function applyStreamEvent(event: AgentStreamEvent) {
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
    }
  }

  const handleSend = () => {
    if (!query || queryTooLong || quotaExhausted) return;
    if (mode === "auto") {
      void runAgent(query);
    } else {
      chat.mutate(query);
    }
  };

  const isPending = mode === "auto" ? agentPending : chat.isPending;
  const activeMode = mode === "auto" ? "auto" : (chat.data?.mode ?? mode);
  const sendDisabled = !query || isPending || queryTooLong || quotaExhausted;

  return (
    <Stack spacing={2}>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {MODES.map((m) => (
          <Chip
            key={m.id}
            label={m.label}
            onClick={() => setMode(m.id)}
            color={mode === m.id ? "primary" : "default"}
            variant={mode === m.id ? "filled" : "outlined"}
          />
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {MODES.find((m) => m.id === mode)?.hint}
      </Typography>

      {usageQuery.isError && (
        <Alert severity="warning" variant="outlined">
          Usage unavailable — hourly message limits still apply on the server.
        </Alert>
      )}
      {activeBucket && !usageQuery.isError && (
        <Alert severity={quotaExhausted ? "warning" : "info"}>
          {usageLabel(activeBucket, unitLabel)}
        </Alert>
      )}

      <FormControlLabel
        control={<Switch checked={includeFindings} onChange={(e) => setIncludeFindings(e.target.checked)} />}
        label="Include our findings in retrieval"
      />

      <TextField
        label={mode === "compare" ? "Your finding to compare" : "Ask Peggy"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        fullWidth
        multiline
        rows={3}
        error={queryTooLong}
        helperText={
          queryTooLong
            ? `Question must be under ${maxQueryLen.toLocaleString()} characters.`
            : `${query.length.toLocaleString()} / ${maxQueryLen.toLocaleString()} characters`
        }
        placeholder={
          mode === "gap_analysis"
            ? "e.g. Gaps in microbiome and type-2 diabetes research given our cohort results"
            : mode === "compare"
              ? "e.g. Butyrate producers were reduced in our N=45 cohort"
              : "Ask anything about your literature and findings corpus"
        }
      />
      <Button variant="contained" disabled={sendDisabled} onClick={handleSend}>
        {isPending ? <CircularProgress size={24} /> : "Send"}
      </Button>

      {mode === "auto" && agentPending && (
        <Box>
          <LinearProgress />
          {stepLabel && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              {stepLabel}
            </Typography>
          )}
        </Box>
      )}

      {mode === "auto" && agentError && <Alert severity="error">{agentError}</Alert>}
      {mode !== "auto" && chat.isError && <Alert severity="error">{formatApiError(chat.error)}</Alert>}

      {mode === "auto" && agentData && (
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.06em", mr: 1 }}>
              Agent
            </Typography>
            {agentData.tools_used.map((t) => (
              <Chip key={t} label={t.replace(/_/g, " ")} size="small" variant="outlined" />
            ))}
          </Stack>
          {agentData.truncated && (
            <Alert severity="warning" sx={{ mb: 1 }}>
              Agent reached the step limit — answer may be incomplete.
            </Alert>
          )}
          <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
            {agentData.answer}
          </Typography>
          <WorkflowResults
            mode={
              agentData.body && "gaps" in agentData.body
                ? "gap_analysis"
                : agentData.body && "agreement" in agentData.body
                  ? "compare"
                  : "chat"
            }
            body={agentData.body}
          />
          <SourceCards sources={agentData.sources} confidence={agentData.confidence} limitations={agentData.limitations} />
        </Paper>
      )}

      {mode !== "auto" && chat.data && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Mode: {activeMode.replace("_", " ")}
          </Typography>
          {chat.data.response && (
            <Typography variant="body1" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
              {chat.data.response}
            </Typography>
          )}
          <WorkflowResults mode={activeMode} body={chat.data.body} />
          <SourceCards sources={chat.data.sources} confidence={chat.data.confidence} limitations={chat.data.limitations} />
        </Paper>
      )}
    </Stack>
  );
}
