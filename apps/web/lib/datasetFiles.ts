/** Shared accept rules for sample_datasets uploads (Validate + Samples). */

import { blockedUploadReason } from "@/lib/analysis/uploadGuard";

export const DATASET_UPLOAD_ACCEPT = "application/pdf,.pdf,.csv,.tsv,.txt,.sav,.zsav";

export function isAcceptedDatasetFile(file: File): boolean {
  if (blockedUploadReason(file.name)) return false;
  const n = file.name.toLowerCase();
  return (
    file.type === "application/pdf" ||
    n.endsWith(".pdf") ||
    n.endsWith(".csv") ||
    n.endsWith(".tsv") ||
    n.endsWith(".txt") ||
    n.endsWith(".sav") ||
    n.endsWith(".zsav")
  );
}

export function datasetUploadTitle(file: File): string {
  return file.name.replace(/\.(pdf|csv|tsv|txt|sav|zsav)$/i, "");
}