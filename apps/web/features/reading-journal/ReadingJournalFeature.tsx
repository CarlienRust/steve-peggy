"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { LocalDevBanner } from "@/components/LocalDevBanner";
import { formatApiError, peggyApi, queryKeys, type PaperRecord } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { eyebrowSx } from "@/theme/peggyTheme";

export function ReadingJournalFeature() {
  const { ready, userId } = useAuthSession();
  const queryClient = useQueryClient();
  const [filterWs, setFilterWs] = useState("");
  const [filterRead, setFilterRead] = useState<"all" | "read" | "unread">("all");
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});

  const workspacesQuery = useQuery({
    queryKey: queryKeys.workspaces(userId ?? undefined),
    queryFn: () => peggyApi.listWorkspaces(),
    enabled: ready && !!userId,
  });
  const papersQuery = useQuery({
    queryKey: queryKeys.corpus("literature", filterWs || undefined),
    queryFn: () => peggyApi.listCorpus("literature", filterWs || undefined),
    enabled: ready && !!userId,
  });

  const savePaper = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PaperRecord> }) => peggyApi.updatePaper(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["corpus"] }),
  });

  const workspaces = workspacesQuery.data?.workspaces ?? [];
  const papers = useMemo(() => {
    const list = papersQuery.data?.papers ?? [];
    return list.filter((p) => {
      if (filterRead === "read") return !!p.read_at;
      if (filterRead === "unread") return !p.read_at;
      return true;
    });
  }, [papersQuery.data?.papers, filterRead]);

  return (
    <Box>
      <LocalDevBanner />
      <Typography sx={eyebrowSx}>HOME</Typography>
      <Typography variant="h4" fontWeight={600} sx={{ mb: 1 }}>
        Reading journal
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        Research papers from your literature corpus only. Ethics letters and uploaded results are not listed. Screening status on literature search is unchanged.
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Project</InputLabel>
          <Select label="Project" value={filterWs} onChange={(e) => setFilterWs(e.target.value)}>
            <MenuItem value="">All projects</MenuItem>
            {workspaces.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Read</InputLabel>
          <Select
            label="Read"
            value={filterRead}
            onChange={(e) => setFilterRead(e.target.value as "all" | "read" | "unread")}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="unread">Unread</MenuItem>
            <MenuItem value="read">Read</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      {papersQuery.isError ? <Alert severity="error">{formatApiError(papersQuery.error)}</Alert> : null}
      {savePaper.isError ? <Alert severity="error">{formatApiError(savePaper.error)}</Alert> : null}
      <Stack spacing={1.5}>
        {papers.map((paper) => {
          const id = paper.id;
          if (id == null) return null;
          const notes = notesDraft[id] ?? paper.notes ?? "";
          return (
            <Paper key={id} variant="outlined" sx={{ p: 2 }}>
              <Typography fontWeight={600}>{paper.title || "Untitled"}</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                {paper.source_type} {paper.year ? `· ${paper.year}` : ""} {paper.read_at ? `· read ${new Date(paper.read_at).toLocaleDateString()}` : "· unread"}
              </Typography>
              <TextField
                label="Notes"
                value={notes}
                onChange={(e) => setNotesDraft((d) => ({ ...d, [id]: e.target.value }))}
                fullWidth
                multiline
                minRows={2}
                sx={{ mb: 1 }}
              />
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    savePaper.mutate({
                      id,
                      data: { notes },
                    })
                  }
                >
                  Save notes
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() =>
                    savePaper.mutate({
                      id,
                      data: { read_at: paper.read_at ? null : new Date().toISOString() },
                    })
                  }
                >
                  {paper.read_at ? "Mark unread" : "Mark read"}
                </Button>
              </Stack>
            </Paper>
          );
        })}
        {papers.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No research papers yet. Add literature PDFs or PubMed records in a project first.
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
