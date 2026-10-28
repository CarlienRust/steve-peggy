import type { SourceCitation } from "@/lib/api";

/** Map gap evidence to the sources from the same scan run. */
export function sourcesForGap(gap: Record<string, unknown>, all: SourceCitation[]): SourceCitation[] {
  const evidence = String(gap.evidence_for ?? "");
  if (!evidence.trim() || all.length === 0) return all;

  const refIds = new Set<string>();
  for (const m of evidence.matchAll(/abstract:(\d+)/g)) refIds.add(m[1]);
  for (const m of evidence.matchAll(/chunk[_\s-]?id[:\s]+([\w:-]+)/gi)) refIds.add(m[1]);

  if (refIds.size > 0) {
    const matched = all.filter((s) => {
      const tail = s.chunk_id.startsWith("abstract:") ? s.chunk_id.split(":")[1] : "";
      return refIds.has(s.chunk_id) || (s.pmid && refIds.has(s.pmid)) || (tail && refIds.has(tail));
    });
    if (matched.length) return matched;
  }

  const topic = String(gap.topic ?? "").toLowerCase();
  if (topic) {
    const byTitle = all.filter((s) => s.title.toLowerCase().includes(topic));
    if (byTitle.length) return byTitle;
  }
  return all;
}

export function objectiveDraftFromGap(gap: Record<string, unknown>): string {
  const topic = String(gap.topic ?? "").trim();
  const study = String(gap.suggested_study ?? "").trim();
  if (topic && study) return `${topic}: ${study}`;
  return topic || study || "Address identified literature gap";
}
