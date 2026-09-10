"use client";

import { Alert, Link, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { peggyApi, queryKeys } from "@/lib/api";

export function DataSafetyBanner() {
  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => peggyApi.health(),
    staleTime: 5 * 60_000,
  });
  const cloudLlm = health.data?.llm_provider && health.data.llm_provider !== "ollama";

  return (
    <Alert severity="warning" sx={{ mb: 3 }}>
      <Typography variant="body2" component="div">
        <strong>Data safety:</strong> Your corpus and study design are private to your account. Peggy does not publish
        your data or share it with other users.
      </Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        Do not enter patient names, medical record numbers, or other identifiable health information. Use aggregate or
        de-identified descriptions. Confirm ethics approval before uploading sensitive data.
      </Typography>
      {cloudLlm && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          AI guidance may be sent to a cloud LLM ({health.data?.llm_provider}). For sensitive planning, prefer a local
          Ollama stack — see{" "}
          <Link href="https://github.com/CarlienRust/steve-peggy/blob/main/docs/LOCAL.md" target="_blank" rel="noopener">
            LOCAL.md
          </Link>
          .
        </Typography>
      )}
    </Alert>
  );
}
