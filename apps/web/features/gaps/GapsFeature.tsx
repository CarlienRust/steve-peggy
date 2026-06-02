"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Alert, Button, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { useState } from "react";
import { peggyApi } from "@/lib/api";
import { SourceCards } from "@/components/SourceCards";

type Gap = {
  topic?: string;
  status?: string;
  evidence_for?: string;
  evidence_against?: string;
  suggested_study?: string;
};

export function GapsFeature() {
  const [query, setQuery] = useState("microbiome diversity mental health cohort studies");

  const gap = useMutation({ mutationFn: (q: string) => peggyApi.gapAnalysis(q) });

  const gaps = (gap.data?.body?.gaps as Gap[]) ?? [];

  return (
    <Stack spacing={2}>
      <TextField label="Research focus" value={query} onChange={(e) => setQuery(e.target.value)} fullWidth multiline rows={2} />
      <Button variant="contained" disabled={gap.isPending} onClick={() => gap.mutate(query)}>
        {gap.isPending ? <CircularProgress size={24} /> : "Run gap analysis"}
      </Button>
      {gap.isError && <Alert severity="error">{(gap.error as Error).message}</Alert>}
      {gap.data && (
        <>
          <Typography variant="body1">{(gap.data.body.summary as string) ?? ""}</Typography>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Topic</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Suggested study</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gaps.map((g, i) => (
                  <TableRow key={i}>
                    <TableCell>{g.topic}</TableCell>
                    <TableCell>{g.status}</TableCell>
                    <TableCell>{g.suggested_study}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
          <SourceCards sources={gap.data.sources} confidence={gap.data.confidence} limitations={gap.data.limitations} />
        </>
      )}
    </Stack>
  );
}
