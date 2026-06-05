"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { useState } from "react";
import { peggyApi } from "@/lib/api";
import { SourceCards } from "@/components/SourceCards";
import { WorkflowResults } from "@/components/WorkflowResults";

export function GapsFeature() {
  const [query, setQuery] = useState("microbiome diversity mental health cohort studies");
  const [includeFindings, setIncludeFindings] = useState(true);

  const gap = useMutation({
    mutationFn: (q: string) =>
      peggyApi.gapAnalysis(q, includeFindings ? ["literature", "own_findings"] : ["literature"]),
  });

  return (
    <Stack spacing={2}>
      <TextField label="Research focus / question" value={query} onChange={(e) => setQuery(e.target.value)} fullWidth multiline rows={2} />
      <FormControlLabel
        control={<Switch checked={includeFindings} onChange={(e) => setIncludeFindings(e.target.checked)} />}
        label="Include our findings (compare what we know vs what literature still lacks)"
      />
      <Button variant="contained" disabled={gap.isPending} onClick={() => gap.mutate(query)}>
        {gap.isPending ? <CircularProgress size={24} /> : "Run gap analysis"}
      </Button>
      {gap.isError && <Alert severity="error">{(gap.error as Error).message}</Alert>}
      {gap.data && (
        <>
          <WorkflowResults mode="gap_analysis" body={gap.data.body} />
          <SourceCards sources={gap.data.sources} confidence={gap.data.confidence} limitations={gap.data.limitations} />
        </>
      )}
    </Stack>
  );
}
