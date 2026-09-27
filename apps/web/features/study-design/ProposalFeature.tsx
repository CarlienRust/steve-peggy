"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { WorkflowResults } from "@/components/WorkflowResults";
import { SourceCards } from "@/components/SourceCards";
import { ProjectContextChips } from "@/features/study-design/ProjectContextChips";
import { StudyDesignSaveBar } from "@/features/study-design/StudyDesignSaveBar";
import { peggyApi, formatApiError } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { blocksLlmGuidance } from "@/lib/sensitiveData";

export function ProposalFeature() {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, saveSection, commitSection, isSectionDirty, savingSection } = useStudyDesign(
    activeWorkspace?.id
  );
  const proposal = studyDesign.proposal ?? {};
  const samples = studyDesign.samples ?? {};
  const llmBlocked = blocksLlmGuidance(samples.identifierLevel);

  const generate = useMutation({
    mutationFn: () => peggyApi.studyProposal(activeWorkspace!.id, proposal.focusNotes ?? ""),
    onSuccess: (data) => {
      void commitSection("proposal", {
        focusNotes: proposal.focusNotes,
        lastResult: data.body,
        generatedAt: new Date().toISOString(),
      });
    },
  });

  const lastResult = (generate.data?.body ?? proposal.lastResult) as Record<string, unknown> | undefined;
  const fullText = typeof lastResult?.full_text === "string" ? lastResult.full_text : null;

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to generate a study proposal.</Alert>;
  }

  return (
    <>
      <ProjectContextChips />

      <Stack spacing={2}>
        <TextField
          label="Audience or focus (optional)"
          placeholder="e.g. FMHS HREC application, small grant, MSc protocol"
          value={proposal.focusNotes ?? ""}
          onChange={(e) => saveSection("proposal", { focusNotes: e.target.value })}
          fullWidth
          multiline
          minRows={2}
        />

        <Button variant="contained" disabled={llmBlocked || generate.isPending} onClick={() => generate.mutate()}>
          {generate.isPending ? <CircularProgress size={22} /> : "Generate proposal"}
        </Button>

        {llmBlocked && (
          <Alert severity="warning">Update Samples to de-identified before generating a proposal.</Alert>
        )}
        {generate.isError && <Alert severity="error">{formatApiError(generate.error)}</Alert>}

        {fullText && (
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Draft proposal
            </Typography>
            <Typography variant="body2" component="div" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {fullText}
            </Typography>
          </Paper>
        )}

        {lastResult && (
          <>
            <WorkflowResults
              mode="proposal"
              body={Object.fromEntries(Object.entries(lastResult).filter(([k]) => k !== "full_text"))}
            />
            {generate.data && (
              <SourceCards
                sources={generate.data.sources}
                confidence={generate.data.confidence}
                limitations={generate.data.limitations}
              />
            )}
          </>
        )}
        <StudyDesignSaveBar
          dirty={isSectionDirty("proposal")}
          saving={savingSection === "proposal"}
          onSave={() => commitSection("proposal")}
        />
      </Stack>
    </>
  );
}
