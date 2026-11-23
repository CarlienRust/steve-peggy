const ROW_LEVEL_KEYS = ["rows", "participants", "records", "observations"];

export type ImportedResults = {
  schema: string;
  payload: Record<string, unknown>;
};

export function parseImportedResults(text: string): { ok: true; data: ImportedResults } | { ok: false; error: string } {
  const raw = text.trim();
  if (!raw) return { ok: false, error: "Paste JSON from export_for_peggy()." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Not valid JSON. Class D export is JSON, not a row CSV." };
  }
  if (Array.isArray(parsed)) {
    return { ok: false, error: "Refusing row-level table. Import a JSON object of aggregates only." };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "Expected a JSON object." };
  const obj = parsed as Record<string, unknown>;
  for (const key of ROW_LEVEL_KEYS) {
    const val = obj[key];
    if (Array.isArray(val) && val.length && Array.isArray(val[0])) {
      return { ok: false, error: "Refusing row-level table. Remove participant rows before import." };
    }
  }
  const schema = String(obj.schema || "");
  if (schema !== "column-aggregates-v1" && schema !== "ols-coefficients-v1") {
    return { ok: false, error: "schema must be column-aggregates-v1 or ols-coefficients-v1." };
  }
  return { ok: true, data: { schema, payload: obj } };
}
