"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import { createClient } from "@/lib/supabase/client";
import { AuthPageLayout, AuthPaper } from "@/components/AuthPageLayout";
import { PeggyBrandLockup } from "@/components/PeggyBrandLockup";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setReady(true);
    };
    void checkSession();
  }, []);

  const updatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push("/");
    router.refresh();
  };

  if (!ready) {
    return (
      <AuthPageLayout>
        <CircularProgress />
      </AuthPageLayout>
    );
  }

  if (!hasSession) {
    return (
      <AuthPageLayout>
        <AuthPaper>
          <Stack spacing={2}>
            <PeggyBrandLockup variant="auth" centered showSubtitle />
            <Alert severity="error">
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </Alert>
            <Button component={Link} href="/login/forgot-password" variant="contained" sx={{ textTransform: "none" }}>
              Request new reset link
            </Button>
          </Stack>
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
            Choose a new password
          </Typography>
          <Box component="form" onSubmit={updatePassword}>
            <Stack spacing={2}>
              <TextField
                id="new-password"
                name="password"
                label="New password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                autoComplete="new-password"
                autoFocus
                helperText="At least 6 characters"
              />
              <TextField
                id="confirm-new-password"
                name="confirm_password"
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                fullWidth
                autoComplete="new-password"
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" variant="contained" disabled={loading} fullWidth>
                {loading ? "Saving…" : "Update password & continue"}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </AuthPaper>
    </AuthPageLayout>
  );
}
