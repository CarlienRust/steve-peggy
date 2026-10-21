"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { WorkflowOutputPanel } from "@/components/WorkflowOutputPanel";
import { PlanStepsEditor } from "@/features/study-design/PlanStepsEditor";
import { StudyDesignSaveBar } from "@/features/study-design/StudyDesignSaveBar";
import { StatusChip } from "@/components/StatusChip";
import { normalizeObjectives } from "@/lib/objectives";
import type { PlanStep } from "@/lib/studyDesign";
import { peggyApi, formatApiError } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { blocksLlmGuidance } from "@/lib/sensitiveData";
import { DisabledTooltipButton } from "@/components/DisabledTooltipButton";
import { monoSx, peggyColors } from "@/theme/peggyTheme";

type PlannerSection = "methods" | "analysis";

type PlannerFeatureProps = {
  section: PlannerSection;
};

const MODULE_LABELS: Record<string, string> = {
  core: "Core",
  outcomes: "Outcomes",
  exposure: "Exposure",
  microbiome: "Microbiome",
  diet: "Diet",
};

function resultsEqual(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
      sx={{ py: 1, px: 1, borderBottom: `0.5px solid ${peggyColors.border}`, width: "100%" }}
    >
      <Typography fontWeight={500} sx={{ width: 140, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1, lineHeight: 1.6 }}>
        {value}
      </Typography>
      <Button variant="text" onClick={onEdit} sx={{ textTransform: "none", color: peggyColors.accent, flexShrink: 0 }}>
        Edit
      </Button>
    </Stack>
  );
}

