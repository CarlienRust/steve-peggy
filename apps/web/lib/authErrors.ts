/** User-facing message for Supabase auth network failures. */
export function authRequestErrorMessage(err: unknown): string {
  if (err instanceof TypeError && err.message === "Failed to fetch") {
    return (
      "Cannot reach Supabase. If the project is paused, restore it in the Supabase dashboard. " +
      "For local dev without sign-in, set NEXT_PUBLIC_SOLO_LOCAL=true in apps/web/.env.local instead."
    );
  }
  return err instanceof Error ? err.message : "Sign-in request failed.";
}
