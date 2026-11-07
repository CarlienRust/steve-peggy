import type { ParsedPastedTable } from "@/lib/parsePastedTable";

export async function looksLikeSavFile(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (head.length < 4) return false;
  const ascii = String.fromCharCode(head[0], head[1], head[2], head[3]);
  if (ascii === "$FL2" || ascii === "$FL3") return true;
  return head[0] === 0x1f && head[1] === 0x8b;
}

export function datasetFileName(paper: { original_filename?: string | null; title?: string | null }, file: File): string {
  return paper.original_filename || file.name || paper.title || "dataset";
}

export async function parseSavTable(file: File): Promise<ParsedPastedTable | { error: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/parse-sav", { method: "POST", body: form });
  const data = (await res.json()) as ParsedPastedTable & { error?: string };
  if (!res.ok || data.error) {
    return { error: data.error || "Could not read this SAV file." };
  }
  if (!data.headers?.length || !data.rows?.length) {
    return { error: "This SAV file has no variables or rows." };
  }
  return { headers: data.headers, rows: data.rows, warning: data.warning };
}
