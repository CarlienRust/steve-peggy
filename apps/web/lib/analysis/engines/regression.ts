import type { RegressionResult } from "@/lib/analysis/types";

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function transpose(m: number[][]): number[][] {
  return m[0].map((_, j) => m.map((row) => row[j]));
}

function mul(a: number[][], b: number[][]): number[][] {
  const out = a.map((row) => Array(b[0].length).fill(0));
  for (let i = 0; i < a.length; i += 1) {
    for (let k = 0; k < b.length; k += 1) {
      for (let j = 0; j < b[0].length; j += 1) out[i][j] += a[i][k] * b[k][j];
    }
  }
  return out;
}

function invert(mat: number[][]): number[][] | null {
  const n = mat.length;
  const a = mat.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < n; i += 1) {
    let pivot = i;
    for (let r = i + 1; r < n; r += 1) if (Math.abs(a[r][i]) > Math.abs(a[pivot][i])) pivot = r;
    if (Math.abs(a[pivot][i]) < 1e-12) return null;
    [a[i], a[pivot]] = [a[pivot], a[i]];
    const div = a[i][i];
    for (let j = 0; j < 2 * n; j += 1) a[i][j] /= div;
    for (let r = 0; r < n; r += 1) {
      if (r === i) continue;
      const f = a[r][i];
      for (let j = 0; j < 2 * n; j += 1) a[r][j] -= f * a[i][j];
    }
  }
  return a.map((row) => row.slice(n));
}

function normalCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function toNum(raw: string): number | null {
  const n = Number(String(raw).trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export const REGRESSION_APPROX_NOTE =
  "Ordinary least squares in JavaScript (complete cases). Standard errors and p-values use a normal approximation, not a full t distribution. Confirm in R or statsmodels before publication. Pyodide is not loaded in this version (bundle size).";

export function fitOls(
  outcome: string[],
  predictors: { name: string; values: string[] }[]
): RegressionResult | { error: string } {
  if (!predictors.length) return { error: "Select at least one predictor." };
  const nRows = outcome.length;
  const rows: { y: number; x: number[] }[] = [];
  for (let i = 0; i < nRows; i += 1) {
    const y = toNum(outcome[i] ?? "");
    if (y == null) continue;
    const x: number[] = [];
    let ok = true;
    for (const p of predictors) {
      const v = toNum(p.values[i] ?? "");
      if (v == null) {
        ok = false;
        break;
      }
      x.push(v);
    }
    if (ok) rows.push({ y, x });
  }
  const n = rows.length;
  const p = predictors.length;
  if (n < p + 2) return { error: `Need at least ${p + 2} complete numeric rows (have ${n}).` };
  const X = rows.map((r) => [1, ...r.x]);
  const y = rows.map((r) => [r.y]);
  const Xt = transpose(X);
  const XtX = mul(Xt, X);
  const inv = invert(XtX);
  if (!inv) return { error: "Design matrix is singular (collinear predictors)." };
  const beta = mul(inv, mul(Xt, y)).map((r) => r[0]);
  const fitted = X.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
  const resid = fitted.map((f, i) => rows[i].y - f);
  const sse = resid.reduce((s, e) => s + e * e, 0);
  const sst = rows.map((r) => r.y).reduce((s, yi) => s + (yi - mean(rows.map((r) => r.y))) ** 2, 0);
  const df = n - p - 1;
  const sigma2 = sse / df;
  const rSquared = sst ? 1 - sse / sst : 0;
  const adj = 1 - (1 - rSquared) * ((n - 1) / df);
  const names = ["(Intercept)", ...predictors.map((pr) => pr.name)];
  const coefficients = beta.map((estimate, j) => {
    const se = Math.sqrt(Math.max(0, sigma2 * inv[j][j]));
    const z = se ? estimate / se : 0;
    const pApprox = 2 * (1 - normalCdf(Math.abs(z)));
    const ci = 1.96 * se;
    return { name: names[j], estimate, se, ciLow: estimate - ci, ciHigh: estimate + ci, pApprox };
  });

  const vif = predictors.map((_, j) => {
    const others = predictors.filter((_, k) => k !== j);
    if (!others.length) return { name: predictors[j].name, vif: 1 };
    const sub = fitOls(
      predictors[j].values,
      others
    );
    if ("error" in sub) return { name: predictors[j].name, vif: Infinity };
    const r2 = sub.rSquared;
    return { name: predictors[j].name, vif: r2 >= 1 ? Infinity : 1 / (1 - r2) };
  });

  const hii = X.map((row) => {
    const rowT = [row];
    const hat = mul(mul(rowT, inv), transpose(rowT))[0][0];
    return hat;
  });
  const cookThreshold = 4 / n;
  let nInfluential = 0;
  for (let i = 0; i < n; i += 1) {
    const h = hii[i];
    const e = resid[i];
    const cook = h === 1 ? 0 : ((e * e) / (sigma2 * (p + 1))) * (h / ((1 - h) * (1 - h)));
    if (cook > cookThreshold) nInfluential += 1;
  }

  return {
    n,
    p: p + 1,
    rSquared,
    adjRSquared: adj,
    coefficients,
    vif,
    nInfluential,
    cookThreshold,
    engine: "js-ols",
    approximationNote: REGRESSION_APPROX_NOTE,
  };
}
