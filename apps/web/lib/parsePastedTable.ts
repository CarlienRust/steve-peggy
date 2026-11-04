import { extractHtmlTables } from "@/lib/extractHtmlTables";

export type ParsedPastedTable = {
  headers: string[];
  rows: string[][];
  title?: string;
  warning?: string;
};

function looksLikeHtmlTable(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("<table") || lower.includes("<tr") || lower.includes("mso-");
}

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

function splitPipeLine(line: string): string[] {
  const parts = line.split("|").map((c) => c.trim());
  if (parts.length && parts[0] === "") parts.shift();
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

function isMarkdownSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "");
}

function splitLines(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\u00a0/g, " "))
    .filter((l) => l.trim());
}

function widthOf(grid: string[][]): number {
  return Math.max(...grid.map((r) => r.length), 1);
}

function splitPlainGrid(lines: string[]): string[][] {
  const majority = (pred: (l: string) => boolean) =>
    lines.filter(pred).length >= Math.max(1, Math.ceil(lines.length / 2));

  if (lines.some((l) => l.includes("\t"))) {
    const grid = lines.map((l) => l.split("\t").map((c) => c.trim()));
    if (widthOf(grid) >= 2) return grid;
  }
  if (majority((l) => /\s{2,}/.test(l))) {
    const grid = lines.map((l) => l.split(/\s{2,}/).map((c) => c.trim()));
    if (widthOf(grid) >= 2) return grid;
  }
  if (majority((l) => l.includes("|"))) {
    const grid = lines
      .map((l) => splitPipeLine(l))
      .filter((cells) => cells.some(Boolean) && !isMarkdownSeparator(cells));
    if (widthOf(grid) >= 2) return grid;
  }
  return lines.map((line) => splitCsvLine(line));
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
  return { rows: next, warning: uneven ? "Uneven column counts; padded or truncated." : undefined };
}

/** Parse Word HTML, TSV, space-padded columns, pipes, or CSV into a grid. Never splits on a single space. */
export function parsePastedTable(raw: string): ParsedPastedTable | { error: string } {
  const text = raw.trim();
  if (!text) return { error: "No rows detected" };

  if (looksLikeHtmlTable(text)) {
    const tables = extractHtmlTables(text, "Pasted table");
    if (tables.length) {
      const t = tables[0];
      const padded = padRows(t.headers, t.rows);
      return { headers: t.headers, rows: padded.rows, title: t.title, warning: padded.warning };
    }
  }

  const lines = splitLines(text);
  if (!lines.length) return { error: "No rows detected" };

  const grid = splitPlainGrid(lines);
  const width = widthOf(grid);
  if (width < 1) return { error: "No rows detected" };

  const headers = grid[0].length
    ? grid[0].map((h, i) => h || `Column ${i + 1}`)
    : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  const data = grid.slice(1).filter((r) => r.some((c) => c.trim()));
  if (!headers.some(Boolean) && !data.length) return { error: "No rows detected" };
  const padded = padRows(headers, data.length ? data : [Array.from({ length: headers.length }, () => "")]);
  return { headers, rows: padded.rows, warning: padded.warning };
}
