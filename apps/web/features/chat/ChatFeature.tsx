"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { peggyApi, type ChatMode } from "@/lib/api";
import { SourceCards } from "@/components/SourceCards";
import { WorkflowResults } from "@/components/WorkflowResults";

const MODES: { id: ChatMode; label: string; hint: string }[] = [
  { id: "auto", label: "Auto", hint: "Detect chat, gap analysis, or comparison from your question" },
  { id: "chat", label: "Ask", hint: "Grounded Q&A with citations" },
  { id: "gap_analysis", label: "Gaps", hint: "Structured gap table vs corpus" },
  { id: "compare", label: "Compare", hint: "Your finding vs literature (paste finding in the question)" },
];

export function ChatFeature() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ChatMode>("auto");
  const [includeFindings, setIncludeFindings] = useState(true);

  const sourceTypes = includeFindings ? ["literature", "own_findings"] : ["literature"];

  const chat = useMutation({
    mutationFn: (q: string) => peggyApi.chat(q, { mode, sourceTypes }),
  });

  const activeMode = chat.data?.mode ?? mode;

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
        placeholder={
          mode === "gap_analysis"
            ? "e.g. Gaps in microbiome and type-2 diabetes research given our cohort results"
            : mode === "compare"
              ? "e.g. Butyrate producers were reduced in our N=45 cohort"
              : "Ask anything about your literature and findings corpus"
        }
      />
      <Button variant="contained" disabled={!query || chat.isPending} onClick={() => chat.mutate(query)}>
        {chat.isPending ? <CircularProgress size={24} /> : "Send"}
      </Button>

      {chat.isError && <Alert severity="error">{(chat.error as Error).message}</Alert>}

      {chat.data && (
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
