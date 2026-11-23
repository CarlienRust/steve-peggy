import { describe, expect, it } from "vitest";
import { getAnalysisFunction, listAnalysisFunctions } from "@/lib/analysis/registry";

describe("registry", () => {
  it("loads dataset description and linear regression", () => {
    const ids = listAnalysisFunctions().map((f) => f.id);
    expect(ids).toContain("dataset-description");
    expect(ids).toContain("linear-regression");
    expect(ids).toContain("gut-microbiome-feature");
    expect(ids).toContain("genomics-snp-panel");
    expect(ids).toContain("ml-review");
    expect(getAnalysisFunction("dataset-description")?.status).toBe("stable");
    expect(getAnalysisFunction("linear-regression")?.steps.some((s) => s.id === "fit")).toBe(true);
  });
});
