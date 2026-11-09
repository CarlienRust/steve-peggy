import { toCsv } from "@/lib/csvGuard";
import type { ColumnKind } from "@/lib/columnStats";
import { formatSuppressedCount, type ColumnProfile } from "@/lib/columnStats";

export function dictionaryCsv(
  headers: string[],
  roles: Record<string, string>,
  types: Record<string, ColumnKind>,
  profiles: ColumnProfile[],
  threshold: number,
  adminCols: string[]
): string {
  const byName = new Map(profiles.map((p) => [p.name, p]));
  const cols = headers.filter((h) => !adminCols.includes(h));
  const rows = cols.map((h) => {
    const p = byName.get(h);
    const allowed =
      p?.kind === "categorical"
        ? (p.frequencies ?? [])
            .map((f) => `${f.value}:${formatSuppressedCount(f.count, threshold)}`)
            .join("; ")
        : "";
    return [h, roles[h] || "analysis", types[h] || p?.kind || "", p?.missingPercent ?? "", allowed];
  });
  return toCsv(["column", "role", "type", "missing_percent", "allowed_values"], rows);
}
