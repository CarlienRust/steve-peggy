import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fitOls } from "@/lib/analysis/engines/regression";

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../../../../../fixtures/analysis/ols.json"), "utf8")
) as { x: string[]; y: string[]; intercept: number; slope: number; rSquared: number };

describe("fitOls", () => {
  it("recovers 1 + 2x within tolerance", () => {
    const out = fitOls(fixture.y, [{ name: "x", values: fixture.x }]);
    if ("error" in out) throw new Error(out.error);
    expect(out.rSquared).toBeCloseTo(fixture.rSquared, 10);
    expect(out.coefficients[0].estimate).toBeCloseTo(fixture.intercept, 8);
    expect(out.coefficients[1].estimate).toBeCloseTo(fixture.slope, 8);
    expect(out.engine).toBe("js-ols");
  });
});
