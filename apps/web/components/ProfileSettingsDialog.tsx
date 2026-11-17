"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { formatApiError, peggyApi, queryKeys } from "@/lib/api";
import { profileFormSchema, type ProfileFormValues } from "@/lib/schemas/profile";
import { ProfileNameFields } from "@/components/ProfileNameFields";
import { ResearchRoleField } from "@/components/ResearchRoleField";
import { formatDisplayName, normalizeResearchRole, normalizeTitle } from "@/lib/userProfile";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/lib/authContext";

export function ProfileSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userId } = useAuthSession();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, reset, watch, formState } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      title: "Dr",
      name: "",
      surname: "",
      research_focus: "",
      research_type: "Researcher",
      orcid: "",
    },
  });
  const watched = watch();
  const preview = formatDisplayName(watched.title, watched.name, watched.surname);

  useEffect(() => {
    if (!open) return;
    setLoadError(null);
    setSubmitError(null);
    void (async () => {
      try {
        const profile = await peggyApi.getProfile();
        setEmail(profile.email ?? "");
        reset({
          title: normalizeTitle(profile.title),
          name: profile.name,
          surname: profile.surname,
          research_focus: profile.research_focus ?? "",
          research_type: normalizeResearchRole(profile.research_type),
          orcid: profile.orcid ?? "",
        });
      } catch (e) {
        setLoadError(formatApiError(e));
      }
    })();
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await peggyApi.upsertProfile({
        title: values.title,
        name: values.name,
        surname: values.surname,
        email,
        research_focus: values.research_focus,
        research_type: values.research_type,
        orcid: values.orcid,
      });
      if (userId) void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      onClose();
    } catch (e) {
      setSubmitError(formatApiError(e));
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Update profile</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }} component="form" id="profile-settings-form" onSubmit={onSubmit}>
          <Typography variant="body2" color="text.secondary">
            Display name: {preview || "Title_I_Surname"}
          </Typography>
          {loadError ? <Alert severity="error">{loadError}</Alert> : null}
          <ProfileNameFields control={control} titleName="title" nameName="name" surnameName="surname" />
          <TextField label="Email" type="email" value={email} disabled fullWidth size="small" />
          <ResearchRoleField control={control} name="research_type" />
          <Controller
            name="research_focus"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Research focus"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                fullWidth
                size="small"
              />
            )}
          />
          <Controller
            name="orcid"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="ORCID iD (optional)"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                fullWidth
                size="small"
              />
            )}
          />
          {submitError ? <Alert severity="error">{submitError}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Close
        </Button>
        <Button
          type="submit"
          form="profile-settings-form"
          variant="contained"
          disabled={formState.isSubmitting}
          sx={{ textTransform: "none" }}
        >
          {formState.isSubmitting ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
