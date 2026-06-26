"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from "@mui/material";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const authError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(authError ? "Sign-in failed. Try again." : null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setSent(true);
  };

  return (
    <Paper sx={{ p: 4, maxWidth: 420, width: "100%" }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Sign in to Peggy
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Email magic link — no password required.
          </Typography>
        </Box>

        {sent ? (
          <Alert severity="success">Check your email for the sign-in link.</Alert>
        ) : (
          <Box component="form" onSubmit={onSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                autoFocus
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" variant="contained" disabled={loading} fullWidth>
                {loading ? "Sending…" : "Send magic link"}
              </Button>
            </Stack>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary">
          Full corpus, chat, and ingest require the local stack (API on localhost:8000). The hosted site
          supports sign-in only until Milestone 2.
        </Typography>
      </Stack>
    </Paper>
  );
}

export default function LoginPage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default",
        p: 3,
      }}
    >
      <Suspense fallback={<CircularProgress />}>
        <LoginForm />
      </Suspense>
    </Box>
  );
}
