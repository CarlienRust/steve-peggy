"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
} from "@mui/material";
import { createClient } from "@/lib/supabase/client";
import { PeggyBrandLockup } from "@/components/PeggyBrandLockup";
import { type ResearchRole, type TitleOption } from "@/lib/userProfile";
import { ProfileNameFields } from "@/components/ProfileNameFields";
import { ResearchRoleField } from "@/components/ResearchRoleField";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const authError = searchParams.get("error");
  const [tab, setTab] = useState(0);

  const [email, setEmail] = useState("");
  const [title, setTitle] = useState<TitleOption>("Dr");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [researchFocus, setResearchFocus] = useState("");
  const [researchRole, setResearchRole] = useState<ResearchRole>("Researcher");

  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(authError ? "Sign-in failed. Try again." : null);
  const [loading, setLoading] = useState(false);

  const sendMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(tab === 1 ? "/onboarding" : next)}`;

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
  };

  return (
    <Paper sx={{ p: 4, maxWidth: 480, width: "100%" }}>
      <Stack spacing={3}>
        <PeggyBrandLockup variant="auth" centered showSubtitle />

        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
          <Tab label="Sign in" />
          <Tab label="Register" />
        </Tabs>

        {sent ? (
          <Alert severity="success">
            Check your email for the magic link. After confirming, you&apos;ll complete your profile and first
            workspace.
          </Alert>
        ) : (
          <Box component="form" onSubmit={sendMagicLink}>
            <Stack spacing={2}>
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
                    label="Research focus"
                    value={researchFocus}
                    onChange={(e) => setResearchFocus(e.target.value)}
                    fullWidth
                    placeholder="e.g. Gut microbiome and type-2 diabetes"
                  />
                </>
              )}
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                autoFocus={tab === 0}
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" variant="contained" disabled={loading} fullWidth>
                {loading ? "Sending…" : tab === 0 ? "Send sign-in link" : "Register & send link"}
              </Button>
            </Stack>
          </Box>
        )}
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
