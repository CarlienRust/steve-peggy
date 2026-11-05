import type { ParsedPastedTable } from "@/lib/parsePastedTable";

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
