import { describe, expect, it } from "vitest";
import { runSuggestedTest } from "@/lib/analysisRun";

describe("runSuggestedTest", () => {
  it("labels p as approximate for Welch t", () => {
    const out = runSuggestedTest(
      { test: "Independent samples t-test", why: "" },
      ["1", "2", "3", "4"],
      ["a", "a", "b", "b"]
    );
    expect(out.pApprox).toBeDefined();
    expect(out.summary.toLowerCase()).toContain("approx");
  });
});
