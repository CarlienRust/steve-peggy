"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Suspense, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { formatApiError, peggyApi } from "@/lib/api";
import {
  formatDisplayName,
  normalizeResearchRole,
  normalizeTitle,
  profileFromMetadata,
} from "@/lib/userProfile";
import { profileFormSchema, type ProfileFormValues } from "@/lib/schemas/profile";
import { ProfileNameFields } from "@/components/ProfileNameFields";
import { ResearchRoleField } from "@/components/ResearchRoleField";

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isUpdate = searchParams.get("update") === "1";

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      title: "Dr",
      name: "",
      surname: "",
      research_focus: "",
      research_type: "Researcher",
    },
  });

  const watched = watch();

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
        reset({
          title: normalizeTitle(profile.title),
          name: profile.name,
          surname: profile.surname,
          research_focus: profile.research_focus ?? "",
          research_type: normalizeResearchRole(profile.research_type),
        });
        setLoading(false);
        return;
      } catch {
        if (isUpdate) {
          router.replace("/projects");
          return;
        }
      }

      const meta = profileFromMetadata(authData.user.user_metadata ?? {}, authData.user.email ?? "");
      reset({
        title: meta.title ? normalizeTitle(meta.title) : "Dr",
        name: meta.name ?? "",
        surname: meta.surname ?? "",
        research_focus: meta.research_focus ?? "",
        research_type: meta.research_type ? normalizeResearchRole(String(meta.research_type)) : "Researcher",
      });

      setLoading(false);
    };
    void init();
  }, [router, isUpdate, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await peggyApi.upsertProfile({
        title: values.title,
        name: values.name,
        surname: values.surname,
        email: email.trim(),
        research_focus: values.research_focus,
        research_type: values.research_type,
      });

      const supabase = createClient();
      await supabase.auth.updateUser({ data: { profile_complete: true } });
      router.replace("/projects");
    } catch (err) {
      setSubmitError(formatApiError(err));
    }
  });

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  const preview = formatDisplayName(watched.title, watched.name, watched.surname);

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
            <ProfileNameFields control={control} titleName="title" nameName="name" surnameName="surname" />
            <TextField label="Email" type="email" value={email} required fullWidth disabled />
            <ResearchRoleField control={control} name="research_type" />
            <Controller
              name="research_focus"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Research focus"
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  fullWidth
                />
              )}
            />

            {submitError && <Alert severity="error">{submitError}</Alert>}
            <Button type="submit" variant="contained" disabled={isSubmitting} fullWidth>
              {isSubmitting ? "Saving…" : isUpdate ? "Save profile" : "Save & continue"}
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
