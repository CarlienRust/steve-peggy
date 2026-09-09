"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { createClient } from "@/lib/supabase/client";
import { isAuthOptional } from "@/lib/localMode";
import { authRequestErrorMessage } from "@/lib/authErrors";
import { AuthPageLayout, AuthPaper } from "@/components/AuthPageLayout";
import { PeggyBrandLockup } from "@/components/PeggyBrandLockup";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthOptional()) {
      router.replace("/");
    }
  }, [router]);

  const sendResetLink = async (e: FormEvent) => {
    e.preventDefault();
    if (isAuthOptional()) {
      setError("Supabase is not configured. Solo local mode does not use password reset.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      setLoading(false);
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } catch (err) {
      setLoading(false);
      setError(authRequestErrorMessage(err));
    }
  };

  if (isAuthOptional()) {
    return (
      <AuthPageLayout>
        <AuthPaper>
          <Alert severity="info">Solo local mode — no sign-in or password reset needed.</Alert>
        </AuthPaper>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <AuthPaper>
        <Stack spacing={3}>
          <PeggyBrandLockup variant="auth" centered showSubtitle />

          <Typography variant="h6" fontWeight={600} textAlign="center">
            Reset password
          </Typography>

          {sent ? (
            <Alert severity="success">
              If an account exists for that email, we sent a reset link. Open it on this device — the link returns to{" "}
              <Box component="span" sx={{ fontFamily: "monospace" }}>
                {typeof window !== "undefined" ? window.location.host : "this site"}
              </Box>
              . Add <Box component="span" sx={{ fontFamily: "monospace" }}>http://localhost:3000/auth/callback</Box> to
              Supabase redirect URLs for local dev.
            </Alert>
          ) : (
            <Box component="form" onSubmit={sendResetLink}>
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Enter your email and we&apos;ll send a link to choose a new password.
                </Typography>
                <TextField
                  id="forgot-email"
                  name="email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                  autoComplete="email"
                  autoFocus
                />
                {error && <Alert severity="error">{error}</Alert>}
                <Button type="submit" variant="contained" disabled={loading} fullWidth>
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
              </Stack>
            </Box>
          )}

          <Button
            component={Link}
            href="/login"
            startIcon={<ArrowBackIcon />}
            sx={{ textTransform: "none", alignSelf: "flex-start", px: 0, minWidth: 0 }}
          >
            Back to sign in
          </Button>
        </Stack>
      </AuthPaper>
    </AuthPageLayout>
  );
}
