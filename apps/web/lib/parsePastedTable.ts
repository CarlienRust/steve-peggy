import { extractHtmlTables } from "@/lib/extractHtmlTables";

export type ParsedPastedTable = {
  headers: string[];
  rows: string[][];
  title?: string;
  warning?: string;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function padRows(headers: string[], rows: string[][]): { rows: string[][]; warning?: string } {
  const width = headers.length;
  let uneven = false;
  const next = rows.map((r) => {
    if (r.length !== width) uneven = true;
    const copy = [...r];
    while (copy.length < width) copy.push("");
    return copy.slice(0, width);
  });
  return { rows: next, warning: uneven ? "Uneven column counts — padded/truncated." : undefined };
}

/** Parse TSV, simple CSV, or an HTML table snippet into a grid. */
export function parsePastedTable(raw: string): ParsedPastedTable | { error: string } {
  const text = raw.trim();
  if (!text) return { error: "No rows detected" };

  if (text.toLowerCase().includes("<table")) {
    const tables = extractHtmlTables(text, "Pasted table");
    if (!tables.length) return { error: "No rows detected" };
    const t = tables[0];
    const padded = padRows(t.headers, t.rows);
    return { headers: t.headers, rows: padded.rows, title: t.title, warning: padded.warning };
  }

  const lines = text.split(/\r?\n/).map((l) => l.replace(/\u00a0/g, " ")).filter((l) => l.trim());
  if (!lines.length) return { error: "No rows detected" };

  const delim = lines.some((l) => l.includes("\t")) ? "\t" : ",";
  const grid = lines.map((line) => (delim === "\t" ? line.split("\t").map((c) => c.trim()) : splitCsvLine(line)));
  const width = Math.max(...grid.map((r) => r.length), 1);
  if (width < 1) return { error: "No rows detected" };

  const headers = grid[0].length ? grid[0].map((h, i) => h || `Column ${i + 1}`) : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  const data = grid.slice(1).filter((r) => r.some((c) => c.trim()));
  if (!headers.some(Boolean) && !data.length) return { error: "No rows detected" };
  const padded = padRows(headers, data.length ? data : [Array.from({ length: headers.length }, () => "")]);
  return { headers, rows: padded.rows, warning: padded.warning };
}
