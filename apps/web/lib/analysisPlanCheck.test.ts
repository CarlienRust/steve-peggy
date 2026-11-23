import { describe, expect, it } from "vitest";
import { missingVsPlan } from "@/lib/analysisPlanCheck";

describe("missingVsPlan", () => {
  it("names the plan step id when a covariate is missing", () => {
    const out = missingVsPlan(
      ["age"],
      "",
      [{ covariate: "sex", papers: 3 }],
      6,
      [{ id: "step-1", title: "Adjust for sex" }]
    );
    expect(out[0]).toContain("step-1");
  });
});
