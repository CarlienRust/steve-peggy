"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  TextField,
} from "@mui/material";
import { WorkflowOutputPanel } from "@/components/WorkflowOutputPanel";
import { ProjectContextChips } from "@/features/study-design/ProjectContextChips";
import { StudyDesignSaveBar } from "@/features/study-design/StudyDesignSaveBar";
import { peggyApi, formatApiError } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { blocksLlmGuidance } from "@/lib/sensitiveData";

function resultsEqual(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ProposalFeature() {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, saveSection, commitSection, isSectionDirty, savingSection } = useStudyDesign(
    activeWorkspace?.id
  );
  const proposal = studyDesign.proposal ?? {};
  const samples = studyDesign.samples ?? {};
  const llmBlocked = blocksLlmGuidance(samples.identifierLevel);
  const [userNotes, setUserNotes] = useState(proposal.userNotes ?? "");

  const generate = useMutation({
    mutationFn: () => peggyApi.studyProposal(activeWorkspace!.id, proposal.focusNotes ?? ""),
  });

  const pendingBody = generate.data?.body as Record<string, unknown> | undefined;
  const savedBody = proposal.lastResult;
  const displayBody = pendingBody ?? savedBody;
  const hasUnsavedResult = !!pendingBody && !resultsEqual(pendingBody, savedBody);
  const hasSavedResult = !!savedBody;

  const sectionFields = useMemo(
    () => ({
      focusNotes: proposal.focusNotes,
      userNotes,
    }),
    [proposal.focusNotes, userNotes]
  );

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

        {displayBody && (
          <WorkflowOutputPanel
            mode="proposal"
            title="Proposal"
            body={displayBody}
            sources={generate.data?.sources}
            confidence={generate.data?.confidence}
            limitations={generate.data?.limitations}
            hasUnsavedResult={hasUnsavedResult}
            hasSavedResult={hasSavedResult}
            saving={savingSection === "proposal"}
            onSaveResult={() =>
              void commitSection("proposal", {
                ...sectionFields,
                lastResult: pendingBody ?? savedBody,
                generatedAt: new Date().toISOString(),
              }).then(() => generate.reset())
            }
            onClearSaved={() =>
              void commitSection("proposal", {
                ...sectionFields,
                lastResult: undefined,
                generatedAt: undefined,
              }).then(() => generate.reset())
            }
            userNotes={userNotes}
            onUserNotesChange={(notes) => {
              setUserNotes(notes);
              saveSection("proposal", { userNotes: notes });
            }}
          />
        )}

        <StudyDesignSaveBar
          dirty={isSectionDirty("proposal")}
          saving={savingSection === "proposal"}
          onSave={() => commitSection("proposal", sectionFields)}
        />
      </Stack>
    </>
  );
}
