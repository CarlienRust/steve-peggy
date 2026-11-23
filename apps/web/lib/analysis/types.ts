export type AnalysisStatus = "stable" | "beta" | "planned";
export type AnalysisDomain =
  | "general"
  | "diet"
  | "microbiome"
  | "genomics"
  | "exposome"
  | "ml"
  | "omics";
export type ResourceClass = "light" | "heavy";
export type RunPathKind = "browser" | "script" | "external" | "guidance";

export type StepDef = {
  id: string;
  label: string;
  resourceClass: ResourceClass;
  runPaths: RunPathKind[];
  tools: string[];
  decisions: string[];
  pitfalls: string[];
};

export type CheckDef = {
  id: string;
  message: string;
};

export type AnalysisFunction = {
  id: string;
  label: string;
  version: string;
  status: AnalysisStatus;
  domain: AnalysisDomain;
  inputs: {
    dataKinds: string[];
    requiredRoles: string[];
    optionalRoles: string[];
  };
  steps: StepDef[];
  checks: CheckDef[];
  reporting: { guideline: string; items: string[]; confirmed: boolean };
  extractionFields: string[];
  results: { schema: string; class: "D" };
};

export type ColumnAggregate = {
  name: string;
  kind?: string;
  n?: number;
  missingPercent?: number;
  mean?: number;
  sd?: number;
  median?: number;
  iqr?: number;
  frequencies?: { value: string; count: string | number }[];
};

export type ComputeProfileJson = {
  scheduler: "none" | "slurm" | "pbs";
  queue: string;
  walltime: string;
  memoryGb: string;
  containerRuntime: string;
  computeNodesHaveInternet: boolean;
  moduleNames: string;
  storagePath: string;
  preset: string;
  python: boolean;
  r: boolean;
};

export const DEFAULT_COMPUTE_PROFILE: ComputeProfileJson = {
  scheduler: "none",
  queue: "",
  walltime: "",
  memoryGb: "",
  containerRuntime: "",
  computeNodesHaveInternet: false,
  moduleNames: "",
  storagePath: "{{STORAGE_PATH}}",
  preset: "",
  python: true,
  r: true,
};

export type RegressionCoefficient = {
  name: string;
  estimate: number;
  se: number;
  ciLow: number;
  ciHigh: number;
  pApprox: number;
};

export type RegressionResult = {
  n: number;
  p: number;
  rSquared: number;
  adjRSquared: number;
  coefficients: RegressionCoefficient[];
  vif: { name: string; vif: number }[];
  nInfluential: number;
  cookThreshold: number;
  engine: "js-ols";
  approximationNote: string;
};
