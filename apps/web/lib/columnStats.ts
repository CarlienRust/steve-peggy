export type ColumnKind = "continuous" | "categorical";

export function formatSuppressedCount(n: number, threshold: number): string {
  if (n > 0 && n < threshold) return `<${threshold}`;
  return String(n);
}

export type ColumnProfile = {
  name: string;
  kind: ColumnKind;
  n: number;
  missing: number;
  missingPercent?: number;
  mean?: number;
  sd?: number;
  median?: number;
  iqr?: number;
  min?: number;
  max?: number;
  frequencies?: { value: string; count: number }[];
  histogram?: { bin: string; count: number }[];
  shapiroW?: number;
  approxNormal?: boolean;
  parametricHint: "parametric" | "nonparametric" | "na";
};

function toNumber(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function inferColumnKind(values: string[]): ColumnKind {
  const filled = values.map((v) => v.trim()).filter(Boolean);
  if (!filled.length) return "categorical";
  const numeric = filled.filter((v) => toNumber(v) != null).length;
  if (numeric / filled.length >= 0.8) return "continuous";
  return "categorical";
}

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sd(xs: number[], m: number) {
  if (xs.length < 2) return 0;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function iqr(xs: number[]): number | undefined {
  if (xs.length < 4) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const q1 = median(s.slice(0, Math.floor(s.length / 2)));
  const q3 = median(s.slice(Math.ceil(s.length / 2)));
  return q3 - q1;
}

function histogram(xs: number[], bins = 8): { bin: string; count: number }[] {
  if (!xs.length) return [];
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  if (lo === hi) return [{ bin: String(lo), count: xs.length }];
  const width = (hi - lo) / bins;
  const counts = Array.from({ length: bins }, () => 0);
  for (const x of xs) {
    let i = Math.floor((x - lo) / width);
    if (i >= bins) i = bins - 1;
    counts[i] += 1;
  }
  return counts.map((count, i) => {
    const a = lo + i * width;
    const b = a + width;
    return { bin: `${a.toFixed(2)}-${b.toFixed(2)}`, count };
  });
}

/** Shapiro–Francia style W' (squared correlation of order stats vs normal scores). */
export function shapiroLike(xs: number[]): { w: number; approxNormal: boolean } | null {
  const n = xs.length;
  if (n < 3 || n > 5000) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const scores = sorted.map((_, i) => {
    const p = (i + 1 - 0.375) / (n + 0.25);
    return invNorm(p);
  });
  const r = pearson(sorted, scores);
  if (r == null) return null;
  const w = r * r;
  return { w, approxNormal: w >= 0.95 };
}

function pearson(a: number[], b: number[]): number | null {
  const n = a.length;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const den = Math.sqrt(da * db);
  if (!den) return null;
  return num / den;
}

function invNorm(p: number): number {
  const clamped = Math.min(1 - 1e-10, Math.max(1e-10, p));
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  if (clamped < plow) {
    const q = Math.sqrt(-2 * Math.log(clamped));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (clamped > 1 - plow) {
    const q = Math.sqrt(-2 * Math.log(1 - clamped));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = clamped - 0.5;
  const r = q * q;
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577509590705e2, -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [-5.447609879936275e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  return (
    (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
    q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

export function profileColumn(name: string, values: string[], kindOverride?: ColumnKind): ColumnProfile {
  const missing = values.filter((v) => !v.trim()).length;
  const filled = values.filter((v) => v.trim());
  const kind = kindOverride ?? inferColumnKind(values);
  const missingPercent = values.length ? (100 * missing) / values.length : 0;
  if (kind === "categorical") {
    const counts = new Map<string, number>();
    for (const v of filled) counts.set(v, (counts.get(v) ?? 0) + 1);
    const frequencies = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([value, count]) => ({ value, count }));
    return { name, kind, n: filled.length, missing, missingPercent, frequencies, parametricHint: "na" };
  }
  const nums = filled.map(toNumber).filter((n): n is number => n != null);
  const m = nums.length ? mean(nums) : 0;
  const med = nums.length ? median(nums) : 0;
  const sw = nums.length >= 3 ? shapiroLike(nums) : null;
  const hist = histogram(nums);
  let parametricHint: ColumnProfile["parametricHint"] = "nonparametric";
  if (sw?.approxNormal) parametricHint = "parametric";
  else if (!sw && nums.length >= 3 && Math.abs(m - med) <= (sd(nums, m) || 1) * 0.25) parametricHint = "parametric";
  return {
    name,
    kind,
    n: nums.length,
    missing,
    missingPercent,
    mean: nums.length ? m : undefined,
    sd: nums.length ? sd(nums, m) : undefined,
    median: nums.length ? med : undefined,
    iqr: nums.length ? iqr(nums) : undefined,
    min: nums.length ? Math.min(...nums) : undefined,
    max: nums.length ? Math.max(...nums) : undefined,
    histogram: hist,
    shapiroW: sw?.w,
    approxNormal: sw?.approxNormal,
    parametricHint,
  };
}

export function profileTable(
  headers: string[],
  rows: string[][],
  kindOverrides?: Record<string, ColumnKind>
): ColumnProfile[] {
  return headers.map((name, i) => profileColumn(name, rows.map((r) => r[i] ?? ""), kindOverrides?.[name]));
}
