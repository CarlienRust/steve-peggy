"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Grid,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { peggyApi, queryKeys } from "@/lib/api";
import { SourceCards } from "@/components/SourceCards";
import { eyebrowSx } from "@/theme/peggyTheme";

export function CompareFeature() {
  const [finding, setFinding] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  const findings = useQuery({
    queryKey: queryKeys.corpus("own_findings"),
    queryFn: () => peggyApi.listCorpus("own_findings"),
  });
  const papers = findings.data?.papers ?? [];

  const compare = useMutation({ mutationFn: (f: string) => peggyApi.compare(f) });

  const toggleFinding = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const importSelectedFindings = async () => {
    if (selectedIds.size === 0) return;
    setImporting(true);
    try {
      const blocks: string[] = [];
      for (const id of selectedIds) {
        const paper = papers.find((p) => p.id === id);
        const res = await peggyApi.getPaperText(id);
        const header = paper?.title ? `## ${paper.title}` : `## Finding set ${id}`;
        blocks.push(res.text ? `${header}\n\n${res.text}` : `${header}\n\n(No indexed text found)`);
      }
      const imported = blocks.join("\n\n---\n\n");
      setFinding((prev) => (prev.trim() ? `${prev.trim()}\n\n---\n\n${imported}` : imported));
    } finally {
      setImporting(false);
    }
  };

  const body = compare.data?.body ?? {};

  return (
    <Stack spacing={2}>
      {papers.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography sx={eyebrowSx}>Import from Our findings</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Select one or more finding sets to load into the comparison text below.
          </Typography>
          <List dense disablePadding>
            {papers.map((p) => (
              <ListItem key={p.id} disablePadding>
                <ListItemButton onClick={() => p.id != null && toggleFinding(p.id)} dense>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Checkbox
                      edge="start"
                      checked={p.id != null && selectedIds.has(p.id)}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={p.title || "Untitled"}
                    secondary={p.year || "Our findings"}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Button
            variant="outlined"
            size="small"
            sx={{ mt: 1 }}
            disabled={selectedIds.size === 0 || importing}
            onClick={() => void importSelectedFindings()}
          >
            {importing ? <CircularProgress size={20} /> : `Import selected (${selectedIds.size})`}
          </Button>
        </Paper>
      )}

      {papers.length === 0 && !findings.isLoading && (
        <Alert severity="info">
          No findings in Our findings yet. Add narratives under Our findings, then import them here for comparison.
        </Alert>
      )}

      <TextField
        label="Your finding"
        value={finding}
        onChange={(e) => setFinding(e.target.value)}
        fullWidth
        multiline
        rows={4}
        placeholder="Describe your result to compare against ingested literature, or import from Our findings above…"
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
              {(body.agreement as string[])?.map((a, i) => (
                <Typography key={i} variant="body2">
                  {a}
                </Typography>
              ))}
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2">Discrepancy</Typography>
              {(body.discrepancy as string[])?.map((d, i) => (
                <Typography key={i} variant="body2">
                  {d}
                </Typography>
              ))}
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2">Summary</Typography>
              <Typography variant="body2">{body.summary as string}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <SourceCards
              sources={compare.data.sources}
              confidence={compare.data.confidence}
              limitations={compare.data.limitations}
            />
          </Grid>
        </Grid>
      )}
    </Stack>
  );
}
