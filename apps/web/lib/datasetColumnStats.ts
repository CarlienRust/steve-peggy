import { datasetFileName, looksLikeSavFile, parseSavTable } from "@/lib/parseSavTable";
import { parsePastedTable } from "@/lib/parsePastedTable";
import type { PaperRecord } from "@/lib/api";

export type ColumnStat = {
  name: string;
  inferredType: string;
  missingPct: number;
};

const MAX_ROWS = 500;

function inferType(values: string[]): string {
  const nonEmpty = values.filter((v) => v.trim() !== "");
  if (nonEmpty.length === 0) return "empty";
  const numeric = nonEmpty.filter((v) => /^-?\d+(\.\d+)?$/.test(v.trim())).length;
  if (numeric / nonEmpty.length > 0.9) return "numeric";
  const dates = nonEmpty.filter((v) => /^\d{4}-\d{2}-\d{2}/.test(v.trim())).length;
  if (dates / nonEmpty.length > 0.5) return "date";
  return "text";
}

export function columnStatsFromTable(headers: string[], rows: string[][]): ColumnStat[] {
  const stats: ColumnStat[] = [];
  for (let c = 0; c < headers.length; c++) {
    const name = headers[c] || `col_${c + 1}`;
    const col = rows.map((r) => String(r[c] ?? "").trim());
    const missing = col.filter((v) => !v).length;
    const missingPct = rows.length ? Math.round((missing / rows.length) * 100) : 0;
    stats.push({ name, inferredType: inferType(col), missingPct });
  }
  return stats;
}

export async function loadDatasetProfile(
  paper: PaperRecord,
  rawFile: File
): Promise<{ headers: string[]; rowCount: number; columnStats: ColumnStat[]; fileType: string }> {
  const name = datasetFileName(paper, rawFile);
  const lower = name.toLowerCase();
  let headers: string[] = [];
  let rows: string[][] = [];
  const fileType = lower.split(".").pop()?.toUpperCase() || "FILE";

  const sav = lower.endsWith(".sav") || lower.endsWith(".zsav") || (await looksLikeSavFile(rawFile));
  if (sav) {
    const parsed = await parseSavTable(rawFile);
    if ("error" in parsed) throw new Error(parsed.error);
    headers = parsed.headers;
    rows = parsed.rows.slice(0, MAX_ROWS);
  } else if (lower.endsWith(".pdf") || rawFile.type === "application/pdf") {
    throw new Error("PDF data dictionaries are not auto-validated. Upload CSV, TSV, TXT, or SAV.");
  } else {
    const parsed = parsePastedTable(await rawFile.text());
    if ("error" in parsed) throw new Error(parsed.error);
    headers = parsed.headers;
    rows = parsed.rows.slice(0, MAX_ROWS);
  }
  return {
    headers,
    rowCount: rows.length,
    columnStats: columnStatsFromTable(headers, rows),
    fileType,
  };
}