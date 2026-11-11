"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { createClient } from "@/lib/supabase/client";
import { isAuthOptional } from "@/lib/localMode";

type Factor = { id: string; friendly_name?: string; status?: string };

export function MfaSettingsBlock() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (isAuthOptional()) return;
    const supabase = createClient();
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(listError.message);
      return;
    }
    setFactors((data?.totp ?? []) as Factor[]);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (isAuthOptional()) return null;

  const startEnroll = async () => {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (enrollError) {
        setError(enrollError.message);
        return;
      }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start authenticator setup");
    } finally {
      setBusy(false);
    }
  };

  const verifyEnroll = async () => {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) {
        setError(challengeError?.message ?? "Challenge failed");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }
      setQr(null);
      setFactorId(null);
      setCode("");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const unenroll = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (unenrollError) {
        setError(unenrollError.message);
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Security</Typography>
      <Typography variant="body2" color="text.secondary">
        Optional authenticator app. If you enroll, password and magic-link sign-in will ask for a code.
      </Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {factors.map((factor) => (
        <Stack key={factor.id} direction="row" spacing={1} alignItems="center">
          <Typography variant="body2">Authenticator {factor.status === "verified" ? "on" : factor.status}</Typography>
          <Button size="small" onClick={() => void unenroll(factor.id)} disabled={busy} sx={{ textTransform: "none" }}>
            Remove
          </Button>
        </Stack>
      ))}
      {qr ? (
        <Stack spacing={1}>
          <Box component="img" src={qr} alt="Authenticator QR code" sx={{ width: 180, height: 180 }} />
          <TextField
            label="Authenticator code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            size="small"
            autoComplete="one-time-code"
          />
          <Button variant="contained" onClick={() => void verifyEnroll()} disabled={busy || code.trim().length < 6} sx={{ textTransform: "none" }}>
            Confirm authenticator
          </Button>
        </Stack>
      ) : (
        <Button variant="outlined" onClick={() => void startEnroll()} disabled={busy} sx={{ textTransform: "none", alignSelf: "flex-start" }}>
          Add authenticator app
        </Button>
      )}
    </Stack>
  );
}
