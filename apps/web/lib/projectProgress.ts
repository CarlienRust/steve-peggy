import type { PaperRecord, Workspace } from "@/lib/api";
import { AIM_LINK_ID, normalizeObjectives, type WorkspaceObjective } from "@/lib/objectives";
import type { StudyDesignData } from "@/lib/studyDesign";

export type ProgressStage = {
  id: string;
  label: string;
  done: boolean;
  href?: string;
  action?: "edit-project";
  reason?: string;
};

export type ProjectProgressSnapshot = {
  stages: ProgressStage[];
  completedCount: number;
  totalCount: number;
  nextStep: ProgressStage | null;
  laterSteps: ProgressStage[];
};

export type ObjectiveProgressRow = {
  id: string;
  label: string;
  text: string;
  status: "open" | "done";
  methodsSteps: number;
  analysisSteps: number;
  findings: number;
  isAim?: boolean;
};

export type ObjectiveProgressSnapshot = {
  rows: ObjectiveProgressRow[];
  completedCount: number;
  totalCount: number;
};

type BuildProgressInput = {
  workspace: Workspace | null | undefined;
  studyDesign: StudyDesignData;
  literatureCount: number;
  ownFindingsCount: number;
  hasGapAnalysis: boolean;
  hasValidateAim: boolean;
};

export function buildProjectProgress(input: BuildProgressInput): ProjectProgressSnapshot {
  const { workspace, studyDesign, literatureCount, ownFindingsCount, hasGapAnalysis, hasValidateAim } = input;
  const samples = studyDesign.samples ?? {};
  const ethics = studyDesign.ethics ?? {};
  const budget = studyDesign.budget ?? {};
  const methodsPlan = studyDesign.methodsPlan ?? {};
  const analysisPlan = studyDesign.analysisPlan ?? {};
  const proposal = studyDesign.proposal ?? {};

  const aim = workspace?.aim?.trim() ?? "";
  const objectives = normalizeObjectives(workspace?.objectives).filter((o) => o.text.trim());

  const stages: ProgressStage[] = [
    {
      id: "aim",
      label: "Aim and objectives",
      done: !!aim && objectives.length > 0,
      action: "edit-project",
      reason: "Define what this project is trying to answer.",
    },
    {
      id: "literature",
      label: "Literature search",
      done: literatureCount > 0,
      href: "/validate/literature",
      reason: "Add papers so gap analysis and comparison have sources.",
    },
    {
      id: "gap",
      label: "Gap analysis",
      done: hasGapAnalysis,
      href: "/validate/gap-analysis",
      reason: "Check whether your idea looks open before deep reading.",
    },
    {
      id: "aim-check",
      label: "Aim checked",
      done: hasValidateAim,
      href: "/validate/aim",
      reason: "Validate the aim against what is already published.",
    },
    {
      id: "samples",
      label: "Samples",
      done: !!(samples.studyType || samples.expectedN || samples.summary),
      href: "/study-design/samples",
      reason: "Describe who and what you will study.",
    },
    {
      id: "ethics",
      label: "Ethics",
      done: !!(ethics.approvalObtained || ethics.notes?.trim() || (ethics.linkedDocuments?.length ?? 0) > 0),
      href: "/study-design/ethics",
      reason: "Record ethics approval or notes before collecting data.",
    },
    {
      id: "methods",
      label: "Methods plan",
      done: !!(methodsPlan.userPlan?.trim() || methodsPlan.lastResult || (methodsPlan.steps?.length ?? 0) > 0),
      href: "/study-design/methods-plan",
      reason: "Draft how you will run the study.",
    },
    {
      id: "analysis",
      label: "Analysis plan",
      done: !!(
        analysisPlan.outcomeTypes?.trim() ||
        analysisPlan.analysisMethod?.trim() ||
        analysisPlan.userPlan?.trim() ||
        analysisPlan.lastResult ||
        (analysisPlan.steps?.length ?? 0) > 0
      ),
      href: "/study-design/analysis-plan",
      reason: "Plan outcomes, covariates, and analysis approach.",
    },
    {
      id: "budget",
      label: "Budget",
      done: !!(budget.summary?.trim() || (budget.lineItems?.length ?? 0) > 0),
      href: "/study-design/budget",
      reason: "Capture funding constraints and line items.",
    },
    {
      id: "proposal",
      label: "Proposal",
      done: !!(proposal.lastResult || proposal.generatedAt),
      href: "/study-design/proposal",
      reason: "Assemble a draft from your design sections.",
    },
    {
      id: "findings",
      label: "Findings",
      done: ownFindingsCount > 0,
      href: "/results/findings",
      reason: "Upload your results to compare against literature.",
    },
  ];

  const completedCount = stages.filter((s) => s.done).length;
  const nextStep = stages.find((s) => !s.done) ?? null;
  const nextIndex = nextStep ? stages.indexOf(nextStep) : -1;
  const laterSteps = nextIndex >= 0 ? stages.slice(nextIndex + 1).filter((s) => !s.done) : [];

  return {
    stages,
    completedCount,
    totalCount: stages.length,
    nextStep,
    laterSteps,
  };
}

