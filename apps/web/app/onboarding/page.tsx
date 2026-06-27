"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { createClient } from "@/lib/supabase/client";
import { peggyApi } from "@/lib/api";
import {
  formatDisplayName,
  normalizeResearchRole,
  normalizeTitle,
  profileFromMetadata,
  type ResearchRole,
  type TitleOption,
} from "@/lib/userProfile";
import { ProfileNameFields } from "@/components/ProfileNameFields";
import { ResearchRoleField } from "@/components/ResearchRoleField";

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isUpdate = searchParams.get("update") === "1";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState<TitleOption>("Dr");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [researchFocus, setResearchFocus] = useState("");
  const [researchRole, setResearchRole] = useState<ResearchRole>("Researcher");

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/login");
        return;
      }

      if (authData.user.email) setEmail(authData.user.email);

      try {
        const profile = await peggyApi.getProfile();
        if (!isUpdate) {
          await supabase.auth.updateUser({ data: { profile_complete: true } });
          router.replace("/projects");
          return;
        }
        setTitle(normalizeTitle(profile.title));
        setName(profile.name);
        setSurname(profile.surname);
        setResearchFocus(profile.research_focus ?? "");
        setResearchRole(normalizeResearchRole(profile.research_type));
        setLoading(false);
        return;
      } catch {
        if (isUpdate) {
          router.replace("/projects");
          return;
        }
      }

      const meta = profileFromMetadata(authData.user.user_metadata ?? {}, authData.user.email ?? "");
      if (meta.title) setTitle(normalizeTitle(meta.title));
      if (meta.name) setName(meta.name);
      if (meta.surname) setSurname(meta.surname);
      if (meta.research_focus) setResearchFocus(meta.research_focus);
      if (meta.research_type) setResearchRole(normalizeResearchRole(String(meta.research_type)));

      setLoading(false);
    };
    void init();
  }, [router, isUpdate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await peggyApi.upsertProfile({
        title: title.trim(),
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
        research_focus: researchFocus.trim(),
        research_type: researchRole,
      });

      const supabase = createClient();
      await supabase.auth.updateUser({ data: { profile_complete: true } });
      router.replace("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  const preview = formatDisplayName(title, name, surname);

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 3, bgcolor: "background.default" }}>
      <Paper sx={{ p: 4, maxWidth: 520, width: "100%" }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push("/projects")}
          sx={{ textTransform: "none", mb: 2, px: 0, minWidth: 0 }}
        >
          Back to welcome
        </Button>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          {isUpdate ? "Update your profile" : "Complete your profile"}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Your display name will appear as{" "}
          <Box component="span" sx={{ fontFamily: "monospace", color: "text.primary" }}>
            {preview || "Title_I_Surname"}
          </Box>
        </Typography>

        <Box component="form" onSubmit={onSubmit}>
          <Stack spacing={2}>
            <ProfileNameFields
              title={title}
              name={name}
              surname={surname}
              onTitleChange={setTitle}
              onNameChange={setName}
              onSurnameChange={setSurname}
            />
            <TextField label="Email" type="email" value={email} required fullWidth disabled />
            <ResearchRoleField value={researchRole} onChange={setResearchRole} />
            <TextField
              label="Research focus"
              value={researchFocus}
              onChange={(e) => setResearchFocus(e.target.value)}
              fullWidth
              required
            />

            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" disabled={saving} fullWidth>
              {saving ? "Saving…" : isUpdate ? "Save profile" : "Save & continue"}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
          <CircularProgress />
        </Box>
      }
    >
      <OnboardingForm />
    </Suspense>
  );
}
