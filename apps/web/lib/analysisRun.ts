import type { TestSuggestion } from "@/lib/analysisTestSelector";

export type AnalysisRunResult = {
  test: string;
  summary: string;
  stat?: number;
  pApprox?: number;
};

function nums(values: string[]): number[] {
  return values
    .map((v) => Number(String(v).trim().replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));
}

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function variance(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
}

function normalCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function chi2Sf(x: number, df: number) {
  if (x <= 0 || df <= 0) return 1;
  const k = df / 2;
  const m = x / 2;
  let term = Math.exp(-m);
  let sum = term;
  for (let i = 1; i < k; i += 1) {
    term *= m / i;
    sum += term;
  }
  return Math.min(1, Math.max(0, 1 - sum));
}

function welchT(a: number[], b: number[]): { t: number; df: number } | null {
  if (a.length < 2 || b.length < 2) return null;
  const ma = mean(a);
  const mb = mean(b);
  const va = variance(a) / a.length;
  const vb = variance(b) / b.length;
  const den = va + vb;
  if (!den) return { t: 0, df: a.length + b.length - 2 };
  const t = (ma - mb) / Math.sqrt(den);
  const df = (den * den) / (va * va / (a.length - 1) + vb * vb / (b.length - 1));
  return { t, df };
}

function oneSampleT(xs: number[], mu = 0) {
  if (xs.length < 2) return null;
  const m = mean(xs);
  const s = Math.sqrt(variance(xs));
  if (!s) return { t: 0, df: xs.length - 1 };
  return { t: (m - mu) / (s / Math.sqrt(xs.length)), df: xs.length - 1 };
}

function ranks(xs: number[]) {
  const order = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = Array(xs.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].v === order[i].v) j += 1;
    const avg = (i + j + 2) / 2;
    for (let k = i; k <= j; k += 1) out[order[k].i] = avg;
    i = j + 1;
  }
  return out;
}

function mannWhitney(a: number[], b: number[]) {
  const all = [...a, ...b];
  const r = ranks(all);
  const ra = r.slice(0, a.length).reduce((s, x) => s + x, 0);
  const u = ra - (a.length * (a.length + 1)) / 2;
  const mu = (a.length * b.length) / 2;
  const sd = Math.sqrt((a.length * b.length * (a.length + b.length + 1)) / 12);
  if (!sd) return { u, z: 0 };
  return { u, z: (u - mu) / sd };
}

function splitByGroup(outcome: string[], group: string[]) {
  const map = new Map<string, string[]>();
  outcome.forEach((v, i) => {
    const g = (group[i] || "").trim() || "(blank)";
    const list = map.get(g) ?? [];
    list.push(v);
    map.set(g, list);
  });
  return [...map.entries()];
}

export function runSuggestedTest(
  suggestion: TestSuggestion,
  outcomeValues: string[],
  groupValues?: string[]
): AnalysisRunResult {
  const test = suggestion.test;
  const y = nums(outcomeValues);

  if (test.startsWith("One-sample t-test") || test.startsWith("Wilcoxon signed-rank (one-sample)")) {
    const st = oneSampleT(y, 0);
    if (!st) return { test, summary: "Need at least two numeric outcome values." };
    const p = 2 * (1 - normalCdf(Math.abs(st.t)));
    return { test, stat: st.t, pApprox: p, summary: `t=${st.t.toFixed(3)} (approx. two-sided p=${p.toFixed(4)}) vs 0. n=${y.length}.` };
  }

  if (groupValues?.length) {
    const parts = splitByGroup(outcomeValues, groupValues);
    if (test.includes("Independent samples t-test") || test.includes("Paired t-test")) {
      if (parts.length !== 2) return { test, summary: `Need exactly two groups in the second selected column (found ${parts.length}).` };
      const a = nums(parts[0][1]);
      const b = nums(parts[1][1]);
      const st = welchT(a, b);
      if (!st) return { test, summary: "Need at least two numeric values in each group." };
      const p = 2 * (1 - normalCdf(Math.abs(st.t)));
      return {
        test,
        stat: st.t,
        pApprox: p,
        summary: `${parts[0][0]} n=${a.length} vs ${parts[1][0]} n=${b.length}. t=${st.t.toFixed(3)}, approx. p=${p.toFixed(4)}.`,
      };
    }
    if (test.includes("Mann–Whitney")) {
      if (parts.length !== 2) return { test, summary: `Need exactly two groups (found ${parts.length}).` };
      const a = nums(parts[0][1]);
      const b = nums(parts[1][1]);
      if (a.length < 2 || b.length < 2) return { test, summary: "Need at least two numeric values in each group." };
      const mw = mannWhitney(a, b);
      const p = 2 * (1 - normalCdf(Math.abs(mw.z)));
      return { test, stat: mw.u, pApprox: p, summary: `U=${mw.u.toFixed(1)}, approx. p=${p.toFixed(4)}.` };
    }
    if (test.toLowerCase().includes("chi-square")) {
      const counts = new Map<string, number>();
      for (const v of outcomeValues.map((x) => x.trim()).filter(Boolean)) counts.set(v, (counts.get(v) ?? 0) + 1);
      const levels = [...counts.values()];
      if (levels.length < 2) return { test, summary: "Need at least two outcome categories." };
      const n = levels.reduce((a, b) => a + b, 0);
      const expected = n / levels.length;
      const chi = levels.reduce((s, o) => s + (o - expected) ** 2 / expected, 0);
      const p = chi2Sf(chi, levels.length - 1);
      return { test, stat: chi, pApprox: p, summary: `χ²=${chi.toFixed(3)} (equal-proportion null), df=${levels.length - 1}, approx. p=${p.toFixed(4)}.` };
    }
  } else if (test.toLowerCase().includes("chi-square")) {
    const counts = new Map<string, number>();
    for (const v of outcomeValues.map((x) => x.trim()).filter(Boolean)) counts.set(v, (counts.get(v) ?? 0) + 1);
    const levels = [...counts.values()];
    if (levels.length < 2) return { test, summary: "Need at least two outcome categories." };
    const n = levels.reduce((a, b) => a + b, 0);
    const expected = n / levels.length;
    const chi = levels.reduce((s, o) => s + (o - expected) ** 2 / expected, 0);
    const p = chi2Sf(chi, levels.length - 1);
    return { test, stat: chi, pApprox: p, summary: `χ²=${chi.toFixed(3)} (equal-proportion null), df=${levels.length - 1}, approx. p=${p.toFixed(4)}.` };
  }

  return {
    test,
    summary: "This suggested test is not run automatically yet. Use SPSS/R for ANOVA, Friedman, and multi-group models.",
  };
}
