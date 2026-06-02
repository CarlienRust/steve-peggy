"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Paper,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { peggyApi, queryKeys } from "@/lib/api";
import { monoSx } from "@/theme/peggyTheme";

const pubmedSchema = z.object({
  pmids: z.string().optional(),
  dois: z.string().optional(),
  search_query: z.string().optional(),
});

const findingsSchema = z.object({
  title: z.string().min(1, "Title required"),
  narrative: z.string().min(10, "Add a narrative summary"),
  cohort: z.string().optional(),
});

export function IngestFeature() {
  const [tab, setTab] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);

  const pubmedForm = useForm({
    resolver: zodResolver(pubmedSchema),
    defaultValues: { pmids: "", dois: "", search_query: "" },
  });
  const findingsForm = useForm({
    resolver: zodResolver(findingsSchema),
    defaultValues: { title: "", narrative: "", cohort: "" },
  });

  const corpus = useQuery({ queryKey: queryKeys.corpus(), queryFn: () => peggyApi.listCorpus() });

  const pubmedMut = useMutation({
    mutationFn: (v: z.infer<typeof pubmedSchema>) =>
      peggyApi.ingestPubmed({
        pmids: v.pmids?.split(/[\s,]+/).filter(Boolean),
        dois: v.dois?.split(/[\s,]+/).filter(Boolean),
        search_query: v.search_query || undefined,
      }),
    onSuccess: (d) => setJobId(d.job_id),
  });

  const jobQuery = useQuery({
    queryKey: queryKeys.job(jobId ?? ""),
    queryFn: () => peggyApi.getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) =>
      q.state.data?.status === "completed" || q.state.data?.status === "failed" ? false : 2000,
  });

  const findingsMut = useMutation({
    mutationFn: (v: z.infer<typeof findingsSchema>) => peggyApi.uploadFindings(v),
    onSuccess: () => corpus.refetch(),
  });

  return (
    <Stack spacing={3}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tab label="PubMed / DOI" />
        <Tab label="Internal dataset" />
      </Tabs>

      {tab === 0 && (
        <Box component="form" onSubmit={pubmedForm.handleSubmit((d) => pubmedMut.mutate(d))}>
          <Stack spacing={2}>
            <Controller
              name="pmids"
              control={pubmedForm.control}
              render={({ field }) => <TextField {...field} label="PMIDs (comma-separated)" fullWidth />}
            />
            <Controller
              name="dois"
              control={pubmedForm.control}
              render={({ field }) => <TextField {...field} label="DOIs (comma-separated)" fullWidth />}
            />
            <Controller
              name="search_query"
              control={pubmedForm.control}
              render={({ field }) => <TextField {...field} label="PubMed search query" fullWidth />}
            />
            <Button type="submit" variant="contained" disabled={pubmedMut.isPending} sx={{ alignSelf: "flex-start" }}>
              {pubmedMut.isPending ? <CircularProgress size={22} color="inherit" /> : "Start ingest"}
            </Button>
            {jobQuery.data && (
              <Alert severity={jobQuery.data.status === "failed" ? "error" : "info"}>
                Job {jobQuery.data.status}: {JSON.stringify(jobQuery.data.result ?? jobQuery.data.error)}
              </Alert>
            )}
          </Stack>
        </Box>
      )}

      {tab === 1 && (
        <Box component="form" onSubmit={findingsForm.handleSubmit((d) => findingsMut.mutate(d))}>
          <Stack spacing={2}>
            <Controller
              name="title"
              control={findingsForm.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Dataset title"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              name="cohort"
              control={findingsForm.control}
              render={({ field }) => <TextField {...field} label="Cohort (optional)" fullWidth />}
            />
            <Controller
              name="narrative"
              control={findingsForm.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Findings narrative"
                  multiline
                  rows={6}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  fullWidth
                />
              )}
            />
            <Button type="submit" variant="contained" disabled={findingsMut.isPending} sx={{ alignSelf: "flex-start" }}>
              Upload dataset
            </Button>
            {findingsMut.isSuccess && (
              <Alert severity="success">Ingested {findingsMut.data.chunks} chunks</Alert>
            )}
          </Stack>
        </Box>
      )}

      <Box sx={{ pt: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 2 }}>
          <Typography variant="h2">Corpus</Typography>
          <Typography sx={{ ...monoSx, fontSize: 12, color: "text.secondary" }}>
            {corpus.data?.count ?? 0} total
          </Typography>
        </Stack>
        <Paper sx={{ overflow: "hidden" }}>
          {(corpus.data?.papers?.length ?? 0) === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No papers ingested yet.
            </Typography>
          ) : (
            corpus.data?.papers.slice(0, 10).map((p, i) => (
              <Box key={i}>
                {i > 0 && <Divider />}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5, gap: 2 }}>
                  <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                    {p.title ?? "Untitled"}
                  </Typography>
                  <Chip
                    label={p.source_type === "own_findings" ? "Internal" : "Literature"}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
              </Box>
            ))
          )}
        </Paper>
      </Box>
    </Stack>
  );
}
