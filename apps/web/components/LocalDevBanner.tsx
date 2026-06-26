"use client";

import { Alert, Link as MuiLink } from "@mui/material";

export function LocalDevBanner() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const isProd = process.env.NODE_ENV === "production";
  const needsLocal =
    isProd && (!apiUrl || apiUrl.includes("localhost") || apiUrl.startsWith("http://127.0.0.1"));

  if (!needsLocal) return null;

  return (
    <Alert severity="info" sx={{ mb: 2 }}>
      Full Peggy features (corpus, chat, ingest) require running locally. See{" "}
      <MuiLink href="https://github.com/carlienrust/steve-peggy/blob/main/docs/LOCAL.md" target="_blank" rel="noopener">
        LOCAL.md
      </MuiLink>{" "}
      — this Vercel deployment supports sign-in only (Milestone 1).
    </Alert>
  );
}
