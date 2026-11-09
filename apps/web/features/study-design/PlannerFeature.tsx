"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { ObjectiveListEditor } from "@/components/ObjectiveListEditor";
import { WorkflowOutputPanel } from "@/components/WorkflowOutputPanel";
import { AdhocAnalysesEditor } from "@/features/study-design/AdhocAnalysesEditor";
import { CovariateEntriesEditor } from "@/features/study-design/CovariateEntriesEditor";
import { PlanStepsEditor } from "@/features/study-design/PlanStepsEditor";
import { StudyDesignSaveBar } from "@/features/study-design/StudyDesignSaveBar";
import { StatusChip } from "@/components/StatusChip";
import { normalizeAims } from "@/lib/aims";
import { linkTargetOptions, normalizeObjectives } from "@/lib/objectives";
import type { AdhocAnalysis, CovariateEntry, PlanStep } from "@/lib/studyDesign";
import { peggyApi, formatApiError, queryKeys } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { objectivesForForm, type WorkspaceFormValues } from "@/lib/schemas/workspace";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { blocksLlmGuidance } from "@/lib/sensitiveData";
import { DisabledTooltipButton } from "@/components/DisabledTooltipButton";
import { monoSx, peggyColors, textWrapSx } from "@/theme/peggyTheme";

const STEPS = ["From your project", "Methods", "Analysis", "Review"] as const;

const MODULE_LABELS: Record<string, string> = {
  core: "Core",
  outcomes: "Outcomes",
  exposure: "Exposure",
  microbiome: "Microbiome",
  diet: "Diet",
};

const EVIDENCE_MODULES: Array<{ id: string; title: string; required?: boolean }> = [
  { id: "core", title: "Core", required: true },
  { id: "outcomes", title: "Outcomes" },
  { id: "exposure", title: "Exposure" },
  { id: "microbiome", title: "Microbiome" },
  { id: "diet", title: "Diet" },
];

type EditableProjectField = "aim" | "objectives" | "cohort" | "modules" | "outcomes" | "exposures" | "covariates";

function resultsEqual(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function formatAdhoc(items: AdhocAnalysis[]): string {
  return items
    .filter((item) => item.title.trim() || item.target.trim())
    .map((item) => {
      const bits = [item.title.trim(), item.target.trim(), (item.notes ?? "").trim()].filter(Boolean);
      return bits.join(" - ");
    })
    .join("; ");
}

function SummaryRow({
  label,
  value,
  editing,
  onEdit,
  onCancel,
  editPanel,
}: {
  label: string;
  value: string;
  editing?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  editPanel?: ReactNode;
}) {
  return (
    <Box sx={{ borderBottom: `0.5px solid ${peggyColors.border}`, width: "100%" }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 1, px: 1 }}>
        <Typography fontWeight={500} sx={{ width: 140, flexShrink: 0 }}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, lineHeight: 1.6, ...textWrapSx }}>
          {value}
        </Typography>
        <Button
          variant="text"
          onClick={editing ? onCancel : onEdit}
          sx={{ textTransform: "none", color: peggyColors.accent, flexShrink: 0 }}
        >
          {editing ? "Cancel" : "Edit"}
        </Button>
      </Stack>
      {editing && editPanel ? <Box sx={{ px: 1, pb: 2, pl: { xs: 1, sm: 19 } }}>{editPanel}</Box> : null}
    </Box>
  );
}

