"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { createPeggyTheme } from "@/theme/peggyTheme";
import { createClient } from "@/lib/supabase/client";
import { setAccessTokenProvider } from "@/lib/api";

function AuthTokenBridge() {
  useEffect(() => {
    const supabase = createClient();
    setAccessTokenProvider(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    });
  }, []);
  return null;
}

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
        <AuthTokenBridge />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
