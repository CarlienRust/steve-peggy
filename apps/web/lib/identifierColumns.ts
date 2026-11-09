const ID_HEADER =
  /\b(name|surname|first[\s_]?name|last[\s_]?name|full[\s_]?name|patient[\s_]?id|participant[\s_]?id|\bid\b|mrn|medical[\s_]?record|dob|date[\s_]?of[\s_]?birth|phone|mobile|email|e-?mail|address|gps|lat|lon|longitude|latitude|national[\s_]?id|ssn|id[\s_]?number)\b/i;

export function looksLikeIdentifierHeader(name: string): boolean {
  return ID_HEADER.test(name.replace(/[_-]+/g, " "));
}

export function defaultAdminColumns(headers: string[]): string[] {
  return headers.filter(looksLikeIdentifierHeader);
}

export function smallestGroupSize(rows: string[][], colIndexes: number[]): number | null {
  if (!colIndexes.length || !rows.length) return null;
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = colIndexes.map((i) => (row[i] ?? "").trim()).join("\u0001");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let min = Infinity;
  for (const n of counts.values()) if (n < min) min = n;
  return Number.isFinite(min) ? min : null;
}

export function groupSizeWarns(size: number | null, threshold: number): boolean {
  return size != null && size < threshold;
}
