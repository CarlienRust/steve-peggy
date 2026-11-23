import type { AnalysisFunction } from "@/lib/analysis/types";
import datasetDescription from "@/lib/analysis/functions/dataset-description.json";
import linearRegression from "@/lib/analysis/functions/linear-regression.json";
import gutMicrobiome from "@/lib/analysis/functions/gut-microbiome-feature.json";
import genomicsSnp from "@/lib/analysis/functions/genomics-snp-panel.json";
import mlReview from "@/lib/analysis/functions/ml-review.json";
import dietAnalysis from "@/lib/analysis/functions/diet-analysis.json";
import exposome from "@/lib/analysis/functions/exposome.json";
import omicsGeneric from "@/lib/analysis/functions/omics-generic.json";

const FUNCTIONS: AnalysisFunction[] = [
  datasetDescription as AnalysisFunction,
  linearRegression as AnalysisFunction,
  gutMicrobiome as AnalysisFunction,
  genomicsSnp as AnalysisFunction,
  mlReview as AnalysisFunction,
  dietAnalysis as AnalysisFunction,
  exposome as AnalysisFunction,
  omicsGeneric as AnalysisFunction,
];

export function listAnalysisFunctions(): AnalysisFunction[] {
  return FUNCTIONS;
}

export function getAnalysisFunction(id: string): AnalysisFunction | undefined {
  return FUNCTIONS.find((f) => f.id === id);
}
