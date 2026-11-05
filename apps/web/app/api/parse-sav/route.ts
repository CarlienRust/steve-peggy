import { NextResponse } from "next/server";
import { readSav } from "@irbisadm/statfmt";

export const runtime = "nodejs";

const MAX_ROWS = 8000;
const MAX_BYTES = 40 * 1024 * 1024;

function cellString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value.trim();
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a SAV file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "SAV file is too large." }, { status: 413 });
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ds = readSav(bytes, { rowLimit: MAX_ROWS });
    const headers = (ds.variables ?? []).map((v) => v.name).filter(Boolean);
    const rows = (ds.rows ?? []).map((row) =>
      headers.map((_, i) => cellString(Array.isArray(row) ? row[i] : (row as Record<string, unknown>)[headers[i]]))
    );
    if (!headers.length || !rows.length) {
      return NextResponse.json({ error: "This SAV file has no variables or rows." }, { status: 400 });
    }
    const total = ds.metadata?.rowCount;
    const warning =
      typeof total === "number" && total > rows.length
        ? `Showing the first ${rows.length} of ${total} rows.`
        : undefined;
    return NextResponse.json({ headers, rows, warning });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read this SAV file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
