"use client";

import { useMutation } from "@tanstack/react-query";
import { Alert, Button, CircularProgress, Stack, TextField, Typography, Paper } from "@mui/material";
import { useState } from "react";
import { peggyApi } from "@/lib/api";
import { SourceCards } from "@/components/SourceCards";

export function ChatFeature() {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<{ q: string; answer: string }[]>([]);

  const chat = useMutation({
    mutationFn: (q: string) => peggyApi.chat(q),
    onSuccess: (data) => {
      setHistory((h) => [...h, { q: query, answer: data.response }]);
    },
  });

  return (
    <Stack spacing={2}>
      <TextField label="Ask Peggy" value={query} onChange={(e) => setQuery(e.target.value)} fullWidth multiline rows={3} />
      <Button variant="contained" disabled={!query || chat.isPending} onClick={() => chat.mutate(query)}>
        {chat.isPending ? <CircularProgress size={24} /> : "Send"}
      </Button>
      {chat.data && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="body1">{chat.data.response}</Typography>
          <SourceCards sources={chat.data.sources} confidence={chat.data.confidence} limitations={chat.data.limitations} />
        </Paper>
      )}
      {chat.isError && <Alert severity="error">{(chat.error as Error).message}</Alert>}
      {history.slice(-3).map((h, i) => (
        <Typography key={i} variant="caption" color="text.secondary">Q: {h.q.slice(0, 80)}…</Typography>
      ))}
    </Stack>
  );
}
