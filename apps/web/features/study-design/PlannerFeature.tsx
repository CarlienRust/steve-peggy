"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
} from "@mui/material";
import { WorkflowOutputPanel } from "@/components/WorkflowOutputPanel";
import { ProjectContextChips } from "@/features/study-design/ProjectContextChips";
import { PlanStepsEditor } from "@/features/study-design/PlanStepsEditor";
import { StudyDesignSaveBar } from "@/features/study-design/StudyDesignSaveBar";
import { normalizeObjectives } from "@/lib/objectives";
import type { PlanStep } from "@/lib/studyDesign";
import { peggyApi, formatApiError } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { blocksLlmGuidance } from "@/lib/sensitiveData";
import { DisabledTooltipButton } from "@/components/DisabledTooltipButton";

type PlannerSection = "methods" | "analysis";

type PlannerFeatureProps = {
  section: PlannerSection;
};

function resultsEqual(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function PlannerFeature({ section }: PlannerFeatureProps) {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, saveSection, commitSection, isSectionDirty, savingSection } = useStudyDesign(
    activeWorkspace?.id
  );
  const planKey = section === "methods" ? "methodsPlan" : "analysisPlan";
  const plan = studyDesign[planKey] ?? {};
  const samples = studyDesign.samples ?? {};

  const [tab, setTab] = useState<"review" | "suggest">(plan.mode ?? "review");
  const [userPlan, setUserPlan] = useState(plan.userPlan ?? "");
  const [constraints, setConstraints] = useState(plan.constraints ?? plan.preferredTools ?? "");
  const [userNotes, setUserNotes] = useState(plan.userNotes ?? "");
  const [steps, setSteps] = useState<PlanStep[]>(plan.steps ?? []);
  const objectives = normalizeObjectives(activeWorkspace?.objectives);

  const llmBlocked = blocksLlmGuidance(samples.identifierLevel);

  useEffect(() => {
    setSteps(plan.steps ?? []);
    setUserNotes(plan.userNotes ?? "");
  }, [activeWorkspace?.id, planKey, plan.steps, plan.userNotes]);

  const updateSteps = (next: PlanStep[]) => {
    setSteps(next);
    saveSection(planKey, { steps: next });
  };

  const run = useMutation({
    mutationFn: () => {
      const body = {
        workspaceId: activeWorkspace!.id,
        mode: tab,
        userPlan: tab === "review" ? userPlan : "",
        budget: "",
        tools: "",
        outcomeTypes: undefined,
        covariates: undefined,
        analysisMethod: undefined,
        constraints,
      };
      return section === "methods" ? peggyApi.methodsPlan(body) : peggyApi.analysisPlan(body);
    },
  });

  const pendingBody = run.data?.body as Record<string, unknown> | undefined;
  const savedBody = plan.lastResult;
  const displayBody = pendingBody ?? savedBody;
  const hasUnsavedResult = !!pendingBody && !resultsEqual(pendingBody, savedBody);
  const hasSavedResult = !!savedBody;

  const workflowMode = section === "methods" ? "methods_plan" : "analysis_plan";

  const sectionFields = useMemo(
    () => ({
      mode: tab,
      userPlan,
      constraints,
      steps,
      userNotes,
    }),
    [tab, userPlan, constraints, steps, userNotes]
  );

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to plan {section}.</Alert>;
  }

  return (
    <>
      <ProjectContextChips />

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip
          label="Review my plan"
          color={tab === "review" ? "primary" : "default"}
          onClick={() => {
            setTab("review");
            saveSection(planKey, { mode: "review" });
          }}
        />
        <Chip
          label="Help me design"
          variant={tab === "suggest" ? "filled" : "outlined"}
          onClick={() => {
            setTab("suggest");
            saveSection(planKey, { mode: "suggest" });
          }}
        />
      </Stack>

      <Stack spacing={2}>
        <TextField
          label={section === "methods" ? "Paste or type your methods plan" : "Paste or type your analysis plan"}
          placeholder={section === "methods" ? "Paste or type your methods plan" : "Paste or type your analysis plan"}
          multiline
          minRows={6}
          value={userPlan}
          onChange={(e) => {
            setUserPlan(e.target.value);
            saveSection(planKey, { userPlan: e.target.value });
          }}
          fullWidth
        />
        <TextField
          label="CONSTRAINTS (OPTIONAL)"
          placeholder={section === "methods" ? "Time, staff, equipment" : "Software, skills, time"}
          value={constraints}
          onChange={(e) => {
            setConstraints(e.target.value);
            saveSection(planKey, { constraints: e.target.value });
          }}
          fullWidth
        />

        <Button variant="outlined" sx={{ textTransform: "none", alignSelf: "flex-start" }} disabled>
          Advanced options
        </Button>

        <DisabledTooltipButton title={userPlan.trim() ? "" : "Paste your plan to get a review"}>
          <Button
            variant="contained"
            disabled={llmBlocked || run.isPending || !userPlan.trim()}
            onClick={() => run.mutate()}
            sx={{ textTransform: "none", alignSelf: "flex-start" }}
          >
            {run.isPending ? (
              <CircularProgress size={22} />
            ) : tab === "review" ? (
              "Review my plan"
            ) : (
              "Help me design"
            )}
          </Button>
        </DisabledTooltipButton>

        {llmBlocked && (
          <Alert severity="warning">Update Samples to de-identified before using AI planners.</Alert>
        )}
        {run.isError && <Alert severity="error">{formatApiError(run.error)}</Alert>}

        {displayBody && (
          <WorkflowOutputPanel
            mode={workflowMode}
            title={section === "methods" ? "Methods plan result" : "Analysis plan result"}
            body={displayBody}
            sources={run.data?.sources}
            confidence={run.data?.confidence}
            limitations={run.data?.limitations}
            hasUnsavedResult={hasUnsavedResult}
            hasSavedResult={hasSavedResult}
            saving={savingSection === planKey}
            onSaveResult={() =>
              void commitSection(planKey, {
                ...sectionFields,
                lastResult: pendingBody ?? savedBody,
              }).then(() => run.reset())
            }
            onClearSaved={() =>
              void commitSection(planKey, {
                ...sectionFields,
                lastResult: undefined,
              }).then(() => run.reset())
            }
            userNotes={userNotes}
            onUserNotesChange={(notes) => {
              setUserNotes(notes);
              saveSection(planKey, { userNotes: notes });
            }}
          />
        )}

        <PlanStepsEditor
          steps={steps}
          aim={activeWorkspace.aim}
          objectives={objectives}
          onChange={updateSteps}
        />

        <StudyDesignSaveBar
          dirty={isSectionDirty(planKey)}
          saving={savingSection === planKey}
          onSave={() => commitSection(planKey, sectionFields)}
        />
      </Stack>
    </>
  );
}
