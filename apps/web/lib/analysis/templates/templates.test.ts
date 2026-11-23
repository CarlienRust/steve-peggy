import { describe, expect, it } from "vitest";
import { descriptivePython, descriptiveR, descriptiveSpss } from "@/lib/analysis/templates/descriptive";
import { jobScript, stageScript } from "@/lib/analysis/templates/scheduler";
import { microbiomePython, dietPython, exposomePython, omicsPython } from "@/lib/analysis/templates/domainScripts";
import { PROJECT_GITIGNORE } from "@/lib/analysis/projectZip";
import { DEFAULT_COMPUTE_PROFILE } from "@/lib/analysis/types";

const ctx = {
  headers: ["age", "id"],
  roles: { age: "analysis", id: "admin" },
  adminColumns: ["id"],
  cellThreshold: 5,
  covariates: ["sex"],
  planSteps: ["Describe cohort"],
  seed: 1,
  dataPath: "data/your-file.csv",
};

describe("script templates", () => {
  it("python and r export_for_peggy and omit admin columns", () => {
    const py = descriptivePython(ctx);
    const r = descriptiveR(ctx);
    expect(py).toContain("export_for_peggy");
    expect(r).toContain("export_for_peggy");
    expect(py).toContain("Refusing row-level");
    expect(py).not.toContain('"id"');
    expect(py).toContain("age");
    expect(descriptiveSpss(ctx)).toContain("FREQUENCIES");
  });

  it("gitignore blocks row-level patterns", () => {
    expect(PROJECT_GITIGNORE).toContain("*.fastq");
    expect(PROJECT_GITIGNORE).toContain("*.sav");
    expect(PROJECT_GITIGNORE).toContain("*.vcf");
    expect(PROJECT_GITIGNORE).toContain("data/*.csv");
  });

  it("job scripts use profile fields only", () => {
    const slurm = jobScript({ ...DEFAULT_COMPUTE_PROFILE, scheduler: "slurm", queue: "testq", walltime: "01:00:00", memoryGb: "8" }, "job");
    expect(slurm).toContain("testq");
    expect(slurm).toContain("01:00:00");
    expect(slurm).toContain("--mem=8G");
    const empty = jobScript({ ...DEFAULT_COMPUTE_PROFILE, scheduler: "slurm" });
    expect(empty).toContain("Peggy does not guess");
    expect(stageScript(DEFAULT_COMPUTE_PROFILE)).toContain("Stage script");
  });

  it("microbiome script names QIIME 2 and export_for_peggy", () => {
    const py = microbiomePython(ctx);
    expect(py).toContain("QIIME 2");
    expect(py).toContain("export_for_peggy");
  });

  it("diet exposome omics templates refuse row-level export", () => {
    expect(dietPython(ctx)).toContain("export_for_peggy");
    expect(exposomePython(ctx)).toContain("Refusing row-level");
    expect(omicsPython(ctx)).toContain("export_for_peggy");
  });
});
