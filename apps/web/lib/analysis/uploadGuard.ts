const BLOCKED = [
  ".fastq",
  ".fq",
  ".bam",
  ".cram",
  ".vcf",
  ".bed",
  ".bim",
  ".fam",
  ".pgen",
];

const COMPRESSED = [".gz", ".bz2", ".zst"];

export const GENOMIC_UPLOAD_MESSAGE =
  "Sequence and genotype files identify people. Peggy does not accept reads (.fastq, .bam, .cram) or genotype files (.vcf, .bed/.bim/.fam, .pgen). Use a derived table or summary statistics instead.";

function stripCompression(name: string): string {
  let n = name.toLowerCase();
  for (const ext of COMPRESSED) {
    if (n.endsWith(ext)) n = n.slice(0, -ext.length);
  }
  return n;
}

export function blockedUploadReason(fileName: string): string | null {
  const n = stripCompression(fileName.trim());
  if (BLOCKED.some((ext) => n.endsWith(ext))) return GENOMIC_UPLOAD_MESSAGE;
  return null;
}

export const ANALYSIS_PARSE_MAX_ROWS = 20_000;
export const ANALYSIS_PARSE_MAX_COLS = 200;
export const ANALYSIS_PARSE_WARN_ROWS = 5_000;

export function tableSizeWarning(rowCount: number, colCount: number): string | null {
  if (rowCount > ANALYSIS_PARSE_MAX_ROWS) {
    return `This table has ${rowCount} rows. The analysis tool stops at ${ANALYSIS_PARSE_MAX_ROWS} rows in the browser. Split the file or run a starter script.`;
  }
  if (colCount > ANALYSIS_PARSE_MAX_COLS) {
    return `This table has ${colCount} columns. The analysis tool stops at ${ANALYSIS_PARSE_MAX_COLS} columns in the browser.`;
  }
  if (rowCount > ANALYSIS_PARSE_WARN_ROWS) {
    return `Large table (${rowCount} rows). Descriptives may be slow. Prefer a starter script for full-file work.`;
  }
  return null;
}

export function clipTable<T>(headers: string[], rows: T[][]): { headers: string[]; rows: T[][]; note: string | null } {
  const h = headers.slice(0, ANALYSIS_PARSE_MAX_COLS);
  const r = rows.slice(0, ANALYSIS_PARSE_MAX_ROWS).map((row) => row.slice(0, ANALYSIS_PARSE_MAX_COLS));
  let note: string | null = null;
  if (headers.length > ANALYSIS_PARSE_MAX_COLS || rows.length > ANALYSIS_PARSE_MAX_ROWS) {
    note = `Showing the first ${r.length} rows and ${h.length} columns.`;
  } else {
    note = tableSizeWarning(rows.length, headers.length);
  }
  return { headers: h, rows: r, note };
}
