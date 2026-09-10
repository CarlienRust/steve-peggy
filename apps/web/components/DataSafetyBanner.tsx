"use client";

import { useState } from "react";
import { Alert, Button, Collapse, Link, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { peggyApi, queryKeys } from "@/lib/api";

export function DataSafetyBanner() {
  const [open, setOpen] = useState(false);
  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => peggyApi.health(),
    staleTime: 5 * 60_000,
  });
  const cloudLlm = health.data?.llm_provider && health.data.llm_provider !== "ollama";

  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      <Typography variant="body2">
        Private to your account. Do not enter patient identifiers.
        <Button size="small" onClick={() => setOpen((v) => !v)} sx={{ ml: 1, minWidth: 0, p: 0, verticalAlign: "baseline" }}>
          {open ? "Less" : "Details"}
        </Button>
      </Typography>
      <Collapse in={open}>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Use de-identified descriptions only. Confirm ethics approval before uploading sensitive data.
          {cloudLlm && (
            <>
              {" "}
              Cloud LLM ({health.data?.llm_provider}) — prefer local Ollama for sensitive planning (
              <Link href="https://github.com/CarlienRust/steve-peggy/blob/main/docs/LOCAL.md" target="_blank" rel="noopener">
                LOCAL.md
              </Link>
              ).
            </>
          )}
        </Typography>
      </Collapse>
    </Alert>
  );
}