function countLinksForTarget(
  targetId: string,
  studyDesign: StudyDesignData,
  findingLinks: { paperId: number; objectiveIds: string[] }[]
) {
  const methodsSteps = (studyDesign.methodsPlan?.steps ?? []).filter((step) => step.objectiveIds.includes(targetId)).length;
  const analysisSteps = (studyDesign.analysisPlan?.steps ?? []).filter((step) => step.objectiveIds.includes(targetId)).length;
  const findings = findingLinks.filter((link) => link.objectiveIds.includes(targetId)).length;
  return { methodsSteps, analysisSteps, findings };
}

export function buildObjectiveProgress(
  workspace: Workspace | null | undefined,
  studyDesign: StudyDesignData
): ObjectiveProgressSnapshot {
  const objectives = normalizeObjectives(workspace?.objectives).filter((o) => o.text.trim());
  const aim = workspace?.aim?.trim() ?? "";
  const findingLinks = studyDesign.objectiveLinks?.findingLinks ?? [];

  const rows: ObjectiveProgressRow[] = objectives.map((obj, index) => {
    const counts = countLinksForTarget(obj.id, studyDesign, findingLinks);
    return {
      id: obj.id,
      label: `Objective ${index + 1}`,
      text: obj.text,
      status: obj.status,
      ...counts,
    };
  });

  const aimCounts = countLinksForTarget(AIM_LINK_ID, studyDesign, findingLinks);
  const aimLinked = aimCounts.methodsSteps + aimCounts.analysisSteps + aimCounts.findings > 0;
  if (aim && aimLinked) {
    rows.unshift({
      id: AIM_LINK_ID,
      label: "Aim",
      text: aim,
      status: "open",
      isAim: true,
      ...aimCounts,
    });
  }

  const completedCount = objectives.filter((o) => o.status === "done").length;
  return {
    rows,
    completedCount,
    totalCount: objectives.length,
  };
}

export function toggleObjectiveStatus(
  objectives: WorkspaceObjective[],
  objectiveId: string,
  done: boolean
): WorkspaceObjective[] {
  return normalizeObjectives(objectives).map((obj) =>
    obj.id === objectiveId ? { ...obj, status: done ? "done" : "open" } : obj
  );
}

export function objectiveLinkSummary(row: ObjectiveProgressRow): string {
  const parts: string[] = [];
  if (row.methodsSteps > 0) parts.push(`${row.methodsSteps} methods step${row.methodsSteps === 1 ? "" : "s"}`);
  if (row.analysisSteps > 0) parts.push(`${row.analysisSteps} analysis step${row.analysisSteps === 1 ? "" : "s"}`);
  if (row.findings > 0) parts.push(`${row.findings} finding set${row.findings === 1 ? "" : "s"}`);
  return parts.length > 0 ? parts.join(" · ") : "Nothing linked yet";
}

export function countLiterature(papers: PaperRecord[]): number {
  return papers.filter((p) => p.source_type === "literature").length;
}

export function countOwnFindings(papers: PaperRecord[]): number {
  return papers.filter((p) => p.source_type === "own_findings").length;
}
