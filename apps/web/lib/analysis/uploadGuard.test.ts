import { describe, expect, it } from "vitest";
import { blockedUploadReason, clipTable } from "@/lib/analysis/uploadGuard";

describe("uploadGuard", () => {
  it("blocks reads and genotypes", () => {
    expect(blockedUploadReason("run.fastq.gz")).toBeTruthy();
    expect(blockedUploadReason("x.vcf")).toBeTruthy();
    expect(blockedUploadReason("g.bed")).toBeTruthy();
    expect(blockedUploadReason("table.csv")).toBeNull();
  });

  it("clips oversized tables", () => {
    const headers = Array.from({ length: 3 }, (_, i) => `c${i}`);
    const rows = Array.from({ length: 2 }, () => ["1", "2", "3"]);
    const clipped = clipTable(headers, rows);
    expect(clipped.rows.length).toBe(2);
  });
});
