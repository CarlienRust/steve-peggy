"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
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

type ReadFilter = "all" | "to_read" | "completed";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: "center" }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" fontWeight={600} sx={{ mt: 0.5 }}>
        {value}
      </Typography>
    </Paper>
  );
}

export function ReadingJournalFeature() {
  const { ready, userId } = useAuthSession();
  const queryClient = useQueryClient();
  const [filterWs, setFilterWs] = useState("");
  const [filterRead, setFilterRead] = useState<ReadFilter>("all");
  const [search, setSearch] = useState("");
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
  const wsTitle = (id?: string | null) => workspaces.find((w) => w.id === id)?.title || "Unknown project";
  const allPapers = papersQuery.data?.papers ?? [];
  const toReadCount = allPapers.filter((p) => !p.read_at).length;
  const completedCount = allPapers.filter((p) => !!p.read_at).length;

  const papers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allPapers.filter((p) => {
      if (filterRead === "to_read" && p.read_at) return false;
      if (filterRead === "completed" && !p.read_at) return false;
      if (!q) return true;
      const hay = `${p.title ?? ""} ${p.authors ?? ""} ${p.pmid ?? ""} ${p.journal ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allPapers, filterRead, search]);

  return (
    <Box>
      <LocalDevBanner />
      <Typography sx={eyebrowSx}>READING JOURNAL</Typography>
      <Typography variant="h4" fontWeight={600} sx={{ mb: 1 }}>
        Manage and track your literature reading.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        Research papers from your literature corpus only. Ethics letters and uploaded results are not listed.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <StatCard label="To read" value={toReadCount} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <StatCard label="Completed" value={completedCount} />
        </Grid>
      </Grid>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search papers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 220 }}
        />
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
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {(
          [
            ["all", "All"],
            ["to_read", "To read"],
            ["completed", "Completed"],
          ] as const
        ).map(([id, label]) => (
          <Chip
            key={id}
            label={label}
            variant={filterRead === id ? "filled" : "outlined"}
            color={filterRead === id ? "primary" : "default"}
            onClick={() => setFilterRead(id)}
          />
        ))}
      </Stack>

      {papersQuery.isError ? <Alert severity="error">{formatApiError(papersQuery.error)}</Alert> : null}
      {savePaper.isError ? <Alert severity="error">{formatApiError(savePaper.error)}</Alert> : null}

      <Typography sx={{ ...eyebrowSx, mb: 1.5 }}>Your papers</Typography>
      <Stack spacing={1.5}>
        {papers.map((paper) => {
          const id = paper.id;
          if (id == null) return null;
          const notes = notesDraft[id] ?? paper.notes ?? "";
          const subtitle = [paper.authors, paper.year, paper.journal].filter(Boolean).join(" · ");
          return (
            <Paper key={id} variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography fontWeight={600}>{paper.title || "Untitled"}</Typography>
              {subtitle ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {subtitle}
                </Typography>
              ) : null}
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Project: {wsTitle(paper.workspace_id)}
                {paper.pmid ? ` · PMID: ${paper.pmid}` : ""}
              </Typography>
              <TextField
                label="Notes"
                placeholder="Add your reading notes..."
                value={notes}
                onChange={(e) => setNotesDraft((d) => ({ ...d, [id]: e.target.value }))}
                fullWidth
                multiline
                minRows={2}
                sx={{ my: 1.5 }}
              />
              <Stack direction="row" spacing={1} justifyContent="space-between" flexWrap="wrap" useFlexGap>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => savePaper.mutate({ id, data: { notes } })}
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
                  {paper.read_at ? "Mark unread" : "Mark as read"}
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
