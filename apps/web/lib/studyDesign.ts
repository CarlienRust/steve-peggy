import { AIM_LINK_ID, normalizeObjectives, type WorkspaceObjective } from "@/lib/objectives";

export type StudyDesignSamples = {
  studyType?: string;
  expectedN?: string;
  dataTypes?: string[];
  identifierLevel?: "none" | "de_identified" | "identifiable";
  collectionStatus?: string;
  recruitment?: string;
  inclusionCriteria?: string;
  exclusionCriteria?: string;
  summary?: string;
  /** @deprecated Legacy — use `budget` section */
  budget?: string;
  linkedDocuments?: LinkedDocument[];
};

export type LinkedDocument = {
  id: number;
  title: string;
  ingestedAt?: string;
};

export function linkedDocumentsFromPapers(
  papers: { id?: number; title?: string; ingested_at?: string | null }[]
): LinkedDocument[] {
  return papers
    .filter((paper): paper is { id: number; title?: string; ingested_at?: string | null } => paper.id != null)
    .map((paper) => ({
      id: paper.id,
      title: paper.title ?? "Untitled",
      ingestedAt: paper.ingested_at?.slice(0, 10),
    }));
}

export function linkedDocumentsChanged(
  saved: LinkedDocument[] | undefined,
  papers: { id?: number }[]
): boolean {
  const savedIds = (saved ?? []).map((doc) => doc.id).sort((a, b) => a - b);
  const paperIds = papers.flatMap((paper) => (paper.id == null ? [] : [paper.id])).sort((a, b) => a - b);
  return savedIds.join(",") !== paperIds.join(",");
}

export type BudgetLineItem = {
  id: string;
  category: string;
  description: string;
  amount: string;
  notes: string;
};

export type StudyDesignBudget = {
  fundingSourceRequired?: boolean;
  summary?: string;
  constraints?: string;
  currency?: string;
  lineItems?: BudgetLineItem[];
};

export type StudyDesignEthics = {
  acknowledgedSafety?: boolean;
  approvalObtained?: boolean;
  approvalDate?: string;
  expiryDate?: string;
  fmhsTrack?: string;
  notes?: string;
  lastGuidanceAt?: string;
  linkedDocuments?: LinkedDocument[];
};

export type PlanStep = {
  id: string;
  title: string;
  objectiveIds: string[];
};

export type StudyDesignPlan = {
  mode?: "review" | "suggest";
  userPlan?: string;
  constraints?: string;
  budget?: string;
  preferredTools?: string;
  outcomeTypes?: string;
  covariates?: string;
  analysisMethod?: string;
  lastResult?: Record<string, unknown>;
  /** Researcher notes; saved with section Save bar, not auto-saved on LLM run */
  userNotes?: string;
  steps?: PlanStep[];
};

export type FindingLink = {
  paperId: number;
  objectiveIds: string[];
};

export type StudyDesignObjectiveLinks = {
  findingLinks?: FindingLink[];
};

export type StudyDesignProposal = {
  focusNotes?: string;
  lastResult?: Record<string, unknown>;
  generatedAt?: string;
  userNotes?: string;
};

export type ProjectTask = {
  id: string;
  text: string;
  status: "open" | "done";
  linkId?: string | null;
};

export type StudyDesignData = {
  v?: number;
  samples?: StudyDesignSamples;
  budget?: StudyDesignBudget;
  ethics?: StudyDesignEthics;
  methodsPlan?: StudyDesignPlan;
  analysisPlan?: StudyDesignPlan;
  proposal?: StudyDesignProposal;
  objectiveLinks?: StudyDesignObjectiveLinks;
  projectTasks?: ProjectTask[];
};

export const EMPTY_STUDY_DESIGN: StudyDesignData = {
  v: 1,
  samples: {},
  budget: {},
  ethics: {},
  methodsPlan: {},
  analysisPlan: {},
  proposal: {},
  objectiveLinks: { findingLinks: [] },
  projectTasks: [],
};

export type ObjectiveLinkUsage = {
  methodsSteps: number;
  analysisSteps: number;
  findings: number;
  total: number;
};

export function countObjectiveLinkUsage(objectiveId: string, studyDesign: StudyDesignData): ObjectiveLinkUsage {
  let methodsSteps = 0;
  let analysisSteps = 0;
  let findings = 0;
  for (const step of studyDesign.methodsPlan?.steps ?? []) {
    if ((step.objectiveIds ?? []).includes(objectiveId)) methodsSteps += 1;
  }
  for (const step of studyDesign.analysisPlan?.steps ?? []) {
    if ((step.objectiveIds ?? []).includes(objectiveId)) analysisSteps += 1;
  }
  for (const link of studyDesign.objectiveLinks?.findingLinks ?? []) {
    if ((link.objectiveIds ?? []).includes(objectiveId)) findings += 1;
  }
  return { methodsSteps, analysisSteps, findings, total: methodsSteps + analysisSteps + findings };
}

export function toggleProjectTask(tasks: ProjectTask[] | undefined, taskId: string, done: boolean): ProjectTask[] {
  return (tasks ?? []).map((task) =>
    task.id === taskId ? { ...task, status: done ? "done" : "open" } : task
  );
}

