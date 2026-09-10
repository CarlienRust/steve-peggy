"use client";

import { useState } from "react";
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
import { DataSafetyBanner } from "@/components/DataSafetyBanner";
import { WorkflowResults } from "@/components/WorkflowResults";
import { SourceCards } from "@/components/SourceCards";
import { ProjectContextChips } from "@/features/study-design/ProjectContextChips";
import { peggyApi, formatApiError } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { blocksLlmGuidance } from "@/lib/sensitiveData";

type PlannerSection = "methods" | "analysis";

type PlannerFeatureProps = {
  section: PlannerSection;
};

export function PlannerFeature({ section }: PlannerFeatureProps) {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, saveSection } = useStudyDesign(activeWorkspace?.id);
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
  const [outcomes, setOutcomes] = useState("");

  const llmBlocked = blocksLlmGuidance(samples.identifierLevel);

  const run = useMutation({
    mutationFn: () => {
      const body = {
        workspaceId: activeWorkspace!.id,
        mode: tab,
        userPlan: tab === "review" ? userPlan : "",
        budget,
        tools,
        outcomeTypes: section === "analysis" ? outcomes : undefined,
      };
      return section === "methods" ? peggyApi.methodsPlan(body) : peggyApi.analysisPlan(body);
    },
    onSuccess: (data) => {
      saveSection(planKey, {
        mode: tab,
        userPlan,
        budget,
        preferredTools: tools,
        lastResult: data.body,
      });
    },
  });

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to plan {section}.</Alert>;
  }

  return (
    <>
      <DataSafetyBanner />
      <ProjectContextChips />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
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
            onChange={(e) => setUserPlan(e.target.value)}
            fullWidth
          />
        )}
        <TextField
          label="Budget constraints"
          placeholder="e.g. No paid software; student budget"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
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
          onChange={(e) => setTools(e.target.value)}
          fullWidth
        />
        {section === "analysis" && tab === "suggest" && (
          <TextField
            label="Outcome types"
            placeholder="e.g. continuous biomarker, binary diagnosis, survival"
            value={outcomes}
            onChange={(e) => setOutcomes(e.target.value)}
            fullWidth
          />
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

        {run.data && (
          <>
            <WorkflowResults mode={section === "methods" ? "methods_plan" : "analysis_plan"} body={run.data.body} />
            <SourceCards sources={run.data.sources} confidence={run.data.confidence} limitations={run.data.limitations} />
          </>
        )}

        {plan.lastResult && !run.data && (
          <Alert severity="info">Previous result loaded from saved draft. Run again to refresh.</Alert>
        )}
      </Stack>
    </>
  );
}
