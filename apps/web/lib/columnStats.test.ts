import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatSuppressedCount, iqr, profileColumn, profileTable } from "@/lib/columnStats";

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../../../fixtures/analysis/descriptives.json"), "utf8")
) as { values: string[]; mean: number; sd: number; median: number; iqr: number; n: number };

describe("columnStats", () => {
  it("matches reference mean, sd, median, iqr", () => {
    const p = profileColumn("x", fixture.values, "continuous");
    expect(p.n).toBe(fixture.n);
    expect(p.mean).toBeCloseTo(fixture.mean, 10);
    expect(p.sd).toBeCloseTo(fixture.sd, 10);
    expect(p.median).toBeCloseTo(fixture.median, 10);
    expect(p.iqr).toBeCloseTo(fixture.iqr, 10);
  });

  it("iqr is defined for n>=4", () => {
    expect(iqr([1, 2, 3, 4, 5])).toBe(3);
  });

  it("never shows a raw count below the threshold", () => {
    const p = profileColumn("g", ["a", "a", "a", "b", "b", "c"], "categorical");
    const threshold = 5;
    for (const f of p.frequencies ?? []) {
      const shown = formatSuppressedCount(f.count, threshold);
      if (f.count > 0 && f.count < threshold) expect(shown).toBe(`<${threshold}`);
      expect(shown).not.toBe(String(f.count === 3 ? 3 : f.count));
    }
    const shown = (p.frequencies ?? []).map((f) => formatSuppressedCount(f.count, 5));
    expect(shown.every((s) => s.startsWith("<") || Number(s) >= 5 || s === "0")).toBe(true);
  });

  it("profileTable infers kinds", () => {
    const rows = [
      ["1", "yes"],
      ["2", "no"],
    ];
    const profiles = profileTable(["n", "flag"], rows);
    expect(profiles[0].kind).toBe("continuous");
    expect(profiles[1].kind).toBe("categorical");
  });
});
