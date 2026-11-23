export type PlanStepLike = { id?: string; title?: string; objectiveIds?: string[] };

export function missingVsPlan(
  headers: string[],
  planText: string,
  audit: { covariate: string; papers: number }[],
  similarN: number,
  steps: PlanStepLike[] = []
): string[] {
  const lower = new Set(headers.map((h) => h.toLowerCase()));
  const out: string[] = [];
  for (const row of audit) {
    const name = row.covariate.trim();
    if (!name) continue;
    const inData = [...lower].some((h) => h === name.toLowerCase() || h.includes(name.toLowerCase()));
    if (!inData && row.papers > 0 && similarN > 0) {
      const linked = steps.find((s) => (s.title || "").toLowerCase().includes(name.toLowerCase()));
      const stepBit = linked?.id ? ` (analysis plan step ${linked.id})` : "";
      out.push(`${name} is in ${row.papers} of ${similarN} similar studies and not in this dataset${stepBit}`);
    }
  }
  if (!audit.length && planText) {
    for (const step of steps) {
      const title = (step.title || "").trim();
      if (title.length < 3) continue;
      const tokens = title.split(/\s+/).filter((t) => t.length > 4);
      const missing = tokens.filter((t) => /[A-Za-z]/.test(t) && ![...lower].some((h) => h.includes(t.toLowerCase())));
      if (missing.length && headers.length) {
        out.push(`Plan step ${step.id || title} names ${missing[0]} which is not a column in this table`);
      }
    }
  }
  return out;
}
