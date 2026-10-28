"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Paper,
  Typography,
  Divider,
  Box,
} from "@mui/material";
import { WorkflowOutputPanel } from "@/components/WorkflowOutputPanel";
import { ProjectContextChips } from "@/features/study-design/ProjectContextChips";
import { StudyDesignSaveBar } from "@/features/study-design/StudyDesignSaveBar";
import { peggyApi, formatApiError } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { blocksLlmGuidance } from "@/lib/sensitiveData";
import { StatusChip } from "@/components/StatusChip";
import { monoSx, peggyColors } from "@/theme/peggyTheme";
import { downloadProposalDocx, downloadTextFile, proposalToMarkdown } from "@/lib/proposalExport";
import { hasProposalSections, normalizeWorkflowBody } from "@/lib/normalizeWorkflowBody";

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
  const ethics = studyDesign.ethics ?? {};
  const budget = studyDesign.budget ?? {};
  const methodsPlan = studyDesign.methodsPlan ?? {};
  const analysisPlan = studyDesign.analysisPlan ?? {};
  const llmBlocked = blocksLlmGuidance(samples.identifierLevel);
  const [userNotes, setUserNotes] = useState(proposal.userNotes ?? "");

  const generate = useMutation({
    mutationFn: () => peggyApi.studyProposal(activeWorkspace!.id, proposal.focusNotes ?? ""),
  });

  const pendingBody = normalizeWorkflowBody(generate.data?.body as Record<string, unknown> | undefined);
  const savedBody = normalizeWorkflowBody(proposal.lastResult);
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

  const readinessItems = [
    {
      label: "Aim and objectives",
      detail: `${(activeWorkspace.objectives ?? []).length} objectives${activeWorkspace.objectives?.length ? "" : ""}`,
      tone: activeWorkspace.aim?.trim() ? ("accent" as const) : ("warning" as const),
      status: activeWorkspace.aim?.trim() ? "Ready" : "To do",
    },
    {
      label: "Samples and datasets",
      detail: samples.expectedN ? `${samples.expectedN} planned participants.` : "Add a cohort profile.",
      tone: samples.expectedN ? ("accent" as const) : ("warning" as const),
      status: samples.expectedN ? "Ready" : "To do",
    },
    {
      label: "Methods and analysis plans",
      detail: (methodsPlan.userPlan || analysisPlan.userPlan) ? "Both are drafts." : "Draft your plans.",
      tone: (methodsPlan.userPlan || analysisPlan.userPlan) ? ("neutral" as const) : ("warning" as const),
      status: (methodsPlan.userPlan || analysisPlan.userPlan) ? "Draft" : "To do",
    },
    {
      label: "Budget",
      detail: (budget.lineItems?.length ?? 0) > 0 ? `${budget.lineItems?.length ?? 0} line items.` : "Add line items.",
      tone: (budget.lineItems?.length ?? 0) > 0 ? ("accent" as const) : ("warning" as const),
      status: (budget.lineItems?.length ?? 0) > 0 ? "Ready" : "To do",
    },
    {
      label: "Ethics",
      detail: ethics.linkedDocuments?.length ? "Approval letter uploaded." : "Approval letter missing.",
      tone: ethics.linkedDocuments?.length ? ("accent" as const) : ("warning" as const),
      status: ethics.linkedDocuments?.length ? "Ready" : "To do",
    },
  ];

  return (
    <>
      <ProjectContextChips />

      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>
            WHAT PEGGY WILL USE
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Missing parts are marked as to do in the draft. Nothing blocks you.
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>
            {readinessItems.map((item) => (
              <Stack
                key={item.label}
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ py: 1, borderBottom: `0.5px solid ${peggyColors.border}` }}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: 999, bgcolor: item.tone === "warning" ? peggyColors.warning : peggyColors.accent }} />
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={600}>{item.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.detail}
                  </Typography>
                </Box>
                <StatusChip tone={item.tone === "warning" ? "warning" : item.tone === "accent" ? "accent" : "neutral"} label={item.status} />
              </Stack>
            ))}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button
              variant="contained"
              disabled={llmBlocked || generate.isPending}
              onClick={() => generate.mutate()}
              sx={{ textTransform: "none" }}
            >
              {generate.isPending ? <CircularProgress size={22} color="inherit" /> : "Redraft all sections"}
            </Button>
          </Stack>
        </Paper>

        <TextField
          label="Audience or focus (optional)"
          placeholder="e.g. FMHS HREC application, small grant, MSc protocol"
          value={proposal.focusNotes ?? ""}
          onChange={(e) => saveSection("proposal", { focusNotes: e.target.value })}
          fullWidth
          multiline
          minRows={2}
        />

        {llmBlocked && (
          <Alert severity="warning">Update Samples to de-identified before generating a proposal.</Alert>
        )}
        {generate.isError && <Alert severity="error">{formatApiError(generate.error)}</Alert>}
        {generate.isSuccess && displayBody && !hasProposalSections(displayBody) && (
          <Alert severity="warning">
            The model returned no structured proposal. Try Redraft again, or check that the API is running.
          </Alert>
        )}

        {hasSavedResult && savedBody && hasProposalSections(savedBody) && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              size="small"
              sx={{ textTransform: "none" }}
              onClick={() =>
                downloadTextFile(
                  `${(activeWorkspace.title ?? "proposal").replace(/[^\w.-]+/g, "-").slice(0, 48)}-proposal.md`,
                  proposalToMarkdown(savedBody, userNotes),
                  "text/markdown;charset=utf-8"
                )
              }
            >
              Export Markdown
            </Button>
            <Button
              variant="outlined"
              size="small"
              sx={{ textTransform: "none" }}
              onClick={() => void downloadProposalDocx(activeWorkspace.title ?? "proposal", savedBody, userNotes)}
            >
              Export Word
            </Button>
          </Stack>
        )}

        {displayBody && hasProposalSections(displayBody) && (
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
