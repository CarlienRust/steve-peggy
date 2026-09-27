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
};

export type StudyDesignProposal = {
  focusNotes?: string;
  lastResult?: Record<string, unknown>;
  generatedAt?: string;
};

export type StudyDesignData = {
  v?: number;
  samples?: StudyDesignSamples;
  budget?: StudyDesignBudget;
  ethics?: StudyDesignEthics;
  methodsPlan?: StudyDesignPlan;
  analysisPlan?: StudyDesignPlan;
  proposal?: StudyDesignProposal;
};

export const EMPTY_STUDY_DESIGN: StudyDesignData = {
  v: 1,
  samples: {},
  budget: {},
  ethics: {},
  methodsPlan: {},
  analysisPlan: {},
  proposal: {},
};

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
