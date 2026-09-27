"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { EthicsApprovalSection } from "@/features/study-design/EthicsApprovalSection";
import { StudyDesignSaveBar } from "@/features/study-design/StudyDesignSaveBar";
import { WorkflowResults } from "@/components/WorkflowResults";
import { SourceCards } from "@/components/SourceCards";
import { FMHS_COMMITTEES, FMHS_ETHICS_URL, FMHS_STEPS } from "@/lib/ethics/fmhsStellenbosch";
import { peggyApi, formatApiError, queryKeys } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { blocksLlmGuidance } from "@/lib/sensitiveData";
import { linkedDocumentsChanged, linkedDocumentsFromPapers } from "@/lib/studyDesign";

export function EthicsFeature() {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, saveSection, commitSection, isSectionDirty, savingSection } = useStudyDesign(
    activeWorkspace?.id
  );
  const ethics = studyDesign.ethics ?? {};
  const samples = studyDesign.samples ?? {};
  const llmBlocked = blocksLlmGuidance(samples.identifierLevel);
  const letters = useQuery({
    queryKey: queryKeys.corpus("ethics_documents"),
    queryFn: () => peggyApi.listCorpus("ethics_documents"),
    enabled: !!activeWorkspace,
  });
  const letterPapers = letters.data?.papers ?? [];
  const uploadsChanged = linkedDocumentsChanged(ethics.linkedDocuments, letterPapers);

  const guidance = useMutation({
    mutationFn: () => peggyApi.ethicsGuidance(activeWorkspace!.id, ethics.notes ?? ""),
    onSuccess: () => saveSection("ethics", { lastGuidanceAt: new Date().toISOString() }),
  });

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project for ethics guidance.</Alert>;
  }

  return (
    <>
      <Stack spacing={3}>
        <EthicsApprovalSection ethics={ethics} onSave={(patch) => saveSection("ethics", patch)} />

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            FMHS Health Research Ethics Office
          </Typography>
          <Link href={FMHS_ETHICS_URL} target="_blank" rel="noopener">
            {FMHS_ETHICS_URL}
          </Link>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Verify current submission deadlines and forms on the official SU website.
          </Typography>
        </Paper>

        <Stack spacing={1}>
          <Typography variant="subtitle2">Committees</Typography>
          {FMHS_COMMITTEES.map((c) => (
            <Paper key={c.id} variant="outlined" sx={{ p: 1.5 }}>
              <Typography fontWeight={600}>{c.label}</Typography>
              <Typography variant="body2" color="text.secondary">
                {c.description}
              </Typography>
            </Paper>
          ))}
        </Stack>

        <List dense>
          {FMHS_STEPS.map((step) => (
            <ListItem key={step} disablePadding>
              <ListItemText primary={step} />
            </ListItem>
          ))}
        </List>

        <FormControlLabel
          control={
            <Checkbox
              checked={!!ethics.acknowledgedSafety}
              onChange={(e) => saveSection("ethics", { acknowledgedSafety: e.target.checked })}
            />
          }
          label="I understand not to enter identifiable patient data without ethics approval."
        />

        <TextField
          label="Notes or question for guidance"
          multiline
          minRows={3}
          value={ethics.notes ?? ""}
          onChange={(e) => saveSection("ethics", { notes: e.target.value })}
          fullWidth
          placeholder="e.g. Secondary analysis of de-identified survey data — which committee?"
        />

        <Button
          variant="contained"
          disabled={llmBlocked || guidance.isPending || !ethics.acknowledgedSafety}
          onClick={() => guidance.mutate()}
        >
          {guidance.isPending ? <CircularProgress size={22} /> : "Generate ethics guidance"}
        </Button>

        {llmBlocked && (
          <Alert severity="warning">
            Samples are marked identifiable. Update Samples & datasets to de-identified before using AI guidance.
          </Alert>
        )}

        {guidance.isError && <Alert severity="error">{formatApiError(guidance.error)}</Alert>}

        {guidance.data && (
          <>
            <WorkflowResults mode="ethics" body={guidance.data.body} />
            <SourceCards
              sources={guidance.data.sources}
              confidence={guidance.data.confidence}
              limitations={guidance.data.limitations}
            />
          </>
        )}
        <StudyDesignSaveBar
          dirty={isSectionDirty("ethics") || uploadsChanged}
          saving={savingSection === "ethics"}
          note="Approval-letter PDFs stay in your corpus. Save links them here and does not replace the fields you type."
          onSave={() =>
            commitSection("ethics", { linkedDocuments: linkedDocumentsFromPapers(letterPapers) })
          }
        />
      </Stack>
    </>
  );
}
