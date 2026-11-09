export function missingVsPlan(
  headers: string[],
  planText: string,
  audit: { covariate: string; papers: number }[],
  similarN: number
): string[] {
  const lower = new Set(headers.map((h) => h.toLowerCase()));
  const out: string[] = [];
  const steps = planText
    .split(/[\n.;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
  for (const step of steps) {
    const tokens = step.split(/\s+/).filter((t) => t.length > 4);
    for (const t of tokens) {
      if (!lower.has(t.toLowerCase()) && /[A-Za-z]/.test(t) && headers.length) {
        continue;
      }
    }
  }
  for (const row of audit) {
    const name = row.covariate.trim();
    if (!name) continue;
    const inData = [...lower].some((h) => h === name.toLowerCase() || h.includes(name.toLowerCase()));
    if (!inData && row.papers > 0 && similarN > 0) {
      out.push(`${name} is in ${row.papers} of ${similarN} similar studies and not in this dataset`);
    }
  }
  return out;
}
