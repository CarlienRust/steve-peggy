"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
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
  const studyBudget = studyDesign.budget;
  const budgetFromTab =
    [studyBudget?.summary, studyBudget?.constraints].filter(Boolean).join("; ") ||
    samples.budget ||
    "";

  const [tab, setTab] = useState<"review" | "suggest">(plan.mode ?? "suggest");
  const [userPlan, setUserPlan] = useState(plan.userPlan ?? "");
  const [budget, setBudget] = useState(plan.budget ?? budgetFromTab);
  const [tools, setTools] = useState(plan.preferredTools ?? plan.constraints ?? "");
  const [outcomes, setOutcomes] = useState(plan.outcomeTypes ?? "");
  const [covariates, setCovariates] = useState(plan.covariates ?? "");
  const [analysisMethod, setAnalysisMethod] = useState(plan.analysisMethod ?? "");
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
        budget,
        tools,
        outcomeTypes: section === "analysis" ? outcomes : undefined,
        covariates: section === "analysis" ? covariates : undefined,
        analysisMethod: section === "analysis" ? analysisMethod : undefined,
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
      budget,
      preferredTools: tools,
      steps,
      userNotes,
      ...(section === "analysis" ? { outcomeTypes: outcomes, covariates, analysisMethod } : {}),
    }),
    [tab, userPlan, budget, tools, steps, userNotes, section, outcomes, covariates, analysisMethod]
  );

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to plan {section}.</Alert>;
  }

  return (
    <>
      <ProjectContextChips />

      <Tabs value={tab} onChange={(_, v) => { setTab(v); saveSection(planKey, { mode: v }); }} sx={{ mb: 2 }}>
        <Tab value="suggest" label="Help me design" />
        <Tab value="review" label="Review my plan" />
      </Tabs>

      <Stack spacing={2}>
        {tab === "review" && (
          <TextField
            label={section === "methods" ? "Your methods plan" : "Your analysis plan"}
            multiline
            minRows={5}
            value={userPlan}
            onChange={(e) => {
              setUserPlan(e.target.value);
              saveSection(planKey, { userPlan: e.target.value });
            }}
            fullWidth
          />
        )}
        <TextField
          label="Budget constraints"
          placeholder="e.g. No paid software; student budget"
          value={budget}
          onChange={(e) => {
            setBudget(e.target.value);
            saveSection(planKey, { budget: e.target.value });
          }}
          fullWidth
          helperText={
            budgetFromTab && !plan.budget
              ? "Prefilled from Budget tab — edit for plan-specific constraints."
              : undefined
          }
        />
        <TextField
          label="Preferred tools / software"
          placeholder="e.g. R, Python, SPSS, free/open tools only"
          value={tools}
          onChange={(e) => {
            setTools(e.target.value);
            saveSection(planKey, { preferredTools: e.target.value });
          }}
          fullWidth
        />
        {section === "analysis" && (
          <>
            <TextField
              label="Outcome types"
              placeholder="e.g. continuous biomarker, binary diagnosis, survival"
              value={outcomes}
              onChange={(e) => {
                setOutcomes(e.target.value);
                saveSection(planKey, { outcomeTypes: e.target.value });
              }}
              fullWidth
            />
            <TextField
              label="Covariates (if applicable)"
              placeholder="e.g. age, sex, BMI, treatment arm, batch"
              value={covariates}
              onChange={(e) => {
                setCovariates(e.target.value);
                saveSection(planKey, { covariates: e.target.value });
              }}
              fullWidth
              helperText="Adjustments or stratification variables you plan to include."
            />
            <TextField
              label="Analysis method (if pre-specified)"
              placeholder="e.g. linear regression, mixed models, Cox proportional hazards"
              value={analysisMethod}
              onChange={(e) => {
                setAnalysisMethod(e.target.value);
                saveSection(planKey, { analysisMethod: e.target.value });
              }}
              fullWidth
              helperText="Leave blank if you want Peggy to suggest methods."
            />
          </>
        )}

        <Button variant="contained" disabled={llmBlocked || run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? (
            <CircularProgress size={22} />
          ) : tab === "review" ? (
            "Review plan"
          ) : (
            "Suggest plan"
          )}
        </Button>

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
