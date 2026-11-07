"use client";

import { Alert } from "@mui/material";
import { isAuthOptional } from "@/lib/localMode";

export function LocalDevBanner() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const isProd = process.env.NODE_ENV === "production";

  if (isAuthOptional()) {
    return (
      <Alert severity="success" sx={{ mb: 2 }}>
        <strong>Solo local mode.</strong> Data stays on this machine (SQLite + local Qdrant + Ollama). No sign-in
        required.
      </Alert>
    );
  }

  const isLocalApi = apiUrl.includes("localhost") || apiUrl.startsWith("http://127.0.0.1");
  const onProdHost = isProd && !isLocalApi;

  if (onProdHost) {
    return null;
  }

  if (isLocalApi && !isProd) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Local stack — API at {apiUrl}. Run <code>./scripts/check-local.sh</code> if something fails.
      </Alert>
    );
  }

  return null;
}
