import type { PaperRecord, Workspace } from "@/lib/api";
import { normalizeAims } from "@/lib/aims";
import { AIM_LINK_ID, PROJECT_LINK_ID, normalizeObjectives, type ObjectiveStatus, type WorkspaceObjective } from "@/lib/objectives";
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
  flow: ProgressStage[];
  completedCount: number;
  totalCount: number;
  nextStep: ProgressStage | null;
  laterSteps: ProgressStage[];
};

export type ObjectiveProgressRow = {
  id: string;
  label: string;
  text: string;
  status: ObjectiveStatus;
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
  ethicsDocumentCount: number;
  sampleDatasetCount: number;
  hasGapAnalysis: boolean;
  hasValidateAim: boolean;
};

function samplesStarted(samples: StudyDesignData["samples"], sampleDatasetCount: number): boolean {
  if (!samples) return sampleDatasetCount > 0;
  return !!(
    samples.studyType ||
    samples.expectedN ||
    samples.summary?.trim() ||
    samples.recruitment?.trim() ||
    samples.inclusionCriteria?.trim() ||
    (samples.dataTypes?.length ?? 0) > 0 ||
    sampleDatasetCount > 0
  );
}

function methodsStarted(studyDesign: StudyDesignData): boolean {
  const methodsPlan = studyDesign.methodsPlan ?? {};
  const analysisPlan = studyDesign.analysisPlan ?? {};
  return !!(
    methodsPlan.draftStatus === "completed" ||
    methodsPlan.userPlan?.trim() ||
    methodsPlan.lastResult ||
    (methodsPlan.steps?.length ?? 0) > 0 ||
    analysisPlan.userPlan?.trim() ||
    analysisPlan.lastResult ||
    (analysisPlan.steps?.length ?? 0) > 0
  );
}

function ethicsStarted(
  ethics: StudyDesignData["ethics"],
  ethicsDocumentCount: number
): boolean {
  if (ethicsDocumentCount > 0) return true;
  if (!ethics) return false;
  return !!(
    ethics.approvalObtained ||
    ethics.acknowledgedSafety ||
    ethics.notes?.trim() ||
    ethics.fmhsTrack?.trim() ||
    ethics.approvalDate ||
    ethics.expiryDate ||
    (ethics.linkedDocuments?.length ?? 0) > 0
  );
}

