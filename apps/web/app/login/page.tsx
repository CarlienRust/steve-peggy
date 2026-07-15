"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { createClient } from "@/lib/supabase/client";
import { AuthPageLayout, AuthPaper } from "@/components/AuthPageLayout";
import { PeggyBrandLockup } from "@/components/PeggyBrandLockup";
import { type ResearchRole, type TitleOption } from "@/lib/userProfile";
import { ProfileNameFields } from "@/components/ProfileNameFields";
import { ResearchRoleField } from "@/components/ResearchRoleField";

type SignInMethod = "password" | "magic";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const authError = searchParams.get("error");
  const [tab, setTab] = useState(0);
  const [signInMethod, setSignInMethod] = useState<SignInMethod>("password");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [title, setTitle] = useState<TitleOption>("Dr");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [researchFocus, setResearchFocus] = useState("");
  const [researchRole, setResearchRole] = useState<ResearchRole>("Researcher");

  const [sent, setSent] = useState(false);
  const [sentMagicLink, setSentMagicLink] = useState(false);
  const [error, setError] = useState<string | null>(authError ? "Sign-in failed. Try again." : null);
  const [loading, setLoading] = useState(false);

  const redirectAfterAuth = () => {
    router.push(tab === 1 ? "/" : next);
    router.refresh();
  };

  const sendMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(tab === 1 ? "/" : next)}`;

    const options: { emailRedirectTo: string; data?: Record<string, string> } = {
      emailRedirectTo: redirectTo,
    };

    if (tab === 1) {
      options.data = {
        title: title.trim(),
        name: name.trim(),
        surname: surname.trim(),
        research_focus: researchFocus.trim(),
        research_type: researchRole,
      };
    }

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setSent(true);
    setSentMagicLink(true);
  };

  const signInWithPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    redirectAfterAuth();
  };

  const registerWithPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!name.trim() || !surname.trim() || !researchFocus.trim()) {
      setError("Please complete all profile fields.");
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/")}`;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          title: title.trim(),
          name: name.trim(),
          surname: surname.trim(),
          research_focus: researchFocus.trim(),
          research_type: researchRole,
        },
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      redirectAfterAuth();
      return;
    }
    setSent(true);
  };

  const handleSubmit = (e: FormEvent) => {
    if (tab === 1) {
      void registerWithPassword(e);
      return;
    }
    if (signInMethod === "password") {
      void signInWithPassword(e);
      return;
    }
    void sendMagicLink(e);
  };

  const handleTabChange = (_: unknown, value: number) => {
    setTab(value);
    setSent(false);
    setSentMagicLink(false);
    setError(null);
    setPassword("");
    setConfirmPassword("");
  };

  const submitLabel =
    tab === 1
      ? loading
        ? "Creating account…"
        : "Create account"
      : signInMethod === "password"
        ? loading
          ? "Signing in…"
          : "Sign in"
        : loading
          ? "Sending…"
          : "Send sign-in link";

  return (
    <AuthPaper>
      <Stack spacing={3}>
        <PeggyBrandLockup variant="auth" centered showSubtitle />

        <Tabs value={tab} onChange={handleTabChange} variant="fullWidth">
          <Tab label="Sign in" />
          <Tab label="Register" />
        </Tabs>

        {sent ? (
          <Alert severity="success">
            {tab === 1 ? (
              <>
                Account created. Check your email to confirm, then sign in with your password. If email confirmation
                is disabled in Supabase, try signing in now.
              </>
            ) : sentMagicLink ? (
              <>
                Check your email for the magic link. The link opens this same site ({typeof window !== "undefined" ? window.location.host : "localhost"}) — if it sends you to production, use password sign-in for local dev or add{" "}
                <Box component="span" sx={{ fontFamily: "monospace" }}>
                  http://localhost:3000/auth/callback
                </Box>{" "}
                to Supabase redirect URLs.
              </>
            ) : null}
          </Alert>
        ) : (
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              {tab === 0 && (
                <>
                  <ToggleButtonGroup
                    value={signInMethod}
                    exclusive
                    fullWidth
                    size="small"
                    onChange={(_, value: SignInMethod | null) => {
                      if (value) {
                        setSignInMethod(value);
                        setError(null);
                      }
                    }}
                  >
                    <ToggleButton value="password" sx={{ textTransform: "none" }}>
                      Password
                    </ToggleButton>
                    <ToggleButton value="magic" sx={{ textTransform: "none" }}>
                      Magic link
                    </ToggleButton>
                  </ToggleButtonGroup>
                  {signInMethod === "password" && (
                    <Typography variant="caption" color="text.secondary">
                      Recommended for local development — no email redirect required.
                    </Typography>
                  )}
                </>
              )}

              {tab === 1 && (
                <>
                  <ProfileNameFields
                    title={title}
                    name={name}
                    surname={surname}
                    onTitleChange={setTitle}
                    onNameChange={setName}
                    onSurnameChange={setSurname}
                  />
                  <ResearchRoleField value={researchRole} onChange={setResearchRole} />
                  <TextField
                    id="register-research-focus"
                    name="research_focus"
                    label="Research focus"
                    value={researchFocus}
                    onChange={(e) => setResearchFocus(e.target.value)}
                    fullWidth
                    required
                    placeholder="e.g. Gut microbiome and type-2 diabetes"
                  />
                </>
              )}

              <TextField
                id="login-email"
                name="email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                autoComplete="email"
                autoFocus={tab === 0}
              />

              {(tab === 1 || signInMethod === "password") && (
                <TextField
                  id="login-password"
                  name="password"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                  autoComplete={tab === 1 ? "new-password" : "current-password"}
                  helperText={tab === 1 ? "At least 6 characters" : undefined}
                />
              )}

              {tab === 0 && signInMethod === "password" && (
                <Button
                  component={Link}
                  href="/login/forgot-password"
                  size="small"
                  sx={{ textTransform: "none", alignSelf: "flex-start", px: 0, minWidth: 0, mt: -1 }}
                >
                  Forgot password?
                </Button>
              )}

              {tab === 1 && (
                <TextField
                  id="login-confirm-password"
                  name="confirm_password"
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  fullWidth
                  autoComplete="new-password"
                />
              )}

              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" variant="contained" disabled={loading} fullWidth>
                {submitLabel}
              </Button>
            </Stack>
          </Box>
        )}
      </Stack>
    </AuthPaper>
  );
}

export default function LoginPage() {
  return (
    <AuthPageLayout>
      <LoginForm />
    </AuthPageLayout>
  );
}
