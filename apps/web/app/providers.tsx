"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { ReactNode, useMemo, useState } from "react";
import { createPeggyTheme } from "@/theme/peggyTheme";
import { AuthSessionBridge } from "@/lib/authContext";

export function Providers({ children }: { children: ReactNode }) {
  const theme = useMemo(() => createPeggyTheme(), []);
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, gcTime: 300_000, retry: 2 },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthSessionBridge>{children}</AuthSessionBridge>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
