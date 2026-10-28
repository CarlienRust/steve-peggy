/** Turn API / saved LLM JSON into a flat object WorkflowResults can render. */

function tryParseJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function coerceString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim()))
      .filter(Boolean)
      .join("\n");
  }
  if (value == null) return "";
  return String(value).trim();
}

const TEXT_KEYS = [
  "full_text",
  "title",
  "summary",
  "background",
  "methods",
  "analysis",
  "sample_size",
  "timeline",
  "ethics_note",
  "introduction",
  "results",
  "conclusion",
  "design",
  "sample_size_note",
  "power_or_sample_note",
] as const;

function flattenStrings(b: Record<string, unknown>): Record<string, unknown> {
  const out = { ...b };
  for (const key of TEXT_KEYS) {
    if (key in out) out[key] = coerceString(out[key]);
  }
  if (Array.isArray(out.aims)) {
    out.aims = out.aims.map((a) => coerceString(a)).filter(Boolean);
  }
  return out;
}

export function normalizeWorkflowBody(
  input: Record<string, unknown> | string | null | undefined
): Record<string, unknown> | undefined {
  if (input == null) return undefined;
  let b: Record<string, unknown>;
  if (typeof input === "string") {
    const parsed = tryParseJson(input);
    b = parsed ?? { full_text: input.trim() };
  } else {
    b = { ...input };
  }

  const nested = b.body;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    b = { ...b, ...(nested as Record<string, unknown>) };
    delete b.body;
  }

  const raw = b.raw;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = tryParseJson(raw);
    if (parsed) {
      b = { ...b, ...parsed };
    } else if (!coerceString(b.full_text)) {
      b.full_text = raw.trim();
    }
    delete b.raw;
  }

  return flattenStrings(b);
}

export function hasProposalSections(body: Record<string, unknown>): boolean {
  const full = typeof body.full_text === "string" ? body.full_text.trim() : "";
  if (full) return true;
  if (typeof body.title === "string" && body.title.trim()) return true;
  if (Array.isArray(body.aims) && body.aims.length > 0) return true;
  for (const key of ["summary", "background", "methods", "analysis", "sample_size", "timeline", "ethics_note"]) {
    if (typeof body[key] === "string" && (body[key] as string).trim()) return true;
  }
  return false;
}

export function hasAbstractSections(body: Record<string, unknown>): boolean {
  const full = typeof body.full_text === "string" ? body.full_text.trim() : "";
  if (full) return true;
  for (const key of ["introduction", "methods", "results", "conclusion"]) {
    if (typeof body[key] === "string" && (body[key] as string).trim()) return true;
  }
  return false;
}
