"use client";

import { useMutation } from "@tanstack/react-query";
import { Alert, Button, CircularProgress, Grid, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { peggyApi } from "@/lib/api";
import { SourceCards } from "@/components/SourceCards";

export function CompareFeature() {
  const [finding, setFinding] = useState("");

  const compare = useMutation({ mutationFn: (f: string) => peggyApi.compare(f) });

  const body = compare.data?.body ?? {};

  return (
    <Stack spacing={2}>
      <TextField
        label="Your finding"
        value={finding}
        onChange={(e) => setFinding(e.target.value)}
        fullWidth
        multiline
        rows={4}
        placeholder="Describe your result to compare against ingested literature…"
      />
      <Button variant="contained" disabled={!finding || compare.isPending} onClick={() => compare.mutate(finding)}>
        {compare.isPending ? <CircularProgress size={24} /> : "Compare to literature"}
      </Button>
      {compare.isError && <Alert severity="error">{(compare.error as Error).message}</Alert>}
      {compare.data && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2">Agreement</Typography>
              {(body.agreement as string[])?.map((a, i) => <Typography key={i} variant="body2">{a}</Typography>)}
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2">Discrepancy</Typography>
              {(body.discrepancy as string[])?.map((d, i) => <Typography key={i} variant="body2">{d}</Typography>)}
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2">Summary</Typography>
              <Typography variant="body2">{body.summary as string}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <SourceCards sources={compare.data.sources} confidence={compare.data.confidence} limitations={compare.data.limitations} />
          </Grid>
        </Grid>
      )}
    </Stack>
  );
}
