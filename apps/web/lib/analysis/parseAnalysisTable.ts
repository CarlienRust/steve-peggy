import { blockedUploadReason, clipTable } from "@/lib/analysis/uploadGuard";
import { peggyApi, type PaperRecord } from "@/lib/api";
import { parsePastedTable } from "@/lib/parsePastedTable";
import { datasetFileName, looksLikeSavFile, parseSavTable } from "@/lib/parseSavTable";

export type ParsedAnalysisTable = {
  name: string;
  headers: string[];
  rows: string[][];
  warning?: string;
};

export async function parseAnalysisFile(file: File): Promise<ParsedAnalysisTable | { error: string }> {
  const blockedFile = blockedUploadReason(file.name);
  if (blockedFile) return { error: blockedFile };
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    return { error: "Use CSV, TSV, TXT, or SPSS SAV for analysis. PDFs stay on Samples as dictionaries." };
  }
  let parsed: ReturnType<typeof parsePastedTable>;
  if (lower.endsWith(".sav") || lower.endsWith(".zsav") || (await looksLikeSavFile(file))) {
    parsed = await parseSavTable(file);
  } else if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
    parsed = parsePastedTable(await file.text());
  } else {
    return { error: "Use CSV, TSV, plain text, or SPSS SAV." };
  }
  if ("error" in parsed) return parsed;
  const clipped = clipTable(parsed.headers, parsed.rows);
  const warning = [parsed.warning, clipped.note].filter(Boolean).join(" ");
  return { name: file.name, headers: clipped.headers, rows: clipped.rows, warning: warning || undefined };
}

export async function parseCorpusDataset(paper: PaperRecord): Promise<ParsedAnalysisTable | { error: string }> {
  const raw = await peggyApi.getPaperFile(paper.id!);
  const name = datasetFileName(paper, raw);
  const file = new File([raw], name, { type: raw.type || paper.content_type || "application/octet-stream" });
  return parseAnalysisFile(file);
}
