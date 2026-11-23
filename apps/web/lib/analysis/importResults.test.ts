import { describe, expect, it } from "vitest";
import { parseImportedResults } from "@/lib/analysis/importResults";

describe("parseImportedResults", () => {
  it("accepts ols JSON", () => {
    const out = parseImportedResults(JSON.stringify({ schema: "ols-coefficients-v1", n: 10, coefficients: [] }));
    expect(out.ok).toBe(true);
  });

  it("refuses row-level tables", () => {
    const out = parseImportedResults(JSON.stringify({ schema: "ols-coefficients-v1", rows: [["a", "b"], ["1", "2"]] }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.toLowerCase()).toContain("row-level");
  });
});