export function addProjectTask(tasks: ProjectTask[] | undefined, text: string): ProjectTask[] {
  const trimmed = text.trim();
  if (!trimmed) return tasks ?? [];
  return [...(tasks ?? []), { id: crypto.randomUUID(), text: trimmed, status: "open" }];
}

export function countOrphanObjectiveLinks(
  studyDesign: StudyDesignData,
  objectives: WorkspaceObjective[] | unknown,
  aim?: string
): number {
  const valid = validLinkIds(normalizeObjectives(objectives), aim);
  let orphan = 0;
  const countInvalid = (ids: string[]) => {
    for (const id of ids) {
      if (!valid.has(id)) orphan += 1;
    }
  };
  for (const step of studyDesign.methodsPlan?.steps ?? []) {
    countInvalid(step.objectiveIds ?? []);
  }
  for (const step of studyDesign.analysisPlan?.steps ?? []) {
    countInvalid(step.objectiveIds ?? []);
  }
  for (const link of studyDesign.objectiveLinks?.findingLinks ?? []) {
    countInvalid(link.objectiveIds ?? []);
  }
  return orphan;
}

export function pruneFindingLinks(links: FindingLink[] | undefined, validPaperIds: number[]): FindingLink[] {
  const ids = new Set(validPaperIds);
  return (links ?? []).filter((link) => ids.has(link.paperId));
}

export function upsertFindingLink(
  links: FindingLink[] | undefined,
  paperId: number,
  objectiveIds: string[]
): FindingLink[] {
  const rest = (links ?? []).filter((link) => link.paperId !== paperId);
  if (objectiveIds.length === 0) return rest;
  return [...rest, { paperId, objectiveIds }];
}

export function findingLinkForPaper(links: FindingLink[] | undefined, paperId: number): string[] {
  return (links ?? []).find((link) => link.paperId === paperId)?.objectiveIds ?? [];
}

function remapObjectiveIds(
  ids: string[],
  validIds: Set<string>,
  reassignMap: Record<string, string>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const mapped = reassignMap[id] ?? id;
    if (!validIds.has(mapped) || seen.has(mapped)) continue;
    seen.add(mapped);
    out.push(mapped);
  }
  return out;
}

export function validLinkIds(
  objectives: { id: string }[],
  aim?: string
): Set<string> {
  const ids = new Set(objectives.map((o) => o.id));
  if (aim?.trim()) ids.add(AIM_LINK_ID);
  return ids;
}

/** Mirror of services/peggy-api/core/objectives.py reconcile_objective_links */
export function reconcileObjectiveLinks(
  studyDesign: StudyDesignData,
  validIds: Set<string>,
  reassignMap: Record<string, string> = {}
): StudyDesignData {
  const design = structuredClone(studyDesign);
  for (const planKey of ["methodsPlan", "analysisPlan"] as const) {
    const plan = design[planKey];
    if (!plan?.steps) continue;
    plan.steps = plan.steps.map((step) => ({
      ...step,
      objectiveIds: remapObjectiveIds(step.objectiveIds ?? [], validIds, reassignMap),
    }));
  }
  const links = design.objectiveLinks?.findingLinks ?? [];
  design.objectiveLinks = {
    findingLinks: links
      .map((link) => ({
        ...link,
        objectiveIds: remapObjectiveIds(link.objectiveIds ?? [], validIds, reassignMap),
      }))
      .filter((link) => link.objectiveIds.length > 0),
  };
  return design;
}

export const STUDY_TYPES = [
  "Systematic review",
  "Meta-analysis",
  "Scoping review",
  "Cohort study",
  "Cross-sectional study",
  "Case-control study",
  "RCT",
  "NRT",
  "Observational",
  "Secondary analysis",
  "Other",
] as const;

export const DATA_TYPES = [
  "Clinical",
  "Survey",
  "EHR extracts",
  "Interviews",
  "Genomics",
  "Metagenomics",
  "Epigenomics",
  "Transcriptomics",
  "Proteomics",
  "Metabolomics",
  "Phenomics",
  "Microscopy",
  "Radiological imaging",
  "Neuro-signals",
  "Imaging",
  "Omics",
  "Other",
] as const;

export const BUDGET_CATEGORIES = [
  "Personnel",
  "Equipment",
  "Software",
  "Consumables",
  "Participant costs",
  "Travel",
  "Other",
] as const;

export const DEFAULT_BUDGET_LINE_ITEMS = (): BudgetLineItem[] =>
  BUDGET_CATEGORIES.map((category, i) => ({
    id: `row-${i}`,
    category,
    description: "",
    amount: "",
    notes: "",
  }));
export const COLLECTION_STATUSES = ["Planned", "Collecting", "Complete"] as const;
export const IDENTIFIER_LEVELS = [
  { value: "none", label: "No human subjects data" },
  { value: "de_identified", label: "De-identified / aggregate only" },
  { value: "identifiable", label: "Potentially identifiable (AI guidance disabled)" },
] as const;
