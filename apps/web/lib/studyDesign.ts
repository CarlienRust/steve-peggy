export type StudyDesignSamples = {
  studyType?: string;
  expectedN?: string;
  dataTypes?: string[];
  identifierLevel?: "none" | "de_identified" | "identifiable";
  collectionStatus?: string;
  summary?: string;
};

export type StudyDesignEthics = {
  acknowledgedSafety?: boolean;
  fmhsTrack?: string;
  notes?: string;
  lastGuidanceAt?: string;
};

export type StudyDesignPlan = {
  mode?: "review" | "suggest";
  userPlan?: string;
  constraints?: string;
  budget?: string;
  preferredTools?: string;
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
  ethics?: StudyDesignEthics;
  methodsPlan?: StudyDesignPlan;
  analysisPlan?: StudyDesignPlan;
  proposal?: StudyDesignProposal;
};

export const EMPTY_STUDY_DESIGN: StudyDesignData = {
  v: 1,
  samples: {},
  ethics: {},
  methodsPlan: {},
  analysisPlan: {},
  proposal: {},
};

export const STUDY_TYPES = ["Observational", "RCT", "Secondary analysis", "Other"] as const;
export const DATA_TYPES = ["Clinical", "Omics", "Imaging", "Survey", "EHR extracts", "Other"] as const;
export const COLLECTION_STATUSES = ["Planned", "Collecting", "Complete"] as const;
export const IDENTIFIER_LEVELS = [
  { value: "none", label: "No human subjects data" },
  { value: "de_identified", label: "De-identified / aggregate only" },
  { value: "identifiable", label: "Potentially identifiable (AI guidance disabled)" },
] as const;
