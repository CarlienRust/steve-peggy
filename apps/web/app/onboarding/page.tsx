"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { createClient } from "@/lib/supabase/client";
import { peggyApi } from "@/lib/api";
import {
  formatDisplayName,
  normalizeResearchRole,
  normalizeTitle,
  profileFromMetadata,
  saveActiveWorkspaceId,
  type ResearchRole,
  type TitleOption,
} from "@/lib/userProfile";
import { ProfileNameFields } from "@/components/ProfileNameFields";
import { ResearchRoleField } from "@/components/ResearchRoleField";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState<TitleOption>("Dr");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [researchFocus, setResearchFocus] = useState("");
  const [researchRole, setResearchRole] = useState<ResearchRole>("Researcher");

  const [wsTitle, setWsTitle] = useState("");
  const [wsAim, setWsAim] = useState("");
  const [wsObjectives, setWsObjectives] = useState("");

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
        await peggyApi.getProfile();
        await supabase.auth.updateUser({ data: { profile_complete: true } });
        router.replace("/projects");
        return;
      } catch {
        /* no profile yet */
      }

      const meta = profileFromMetadata(authData.user.user_metadata ?? {}, authData.user.email ?? "");
      if (meta.title) setTitle(normalizeTitle(meta.title));
      if (meta.name) setName(meta.name);
      if (meta.surname) setSurname(meta.surname);
      if (meta.research_focus) setResearchFocus(meta.research_focus);
      if (meta.research_type) setResearchRole(normalizeResearchRole(String(meta.research_type)));
      if (meta.research_focus && !wsTitle) {
        setWsTitle(meta.research_focus.slice(0, 80));
      }

      setLoading(false);
    };
    void init();
  }, [router]);

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

      const objectives = wsObjectives
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const { count } = await peggyApi.listWorkspaces();
      let workspaceId: string | null = null;
      if (count === 0 && wsTitle.trim()) {
        const ws = await peggyApi.createWorkspace({
          title: wsTitle.trim(),
          aim: wsAim.trim(),
          objectives,
        });
        workspaceId = ws.id;
      }

      const supabase = createClient();
      await supabase.auth.updateUser({ data: { profile_complete: true } });
      if (workspaceId) {
        saveActiveWorkspaceId(workspaceId);
        router.replace("/");
      } else {
        router.replace("/projects");
      }
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
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Complete your profile
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

            <Typography variant="subtitle2" sx={{ pt: 2 }}>
              First research project (workspace)
            </Typography>
            <TextField
              label="Project title"
              value={wsTitle}
              onChange={(e) => setWsTitle(e.target.value)}
              fullWidth
              required
              placeholder="e.g. Microbiome & T2D systematic review"
            />
            <TextField
              label="Aim"
              value={wsAim}
              onChange={(e) => setWsAim(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              placeholder="Overall aim of this research project"
            />
            <TextField
              label="Objectives"
              value={wsObjectives}
              onChange={(e) => setWsObjectives(e.target.value)}
              fullWidth
              multiline
              minRows={3}
              placeholder="One objective per line"
              helperText="Enter each objective on a new line"
            />

            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" disabled={saving} fullWidth>
              {saving ? "Saving…" : "Save & continue"}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