export function PlannerFeature(_props?: { section?: "methods" | "analysis" }) {
  const queryClient = useQueryClient();
  const { userId } = useAuthSession();
  const { activeWorkspace, refetch: refetchWorkspace } = useWorkspace();
  const { studyDesign, saveSection, commitSection, isSectionDirty, savingSection } = useStudyDesign(
    activeWorkspace?.id
  );
  const [editingField, setEditingField] = useState<EditableProjectField | null>(null);
  const [draftAim, setDraftAim] = useState("");
  const [draftObjectives, setDraftObjectives] = useState<WorkspaceFormValues["objectives"]>([]);
  const [draftExpectedN, setDraftExpectedN] = useState("");
  const [draftSetting, setDraftSetting] = useState("");
  const [draftModules, setDraftModules] = useState<string[]>(["core"]);
  const [draftOutcomes, setDraftOutcomes] = useState("");
  const [draftStudyType, setDraftStudyType] = useState("");
  const [draftCovariates, setDraftCovariates] = useState("");
  const [wizardStep, setWizardStep] = useState(0);

  const methodsPlan = studyDesign.methodsPlan ?? {};
  const analysisPlan = studyDesign.analysisPlan ?? {};
  const samples = studyDesign.samples ?? {};

  const [methodsUserPlan, setMethodsUserPlan] = useState(methodsPlan.userPlan ?? "");
  const [methodsConstraints, setMethodsConstraints] = useState(methodsPlan.constraints ?? "");
  const [methodsTools, setMethodsTools] = useState(methodsPlan.preferredTools ?? "");
  const [methodsNotes, setMethodsNotes] = useState(methodsPlan.userNotes ?? "");
  const [methodsSteps, setMethodsSteps] = useState<PlanStep[]>(methodsPlan.steps ?? []);
  const [methodsAdvanced, setMethodsAdvanced] = useState(false);

  const [analysisUserPlan, setAnalysisUserPlan] = useState(analysisPlan.userPlan ?? "");
  const [analysisConstraints, setAnalysisConstraints] = useState(analysisPlan.constraints ?? "");
  const [analysisTools, setAnalysisTools] = useState(analysisPlan.preferredTools ?? "");
  const [analysisNotes, setAnalysisNotes] = useState(analysisPlan.userNotes ?? "");
  const [analysisSteps, setAnalysisSteps] = useState<PlanStep[]>(analysisPlan.steps ?? []);
  const [analysisAdvanced, setAnalysisAdvanced] = useState(false);
  const [outcomeTypes, setOutcomeTypes] = useState(analysisPlan.outcomeTypes ?? "");
  const [covariates, setCovariates] = useState(analysisPlan.covariates ?? "");
  const [covariateEntries, setCovariateEntries] = useState<CovariateEntry[]>(analysisPlan.covariateEntries ?? []);
  const [adhocAnalyses, setAdhocAnalyses] = useState<AdhocAnalysis[]>(analysisPlan.adhocAnalyses ?? []);
  const [analysisMethod, setAnalysisMethod] = useState(analysisPlan.analysisMethod ?? "");

  const objectives = normalizeObjectives(activeWorkspace?.objectives);
  const aims = normalizeAims(activeWorkspace?.aims, activeWorkspace?.aim, activeWorkspace ? `${activeWorkspace.id}:overall` : undefined);
  const linkOptions = linkTargetOptions(activeWorkspace?.aim, objectives, aims);

  const summarizeCovariates = (entries: CovariateEntry[], fallback: string) => {
    const parts = entries.filter((e) => e.description.trim()).map((e) => {
      const opt = linkOptions.find((o) => o.id === (e.scope === "project" ? "project" : e.scopeId));
      return `${e.description.trim()} [${opt?.label ?? e.scope}]`;
    });
    return parts.join("; ") || fallback;
  };

  const workspaceSave = useMutation({
    mutationFn: (body: Parameters<typeof peggyApi.updateWorkspace>[1]) => {
      if (!activeWorkspace) throw new Error("No project selected");
      return peggyApi.updateWorkspace(activeWorkspace.id, body);
    },
    onSuccess: () => {
      void refetchWorkspace();
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      }
      setEditingField(null);
    },
  });

  const openProjectEdit = (field: EditableProjectField) => {
    if (!activeWorkspace) return;
    if (field === "aim") setDraftAim(activeWorkspace.aim ?? "");
    if (field === "objectives") setDraftObjectives(objectivesForForm(activeWorkspace.objectives));
    if (field === "cohort") {
      setDraftExpectedN(samples.expectedN ?? "");
      setDraftSetting(samples.setting ?? "");
    }
    if (field === "modules") {
      const enabled = new Set(activeWorkspace.enabled_modules ?? ["core"]);
      enabled.add("core");
      setDraftModules(Array.from(enabled));
    }
    if (field === "outcomes") {
      const endpoints = asStringList(methodsPlan.lastResult?.endpoints);
      setDraftOutcomes(
        outcomeTypes.trim() ||
          (endpoints.length ? endpoints.join(", ") : "") ||
          (samples.dataTypes?.length ? samples.dataTypes.join(", ") : "")
      );
    }
    if (field === "exposures") setDraftStudyType(samples.studyType ?? "");
    if (field === "covariates") setDraftCovariates(covariates);
    setEditingField(field);
  };

  const cancelProjectEdit = () => setEditingField(null);

  const toggleDraftModule = (id: string) => {
    if (id === "core") return;
    setDraftModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      next.add("core");
      return Array.from(next);
    });
  };

  const llmBlocked = blocksLlmGuidance(samples.identifierLevel);

  useEffect(() => {
    setMethodsUserPlan(methodsPlan.userPlan ?? "");
    setMethodsConstraints(methodsPlan.constraints ?? "");
    setMethodsTools(methodsPlan.preferredTools ?? "");
    setMethodsNotes(methodsPlan.userNotes ?? "");
    setMethodsSteps(methodsPlan.steps ?? []);
    setAnalysisUserPlan(analysisPlan.userPlan ?? "");
    setAnalysisConstraints(analysisPlan.constraints ?? "");
    setAnalysisTools(analysisPlan.preferredTools ?? "");
    setAnalysisNotes(analysisPlan.userNotes ?? "");
    setAnalysisSteps(analysisPlan.steps ?? []);
    setCovariateEntries(analysisPlan.covariateEntries ?? []);
    setAdhocAnalyses(analysisPlan.adhocAnalyses ?? []);
    setCovariates(analysisPlan.covariates ?? "");
    setOutcomeTypes(analysisPlan.outcomeTypes ?? "");
    setAnalysisMethod(analysisPlan.analysisMethod ?? "");
  }, [activeWorkspace?.id]);

  const methodsFields = useMemo(
    () => ({
      mode: "review" as const,
      userPlan: methodsUserPlan,
      constraints: methodsConstraints,
      preferredTools: methodsTools,
      steps: methodsSteps,
      userNotes: methodsNotes,
      draftStatus: methodsPlan.draftStatus,
    }),
    [methodsUserPlan, methodsConstraints, methodsTools, methodsSteps, methodsNotes, methodsPlan.draftStatus]
  );

  const analysisFields = useMemo(
    () => ({
      mode: "review" as const,
      userPlan: analysisUserPlan,
      constraints: analysisConstraints,
      preferredTools: analysisTools,
      outcomeTypes,
      covariates: summarizeCovariates(covariateEntries, covariates),
      covariateEntries,
      adhocAnalyses,
      analysisMethod,
      steps: analysisSteps,
      userNotes: analysisNotes,
      draftStatus: analysisPlan.draftStatus,
    }),
    [
      analysisUserPlan,
      analysisConstraints,
      analysisTools,
      outcomeTypes,
      covariates,
      covariateEntries,
      adhocAnalyses,
      analysisMethod,
      analysisSteps,
      analysisNotes,
      analysisPlan.draftStatus,
      linkOptions,
    ]
  );

  const saveDrafts = async () => {
    await commitSection("methodsPlan", methodsFields);
    await commitSection("analysisPlan", analysisFields);
  };

  const run = useMutation({
    mutationFn: async (mode: "review" | "suggest") => {
      await saveDrafts();
      const body = {
        workspaceId: activeWorkspace!.id,
        mode,
        userPlan: mode === "review" ? methodsUserPlan : "",
        budget: "",
        tools: methodsTools,
        outcomeTypes: outcomeTypes || undefined,
        covariates: summarizeCovariates(covariateEntries, covariates) || undefined,
        analysisMethod: analysisMethod || undefined,
        adhocTests: formatAdhoc(adhocAnalyses) || undefined,
        constraints: methodsConstraints,
      };
      const methods = await peggyApi.methodsPlan(body);
      if (analysisUserPlan.trim() || analysisMethod.trim() || adhocAnalyses.length) {
        await peggyApi.analysisPlan({
          workspaceId: body.workspaceId,
          mode,
          userPlan: mode === "review" ? analysisUserPlan : "",
          budget: body.budget,
          tools: analysisTools,
          outcomeTypes: body.outcomeTypes,
          covariates: body.covariates,
          analysisMethod: body.analysisMethod,
          adhocTests: body.adhocTests,
        });
      }
      return methods;
    },
  });

  const pendingBody = run.data?.body as Record<string, unknown> | undefined;
  const savedBody = (methodsPlan.lastResult ?? analysisPlan.lastResult) as Record<string, unknown> | undefined;
  const displayBody = pendingBody ?? savedBody;
  const hasUnsavedResult = !!pendingBody && !resultsEqual(pendingBody, savedBody);
  const hasSavedResult = !!savedBody;

  const hasPlanText = Boolean(methodsUserPlan.trim() || analysisUserPlan.trim());
  const reviewDisabled = llmBlocked || run.isPending || !hasPlanText;
  const reviewTooltip = !hasPlanText
    ? "Add a methods plan, an analysis plan, or both before review"
    : llmBlocked
      ? "Update Samples to de-identified before using AI planners."
      : "";

  const changedStepCount = [...methodsSteps, ...analysisSteps].filter(
    (s) => (s.objectiveChangedObjectiveIds ?? []).length > 0
  ).length;
  const unlinkedAnalysis = analysisSteps.filter((s) => (s.objectiveIds ?? []).length === 0).length;
  const modules = (activeWorkspace?.enabled_modules ?? ["core"]).map((id) => MODULE_LABELS[id] ?? id).filter(Boolean);
  const cohortBits = [samples.expectedN ? `${samples.expectedN} planned participants` : "", samples.setting ?? ""].filter(
    Boolean
  );
  const methodsEndpoints = asStringList(methodsPlan.lastResult?.endpoints);
  const analysisOutcomes = asStringList(displayBody?.primary_analyses).slice(0, 2);
  const similarCount = Math.max(
    run.data?.sources?.length ?? 0,
    Array.isArray(savedBody?.citations) ? (savedBody?.citations as unknown[]).length : 0
  );
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

  const dirty = isSectionDirty("methodsPlan") || isSectionDirty("analysisPlan");
  const saving = savingSection === "methodsPlan" || savingSection === "analysisPlan";

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to plan methods and analysis.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Tabs value={wizardStep} onChange={(_, v) => setWizardStep(v)} variant="scrollable" allowScrollButtonsMobile>
        {STEPS.map((label, i) => (
          <Tab key={label} label={label} value={i} sx={{ textTransform: "none" }} />
        ))}
      </Tabs>

      {wizardStep === 0 ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent, mb: 0.5 }}>
            FROM YOUR PROJECT
          </Typography>
          <SummaryRow
            label="Aim"
            value={activeWorkspace.aim?.trim() || "Not set"}
            editing={editingField === "aim"}
            onEdit={() => openProjectEdit("aim")}
            onCancel={cancelProjectEdit}
            editPanel={
              <Stack spacing={1.5}>
                <TextField label="Aim" multiline minRows={2} value={draftAim} onChange={(e) => setDraftAim(e.target.value)} fullWidth />
                <Button variant="contained" size="small" disabled={workspaceSave.isPending} sx={{ alignSelf: "flex-start", textTransform: "none" }} onClick={() => workspaceSave.mutate({ aim: draftAim.trim() })}>
                  {workspaceSave.isPending ? "Saving…" : "Save aim"}
                </Button>
              </Stack>
            }
          />
          <SummaryRow
            label="Objectives"
            value={
              objectives.length
                ? `${objectives.length} drafted.${changedStepCount ? ` ${changedStepCount} linked steps flag an objective change.` : ""}${unlinkedAnalysis ? ` ${unlinkedAnalysis} analysis steps have no objective yet.` : ""}`
                : "None drafted."
            }
            editing={editingField === "objectives"}
            onEdit={() => openProjectEdit("objectives")}
            onCancel={cancelProjectEdit}
            editPanel={
              <Stack spacing={1.5}>
                <ObjectiveListEditor value={draftObjectives} onChange={setDraftObjectives} studyDesign={studyDesign} aims={aims} />
                <Button variant="contained" size="small" disabled={workspaceSave.isPending} sx={{ alignSelf: "flex-start", textTransform: "none" }} onClick={() => workspaceSave.mutate({ objectives: normalizeObjectives(draftObjectives).filter((o) => o.text.trim()) })}>
                  {workspaceSave.isPending ? "Saving…" : "Save objectives"}
                </Button>
              </Stack>
            }
          />
          <SummaryRow
            label="Cohort"
            value={cohortBits.join(", ") || "Not set"}
            editing={editingField === "cohort"}
            onEdit={() => openProjectEdit("cohort")}
            onCancel={cancelProjectEdit}
            editPanel={
              <Stack spacing={1.5}>
                <TextField label="Planned participants (N)" value={draftExpectedN} onChange={(e) => setDraftExpectedN(e.target.value)} fullWidth />
                <TextField label="Setting" value={draftSetting} onChange={(e) => setDraftSetting(e.target.value)} fullWidth />
                <Button variant="contained" size="small" disabled={savingSection === "samples"} sx={{ alignSelf: "flex-start", textTransform: "none" }} onClick={() => void commitSection("samples", { ...samples, expectedN: draftExpectedN.trim(), setting: draftSetting.trim() }).then(() => setEditingField(null))}>
                  {savingSection === "samples" ? "Saving…" : "Save cohort"}
                </Button>
              </Stack>
            }
          />
          <SummaryRow
            label="Evidence modules"
            value={modules.length ? `${modules.join(", ")}.` : "Core."}
            editing={editingField === "modules"}
            onEdit={() => openProjectEdit("modules")}
            onCancel={cancelProjectEdit}
            editPanel={
              <Stack spacing={1.5}>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {EVIDENCE_MODULES.map((mod) => {
                    const on = draftModules.includes(mod.id);
                    return (
                      <Chip key={mod.id} label={mod.title} onClick={mod.required ? undefined : () => toggleDraftModule(mod.id)} color={on ? "primary" : "default"} variant={on ? "filled" : "outlined"} sx={{ cursor: mod.required ? "default" : "pointer" }} />
                    );
                  })}
                </Stack>
                <Button variant="contained" size="small" disabled={workspaceSave.isPending} sx={{ alignSelf: "flex-start", textTransform: "none" }} onClick={() => workspaceSave.mutate({ enabled_modules: draftModules })}>
                  {workspaceSave.isPending ? "Saving…" : "Save modules"}
                </Button>
              </Stack>
            }
          />
          <SummaryRow
            label="Outcomes"
            value={methodsEndpoints.length ? methodsEndpoints.join(", ") : analysisOutcomes.length ? analysisOutcomes.join(", ") : samples.dataTypes?.length ? samples.dataTypes.join(", ") : "Not set"}
            editing={editingField === "outcomes"}
            onEdit={() => openProjectEdit("outcomes")}
            onCancel={cancelProjectEdit}
            editPanel={
              <Stack spacing={1.5}>
                <TextField label="Outcome types" value={draftOutcomes} onChange={(e) => setDraftOutcomes(e.target.value)} fullWidth helperText="Comma-separated outcomes for analysis planning." />
                <Button variant="contained" size="small" disabled={saving} sx={{ alignSelf: "flex-start", textTransform: "none" }} onClick={() => { setOutcomeTypes(draftOutcomes); void commitSection("analysisPlan", { ...analysisFields, outcomeTypes: draftOutcomes }).then(() => setEditingField(null)); }}>
                  {saving ? "Saving…" : "Save outcomes"}
                </Button>
              </Stack>
            }
          />
          <SummaryRow
            label="Exposures"
            value={modules.includes("Exposure") ? "From your exposure module." : samples.studyType || "Not set"}
            editing={editingField === "exposures"}
            onEdit={() => openProjectEdit("exposures")}
            onCancel={cancelProjectEdit}
            editPanel={
              <Stack spacing={1.5}>
                <TextField label="Study type / exposure" value={draftStudyType} onChange={(e) => setDraftStudyType(e.target.value)} fullWidth />
                <Button variant="contained" size="small" disabled={savingSection === "samples"} sx={{ alignSelf: "flex-start", textTransform: "none" }} onClick={() => void commitSection("samples", { ...samples, studyType: draftStudyType.trim() }).then(() => setEditingField(null))}>
                  {savingSection === "samples" ? "Saving…" : "Save exposure"}
                </Button>
              </Stack>
            }
          />
          <SummaryRow
            label="Covariates"
            value={summarizeCovariates(covariateEntries, covariates) || "Not set"}
            editing={editingField === "covariates"}
            onEdit={() => openProjectEdit("covariates")}
            onCancel={cancelProjectEdit}
            editPanel={
              <Stack spacing={1.5}>
                <CovariateEntriesEditor
                  entries={covariateEntries}
                  options={linkOptions}
                  onChange={(next) => {
                    setCovariateEntries(next);
                    saveSection("analysisPlan", { covariateEntries: next, covariates: summarizeCovariates(next, "") });
                  }}
                />
                <Button variant="contained" size="small" disabled={saving} sx={{ alignSelf: "flex-start", textTransform: "none" }} onClick={() => { const nextText = summarizeCovariates(covariateEntries, draftCovariates); setCovariates(nextText); void commitSection("analysisPlan", { ...analysisFields, covariates: nextText, covariateEntries }).then(() => setEditingField(null)); }}>
                  {saving ? "Saving…" : "Save covariates"}
                </Button>
              </Stack>
            }
          />
        </Paper>
      ) : null}

      {wizardStep === 1 ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>METHODS</Typography>
          <Typography variant="h6" sx={{ mt: 0.5 }}>Paste your draft methods plan</Typography>
          <TextField placeholder="Paste or type your methods plan" multiline minRows={6} value={methodsUserPlan} onChange={(e) => { setMethodsUserPlan(e.target.value); saveSection("methodsPlan", { userPlan: e.target.value }); }} fullWidth sx={{ mt: 2 }} />
          <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.mutedForeground, mt: 2, mb: 1 }}>CONSTRAINTS (OPTIONAL)</Typography>
          <TextField placeholder="Time, staff, equipment" value={methodsConstraints} onChange={(e) => { setMethodsConstraints(e.target.value); saveSection("methodsPlan", { constraints: e.target.value }); }} fullWidth />
          <Button variant="text" onClick={() => setMethodsAdvanced((v) => !v)} sx={{ textTransform: "none", color: peggyColors.accent, mt: 1, px: 0 }}>Advanced options</Button>
          {methodsAdvanced ? (
            <TextField label="Preferred tools" value={methodsTools} onChange={(e) => { setMethodsTools(e.target.value); saveSection("methodsPlan", { preferredTools: e.target.value }); }} fullWidth sx={{ mt: 1 }} />
          ) : null}
        </Paper>
      ) : null}

      {wizardStep === 2 ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>ANALYSIS</Typography>
          <Typography variant="h6" sx={{ mt: 0.5 }}>Paste your draft analysis plan</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Optional until you have one. Review later looks at methods and analysis together if both are filled.</Typography>
          <TextField placeholder="Paste or type your analysis plan" multiline minRows={6} value={analysisUserPlan} onChange={(e) => { setAnalysisUserPlan(e.target.value); saveSection("analysisPlan", { userPlan: e.target.value }); }} fullWidth />
          <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.mutedForeground, mt: 2, mb: 1 }}>CONSTRAINTS (OPTIONAL)</Typography>
          <TextField placeholder="Software, skills, time" value={analysisConstraints} onChange={(e) => { setAnalysisConstraints(e.target.value); saveSection("analysisPlan", { constraints: e.target.value }); }} fullWidth />
          <Button variant="text" onClick={() => setAnalysisAdvanced((v) => !v)} sx={{ textTransform: "none", color: peggyColors.accent, mt: 1, px: 0 }}>Advanced options</Button>
          {analysisAdvanced ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Outcome types" value={outcomeTypes} onChange={(e) => { setOutcomeTypes(e.target.value); saveSection("analysisPlan", { outcomeTypes: e.target.value }); }} fullWidth />
              <CovariateEntriesEditor entries={covariateEntries} options={linkOptions} onChange={(next) => { setCovariateEntries(next); const text = summarizeCovariates(next, ""); setCovariates(text); saveSection("analysisPlan", { covariateEntries: next, covariates: text }); }} />
              <TextField label="Analysis method" value={analysisMethod} onChange={(e) => { setAnalysisMethod(e.target.value); saveSection("analysisPlan", { analysisMethod: e.target.value }); }} fullWidth />
              <Typography variant="subtitle2">Sensitivity and ad hoc tests</Typography>
              <AdhocAnalysesEditor items={adhocAnalyses} options={linkOptions} onChange={(next) => { setAdhocAnalyses(next); saveSection("analysisPlan", { adhocAnalyses: next }); }} />
              <TextField label="Preferred tools" value={analysisTools} onChange={(e) => { setAnalysisTools(e.target.value); saveSection("analysisPlan", { preferredTools: e.target.value }); }} fullWidth />
            </Stack>
          ) : null}
        </Paper>
      ) : null}

      {wizardStep === 3 ? (
        <>
          {llmBlocked ? <Alert severity="warning">Update Samples to de-identified before using AI planners.</Alert> : null}
          {run.isError ? <Alert severity="error">{formatApiError(run.error)}</Alert> : null}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <DisabledTooltipButton title={reviewTooltip}>
              <span>
                <Button variant="contained" disabled={reviewDisabled} onClick={() => run.mutate("review")} sx={{ textTransform: "none" }}>
                  {run.isPending ? <CircularProgress size={22} color="inherit" /> : "Review plan"}
                </Button>
              </span>
            </DisabledTooltipButton>
            <DisabledTooltipButton title={llmBlocked ? "Update Samples to de-identified before using AI planners." : ""}>
              <span>
                <Button variant="outlined" disabled={llmBlocked || run.isPending} onClick={() => run.mutate("suggest")} sx={{ textTransform: "none" }}>
                  Help me design
                </Button>
              </span>
            </DisabledTooltipButton>
          </Stack>
          {(displayBody || run.isSuccess) && (
            <WorkflowOutputPanel
              mode="methods_plan"
              title="Review output"
              body={displayBody ?? {}}
              sources={run.data?.sources}
              confidence={run.data?.confidence}
              limitations={run.data?.limitations}
              hasUnsavedResult={hasUnsavedResult}
              hasSavedResult={hasSavedResult}
              saving={saving}
              onSaveResult={() => void saveDrafts().then(() => commitSection("methodsPlan", { ...methodsFields, lastResult: pendingBody ?? savedBody })).then(() => run.reset())}
              onClearSaved={() => void commitSection("methodsPlan", { ...methodsFields, lastResult: undefined }).then(() => run.reset())}
              userNotes={methodsNotes}
              onUserNotesChange={(notes) => { setMethodsNotes(notes); saveSection("methodsPlan", { userNotes: notes }); }}
            />
          )}
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>METHODS STEPS</Typography>
            <PlanStepsEditor steps={methodsSteps} aim={activeWorkspace.aim} objectives={objectives} aims={aims} onChange={(next) => { setMethodsSteps(next); saveSection("methodsPlan", { steps: next }); }} />
          </Paper>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>ANALYSIS STEPS</Typography>
            <PlanStepsEditor steps={analysisSteps} aim={activeWorkspace.aim} objectives={objectives} aims={aims} onChange={(next) => { setAnalysisSteps(next); saveSection("analysisPlan", { steps: next }); }} />
          </Paper>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>CHECKLIST FROM SIMILAR STUDIES</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
              {similarCount ? `Based on ${similarCount} papers that match your design.` : "Checked once you run a review."}
            </Typography>
            {checklistItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>Run a review to fill this checklist.</Typography>
            ) : (
              checklistItems.map((item) => (
                <Stack key={`${item.status}-${item.title}`} direction="row" spacing={2} alignItems="center" sx={{ py: 1, px: 1, borderBottom: `0.5px solid ${peggyColors.border}` }}>
                  <Box sx={{ width: 20, height: 20, borderRadius: "999px", bgcolor: item.tone === "accent" ? peggyColors.accent : peggyColors.warning, border: `0.5px solid ${peggyColors.border}`, flexShrink: 0 }} />
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={500}>{item.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.note}</Typography>
                  </Stack>
                  <StatusChip tone={item.tone} label={item.status} />
                </Stack>
              ))
            )}
          </Paper>
        </>
      ) : null}

      <Stack direction="row" justifyContent="space-between">
        <Button disabled={wizardStep === 0} onClick={() => setWizardStep((s) => s - 1)} sx={{ textTransform: "none" }}>Back</Button>
        {wizardStep < 3 ? (
          <Button variant="contained" onClick={() => { void saveDrafts(); setWizardStep((s) => s + 1); }} sx={{ textTransform: "none" }}>Next</Button>
        ) : null}
      </Stack>

      <StudyDesignSaveBar
        dirty={dirty}
        saving={saving}
        note="Save stores methods and analysis drafts. You can reopen any step later."
        onSave={() => void saveDrafts()}
      />
    </Stack>
  );
}