export function buildProjectProgress(input: BuildProgressInput): ProjectProgressSnapshot {
  const {
    workspace,
    studyDesign,
    literatureCount,
    ownFindingsCount,
    ethicsDocumentCount,
    sampleDatasetCount,
    hasGapAnalysis,
    hasValidateAim,
  } = input;
  const samples = studyDesign.samples ?? {};
  const ethics = studyDesign.ethics ?? {};
  const budget = studyDesign.budget ?? {};
  const proposal = studyDesign.proposal ?? {};
  const startingPoint =
    workspace?.settings && typeof workspace.settings === "object"
      ? String((workspace.settings as Record<string, unknown>).starting_point ?? "")
      : "";

  const aims = workspace ? normalizeAims(workspace.aims, workspace.aim, `${workspace.id}:overall`) : [];
  const aim = aims.find((a) => a.role === "overall")?.text.trim() || workspace?.aim?.trim() || "";
  const objectives = normalizeObjectives(workspace?.objectives).filter((o) => o.text.trim());
  const samplesDone = samplesStarted(samples, sampleDatasetCount);
  const methodsDone = methodsStarted(studyDesign);
  const ethicsDone = ethicsStarted(ethics, ethicsDocumentCount);
  const findingsDone = ownFindingsCount > 0;
  const ideaDone = !!aim || hasGapAnalysis || startingPoint === "gap" || startingPoint === "idea";
  const aimDone = !!aim && objectives.length > 0;
  const designDone = samplesDone && methodsDone;
  const budgetDone = !!(budget.summary?.trim() || (budget.lineItems?.length ?? 0) > 0);
  const proposalDone = !!(proposal.lastResult || proposal.generatedAt);

  const stages: ProgressStage[] = [
    {
      id: "aim",
      label: "Aim and objectives",
      done: aimDone,
      href: "/validate/aim",
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
      done: samplesDone,
      href: "/study-design/samples",
      reason: "Describe who and what you will study.",
    },
    {
      id: "ethics",
      label: "Ethics",
      done: ethicsDone,
      href: "/study-design/ethics",
      reason: "Record ethics approval, notes, or letters.",
    },
    {
      id: "methods",
      label: "Methods plan",
      done: methodsDone,
      href: "/study-design/methods-plan",
      reason: "Draft methods and analysis in one place.",
    },
    {
      id: "budget",
      label: "Budget",
      done: budgetDone,
      href: "/study-design/budget",
      reason: "Capture funding constraints and line items.",
    },
    {
      id: "proposal",
      label: "Proposal",
      done: proposalDone,
      href: "/study-design/proposal",
      reason: "Assemble a draft from your design sections.",
    },
    {
      id: "findings",
      label: "Findings",
      done: findingsDone,
      href: "/results/findings",
      reason: "Upload your results to compare against literature.",
    },
  ];

  const designNoteParts = [samplesDone, methodsDone, budgetDone, proposalDone].filter(Boolean).length;
  const flow: ProgressStage[] = [
    {
      id: "flow-idea",
      label: "Idea or gap",
      done: ideaDone,
      href: hasGapAnalysis || startingPoint === "gap" ? "/validate/gap-analysis" : "/validate/aim",
      reason: ideaDone ? (hasGapAnalysis ? "Gap scan on file" : "Idea or aim entered") : "Not started",
    },
    {
      id: "flow-aim",
      label: "Aim and objectives",
      done: aimDone,
      href: "/validate/aim",
      reason: aimDone ? "Aim and objectives set" : "Not started",
    },
    {
      id: "flow-design",
      label: "Design",
      done: designDone,
      href: "/study-design",
      reason: `${designNoteParts} of 4 sections (samples, methods, budget, proposal)`,
    },
    {
      id: "flow-ethics",
      label: "Ethics and admin",
      done: ethicsDone,
      href: "/study-design/ethics",
      reason: ethicsDone
        ? ethicsDocumentCount > 0
          ? "Letters or notes on file"
          : "Notes or approval on file"
        : "Not started",
    },
    {
      id: "flow-results",
      label: "Results",
      done: findingsDone,
      href: "/results/findings",
      reason: findingsDone ? "Findings uploaded" : "Not started",
    },
  ];

  const nextStep = flow.find((s) => !s.done) ?? null;
  const nextIndex = nextStep ? flow.indexOf(nextStep) : -1;
  const laterSteps = nextIndex >= 0 ? flow.slice(nextIndex + 1).filter((s) => !s.done) : [];
  const completedCount = flow.filter((s) => s.done).length;

  return {
    stages,
    flow,
    completedCount,
    totalCount: flow.length,
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
  const aimsList = workspace ? normalizeAims(workspace.aims, workspace.aim, `${workspace.id}:overall`) : [];
  const objectives = normalizeObjectives(workspace?.objectives).filter((o) => o.text.trim());
  const aim = aimsList.find((a) => a.role === "overall")?.text.trim() || workspace?.aim?.trim() || "";
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

  const overall = workspace ? normalizeAims(workspace.aims, workspace.aim, `${workspace.id}:overall`).find((a) => a.role === "overall") : undefined;
  const overallId = overall?.id ?? AIM_LINK_ID;
  const aimCounts = {
    methodsSteps:
      countLinksForTarget(AIM_LINK_ID, studyDesign, findingLinks).methodsSteps +
      countLinksForTarget(overallId, studyDesign, findingLinks).methodsSteps +
      countLinksForTarget(PROJECT_LINK_ID, studyDesign, findingLinks).methodsSteps,
    analysisSteps:
      countLinksForTarget(AIM_LINK_ID, studyDesign, findingLinks).analysisSteps +
      countLinksForTarget(overallId, studyDesign, findingLinks).analysisSteps +
      countLinksForTarget(PROJECT_LINK_ID, studyDesign, findingLinks).analysisSteps,
    findings:
      countLinksForTarget(AIM_LINK_ID, studyDesign, findingLinks).findings +
      countLinksForTarget(overallId, studyDesign, findingLinks).findings +
      countLinksForTarget(PROJECT_LINK_ID, studyDesign, findingLinks).findings,
  };
  const aimLinked = aimCounts.methodsSteps + aimCounts.analysisSteps + aimCounts.findings > 0;
  if (aim && aimLinked) {
    rows.unshift({
      id: overallId,
      label: "Overall aim",
      text: aim,
      status: "draft",
      isAim: true,
      ...aimCounts,
    });
  }

  const completedCount = objectives.filter((o) => o.status === "defined" || o.status === "done").length;
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
    obj.id === objectiveId ? { ...obj, status: done ? "defined" : "draft" } : obj
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
