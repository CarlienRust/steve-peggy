/** Solo local dev: SQLite + local Qdrant + Ollama, no Supabase sign-in. */
export const SOLO_LOCAL = process.env.NEXT_PUBLIC_SOLO_LOCAL === "true";

export function isAuthOptional(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return SOLO_LOCAL || !url || !key;
}

export const SOLO_USER_ID = "dev-user";