export function PlannerFeature({ section }: PlannerFeatureProps) {
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, saveSection, commitSection, isSectionDirty, savingSection } = useStudyDesign(
    activeWorkspace?.id
  );
  const planKey = section === "methods" ? "methodsPlan" : "analysisPlan";
  const plan = studyDesign[planKey] ?? {};
  const samples = studyDesign.samples ?? {};
  const methodsPlan = studyDesign.methodsPlan ?? {};

  const [tab, setTab] = useState<"review" | "suggest">(plan.mode ?? "review");
  const [userPlan, setUserPlan] = useState(plan.userPlan ?? "");
  const [constraints, setConstraints] = useState(plan.constraints ?? plan.preferredTools ?? "");
  const [userNotes, setUserNotes] = useState(plan.userNotes ?? "");
  const [steps, setSteps] = useState<PlanStep[]>(plan.steps ?? []);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [preferredTools, setPreferredTools] = useState(plan.preferredTools ?? "");
  const [outcomeTypes, setOutcomeTypes] = useState(plan.outcomeTypes ?? "");
  const [covariates, setCovariates] = useState(plan.covariates ?? "");
  const [analysisMethod, setAnalysisMethod] = useState(plan.analysisMethod ?? "");
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
        tools: preferredTools,
        outcomeTypes: outcomeTypes || undefined,
        covariates: covariates || undefined,
        analysisMethod: analysisMethod || undefined,
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
      preferredTools,
      outcomeTypes,
      covariates,
      analysisMethod,
      steps,
      userNotes,
    }),
    [tab, userPlan, constraints, preferredTools, outcomeTypes, covariates, analysisMethod, steps, userNotes]
  );

  const reviewDisabled = llmBlocked || run.isPending || (tab === "review" && !userPlan.trim());
  const reviewTooltip =
    tab === "review" && !userPlan.trim()
      ? "Paste your plan to get a review"
      : llmBlocked
        ? "Update Samples to de-identified before using AI planners."
        : "";

  const changedStepCount = steps.filter((s) => (s.objectiveChangedObjectiveIds ?? []).length > 0).length;
  const unlinkedAnalysis = steps.filter((s) => (s.objectiveIds ?? []).length === 0).length;
  const modules = (activeWorkspace?.enabled_modules ?? ["core"])
    .map((id) => MODULE_LABELS[id] ?? id)
    .filter(Boolean);
  const cohortBits = [samples.expectedN ? `${samples.expectedN} planned participants` : "", samples.setting ?? ""].filter(
    Boolean
  );
  const methodsEndpoints = asStringList(methodsPlan.lastResult?.endpoints);
  const analysisOutcomes = asStringList(displayBody?.primary_analyses).slice(0, 2);

  const similarCount = Math.max(run.data?.sources?.length ?? 0, Array.isArray(savedBody?.citations) ? (savedBody?.citations as unknown[]).length : 0);
  const gapItems = asStringList(displayBody?.gaps);
  const strengthItems = asStringList(displayBody?.strengths);
  const modelItems = asStringList(displayBody?.models_or_tests);
  const checklistItems =
    strengthItems.length || gapItems.length || modelItems.length
      ? [
          ...strengthItems.map((title) => ({ title, note: "Present in your current plan.", status: "In your steps", tone: "accent" as const })),
          ...modelItems.map((title) => ({ title, note: "Method suggested from similar studies.", status: "In your steps", tone: "accent" as const })),
          ...gapItems.map((title) => ({ title, note: "Used in similar studies.", status: "Not in plan", tone: "warning" as const })),
        ]
      : [];

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to plan {section}.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1}>
        <Chip
          label="Review my plan"
          onClick={() => {
            setTab("review");
            saveSection(planKey, { mode: "review" });
          }}
          sx={
            tab === "review"
              ? { bgcolor: peggyColors.primary, color: peggyColors.primaryForeground, "& .MuiChip-label": { ...monoSx, fontSize: 11 } }
              : { bgcolor: peggyColors.muted, border: `0.5px solid ${peggyColors.border}`, "& .MuiChip-label": { ...monoSx, fontSize: 11, color: peggyColors.mutedForeground } }
          }
        />
        <Chip
          label="Help me design"
          onClick={() => {
            setTab("suggest");
            saveSection(planKey, { mode: "suggest" });
          }}
          sx={
            tab === "suggest"
              ? { bgcolor: peggyColors.primary, color: peggyColors.primaryForeground, "& .MuiChip-label": { ...monoSx, fontSize: 11 } }
              : { bgcolor: peggyColors.muted, border: `0.5px solid ${peggyColors.border}`, "& .MuiChip-label": { ...monoSx, fontSize: 11, color: peggyColors.mutedForeground } }
          }
        />
      </Stack>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent, mb: 0.5 }}>
          FROM YOUR PROJECT
        </Typography>
        {section === "methods" ? (
          <>
            <SummaryRow
              label="Aim"
              value={activeWorkspace.aim?.trim() || "Not set"}
              onEdit={() => router.push("/validate/aim")}
            />
            <SummaryRow
              label="Objectives"
              value={
                objectives.length
                  ? `${objectives.length} drafted.${changedStepCount ? ` ${changedStepCount} linked step${changedStepCount === 1 ? "" : "s"} flag an objective change.` : ""}`
                  : "None drafted."
              }
              onEdit={() => router.push("/validate/aim")}
            />
            <SummaryRow
              label="Cohort"
              value={cohortBits.join(", ") || "Not set"}
              onEdit={() => router.push("/study-design/samples")}
            />
            <SummaryRow
              label="Evidence modules"
              value={modules.length ? `${modules.join(", ")}.` : "Core."}
              onEdit={() => router.push("/setup/step-3")}
            />
          </>
        ) : (
          <>
            <SummaryRow
              label="Outcomes"
              value={
                methodsEndpoints.length
                  ? methodsEndpoints.join(", ")
                  : analysisOutcomes.length
                    ? analysisOutcomes.join(", ")
                    : samples.dataTypes?.length
                      ? samples.dataTypes.join(", ")
                      : "Not set"
              }
              onEdit={() => router.push("/study-design/methods-plan")}
            />
            <SummaryRow
              label="Exposures"
              value={modules.includes("Exposure") ? "From your exposure module." : samples.studyType || "Not set"}
              onEdit={() => router.push("/study-design/samples")}
            />
            <SummaryRow
              label="Covariates"
              value={covariates.trim() || "Not set"}
              onEdit={() => setAdvancedOpen(true)}
            />
            <SummaryRow
              label="Objectives"
              value={
                objectives.length
                  ? `${objectives.length} drafted.${unlinkedAnalysis ? ` ${unlinkedAnalysis} have no analysis step yet.` : ""}`
                  : "None drafted."
              }
              onEdit={() => router.push("/validate/aim")}
            />
          </>
        )}
      </Paper>

      {section === "analysis" && (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>
            ANALYSIS STEPS
          </Typography>
          <Typography variant="h6" sx={{ mt: 0.5 }}>
            Steps linked to objectives
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Link each step to one or more objectives. Unlinked steps are allowed.
          </Typography>
          <PlanStepsEditor
            steps={steps}
            aim={activeWorkspace.aim}
            objectives={objectives}
            onChange={updateSteps}
          />
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>
          YOUR PLAN
        </Typography>
        <Typography variant="h6" sx={{ mt: 0.5 }}>
          {section === "methods" ? "Paste your draft plan" : "Paste your draft analysis plan"}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Peggy checks it against your objectives and similar studies.
        </Typography>
        <TextField
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
        <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.mutedForeground, mt: 2, mb: 1 }}>
          CONSTRAINTS (OPTIONAL)
        </Typography>
        <TextField
          placeholder={section === "methods" ? "Time, staff, equipment" : "Software, skills, time"}
          value={constraints}
          onChange={(e) => {
            setConstraints(e.target.value);
            saveSection(planKey, { constraints: e.target.value });
          }}
          fullWidth
        />
        <Button
          variant="text"
          onClick={() => setAdvancedOpen((v) => !v)}
          sx={{ textTransform: "none", color: peggyColors.accent, mt: 1, px: 0 }}
        >
          Advanced options
        </Button>
        {advancedOpen && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {section === "analysis" && (
              <>
                <TextField
                  label="Outcome types"
                  value={outcomeTypes}
                  onChange={(e) => {
                    setOutcomeTypes(e.target.value);
                    saveSection(planKey, { outcomeTypes: e.target.value });
                  }}
                  fullWidth
                />
                <TextField
                  label="Covariates"
                  value={covariates}
                  onChange={(e) => {
                    setCovariates(e.target.value);
                    saveSection(planKey, { covariates: e.target.value });
                  }}
                  fullWidth
                />
                <TextField
                  label="Analysis method"
                  value={analysisMethod}
                  onChange={(e) => {
                    setAnalysisMethod(e.target.value);
                    saveSection(planKey, { analysisMethod: e.target.value });
                  }}
                  fullWidth
                />
              </>
            )}
            <TextField
              label="Preferred tools"
              value={preferredTools}
              onChange={(e) => {
                setPreferredTools(e.target.value);
                saveSection(planKey, { preferredTools: e.target.value });
              }}
              fullWidth
            />
          </Stack>
        )}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
          <DisabledTooltipButton title={reviewTooltip}>
            <span>
              <Button
                variant="contained"
                disabled={reviewDisabled}
                onClick={() => run.mutate()}
                sx={{ textTransform: "none" }}
              >
                {run.isPending ? (
                  <CircularProgress size={22} color="inherit" />
                ) : tab === "review" ? (
                  "Review my plan"
                ) : (
                  "Help me design"
                )}
              </Button>
            </span>
          </DisabledTooltipButton>
          <Button
            variant="outlined"
            disabled={!isSectionDirty(planKey) || savingSection === planKey}
            onClick={() => commitSection(planKey, sectionFields)}
            sx={{ textTransform: "none" }}
          >
            {savingSection === planKey ? <CircularProgress size={22} /> : "Save draft"}
          </Button>
        </Stack>
      </Paper>

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

      {section === "methods" && (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>
            METHODS STEPS
          </Typography>
          <Typography variant="h6" sx={{ mt: 0.5 }}>
            Steps linked to objectives
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Link each step to one or more objectives. Unlinked steps are allowed.
          </Typography>
          <PlanStepsEditor
            steps={steps}
            aim={activeWorkspace.aim}
            objectives={objectives}
            onChange={updateSteps}
          />
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>
          CHECKLIST FROM SIMILAR STUDIES
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
          {section === "methods"
            ? similarCount
              ? `Based on ${similarCount} papers that match your design. Checked once you add a plan.`
              : "Based on papers that match your design. Checked once you add a plan."
            : similarCount
              ? `Analysis methods used in ${similarCount} papers that match your design.`
              : "Analysis methods used in papers that match your design."}
        </Typography>
        {checklistItems.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            Review or design a plan to fill this checklist from similar studies.
          </Typography>
        ) : (
          checklistItems.map((item) => (
            <Stack
              key={`${item.status}-${item.title}`}
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{ py: 1, px: 1, borderBottom: `0.5px solid ${peggyColors.border}` }}
            >
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: "999px",
                  bgcolor: item.tone === "accent" ? peggyColors.accent : peggyColors.warning,
                  border: `0.5px solid ${peggyColors.border}`,
                  flexShrink: 0,
                }}
              />
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={500}>{item.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.note}
                </Typography>
              </Stack>
              <StatusChip
                tone={item.tone}
                label={item.status}
                sx={
                  item.tone === "warning"
                    ? { bgcolor: peggyColors.warning, color: peggyColors.foreground, borderColor: "transparent" }
                    : undefined
                }
              />
            </Stack>
          ))
        )}
      </Paper>

      <StudyDesignSaveBar
        dirty={isSectionDirty(planKey)}
        saving={savingSection === planKey}
        onSave={() => commitSection(planKey, sectionFields)}
      />
    </Stack>
  );
}
