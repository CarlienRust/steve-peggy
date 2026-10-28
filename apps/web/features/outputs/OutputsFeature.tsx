"use client";

import NextLink from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { WorkflowOutputPanel } from "@/components/WorkflowOutputPanel";
import { formatApiError, peggyApi } from "@/lib/api";
import { hasAbstractSections, normalizeWorkflowBody } from "@/lib/normalizeWorkflowBody";
import { monoSx, peggyColors } from "@/theme/peggyTheme";
import { useWorkspace } from "@/lib/workspaceContext";

export function OutputsFeature() {
  const { activeWorkspace } = useWorkspace();
  const [minWords, setMinWords] = useState(250);

  const abstract = useMutation({
    mutationFn: () => peggyApi.conferenceAbstract(activeWorkspace!.id, minWords),
  });

  const body = normalizeWorkflowBody(abstract.data?.body as Record<string, unknown> | undefined);

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Box>
        <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>
          OUTPUTS
        </Typography>
        <Typography variant="h5" fontWeight={600} sx={{ mt: 0.5 }}>
          Figures, tables, and posters
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>
          Draft a conference abstract from your project context and findings summary. Use external tools for figures and
          posters.
        </Typography>
      </Box>

      {!activeWorkspace && (
        <Alert severity="info">Select a project to tie outputs to objectives and findings.</Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography fontWeight={600} sx={{ mb: 1 }}>
          Conference abstract
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Generates introduction, methods, top results, and conclusion from your study design and uploaded findings.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-end" }} sx={{ mb: 2 }}>
          <TextField
            label="Minimum words"
            type="number"
            size="small"
            value={minWords}
            onChange={(e) => setMinWords(Math.max(100, Math.min(600, Number(e.target.value) || 250)))}
            inputProps={{ min: 100, max: 600, step: 25 }}
            sx={{ width: { sm: 160 } }}
          />
          <Button
            variant="contained"
            disabled={!activeWorkspace?.id || abstract.isPending}
            onClick={() => abstract.mutate()}
            sx={{ textTransform: "none" }}
          >
            {abstract.isPending ? <CircularProgress size={22} color="inherit" /> : "Generate abstract"}
          </Button>
        </Stack>
        {abstract.isError && <Alert severity="error">{formatApiError(abstract.error)}</Alert>}
        {abstract.isSuccess && body && !hasAbstractSections(body) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            The model returned no structured abstract. Try again or add findings summary first.
          </Alert>
        )}
        {body && hasAbstractSections(body) ? (
          <WorkflowOutputPanel
            mode="conference_abstract"
            title="Abstract draft"
            body={body}
            sources={abstract.data?.sources}
            confidence={abstract.data?.confidence}
            limitations={abstract.data?.limitations}
            hasUnsavedResult={false}
            hasSavedResult={false}
          />
        ) : null}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography fontWeight={600} sx={{ mb: 1 }}>
          Start from your results
        </Typography>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Upload de-identified findings and refresh the summary before generating an abstract.
          </Typography>
          <Button component={NextLink} href="/results/findings" variant="outlined" sx={{ alignSelf: "flex-start", textTransform: "none" }}>
            Upload and summary
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography fontWeight={600} sx={{ mb: 1 }}>
          External design tools
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Curated links from Useful links (Canva, BioRender, Figma, GraphPad).
        </Typography>
        <Link component={NextLink} href="/useful-links" underline="hover">
          Open useful links
        </Link>
      </Paper>
    </Stack>
  );
}
