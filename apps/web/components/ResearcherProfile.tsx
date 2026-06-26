"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { eyebrowSx, monoSx } from "@/theme/peggyTheme";
import { createClient } from "@/lib/supabase/client";
import { peggyApi, queryKeys } from "@/lib/api";
import {
  RESEARCH_TYPES,
  formatDisplayName,
  type ResearchType,
  type ResearcherProfile,
} from "@/lib/userProfile";

export function ResearcherProfile() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => peggyApi.getProfile(),
    retry: false,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<ResearcherProfile>>({});

  const saveMutation = useMutation({
    mutationFn: () =>
      peggyApi.upsertProfile({
        title: draft.title ?? "",
        name: draft.name ?? "",
        surname: draft.surname ?? "",
        email: draft.email ?? "",
        research_focus: draft.research_focus ?? "",
        research_type: draft.research_type ?? "Researcher",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      setEditOpen(false);
    },
  });

  const openEdit = () => {
    if (profile) {
      setDraft({
        ...profile,
        research_type: profile.research_type as ResearchType,
      });
    }
    setEditOpen(true);
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const displayName = profile?.display_name ?? "Researcher";
  const preview = formatDisplayName(draft.title ?? "", draft.name ?? "", draft.surname ?? "");

  return (
    <>
      <Box sx={{ mt: "auto", pt: 3, borderTop: 1, borderColor: "divider" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={eyebrowSx} noWrap>
              {isLoading ? "…" : displayName}
            </Typography>
            {profile && (
              <>
                <Typography sx={{ ...monoSx, fontSize: 11, mt: 0.5, color: "text.secondary" }}>
                  {profile.research_type}
                </Typography>
                <Typography sx={{ fontSize: 10, color: "text.secondary", mt: 0.5 }} noWrap>
                  {profile.email}
                </Typography>
                {profile.research_focus && (
                  <Typography sx={{ fontSize: 10, color: "text.secondary", mt: 0.5 }} noWrap>
                    {profile.research_focus}
                  </Typography>
                )}
              </>
            )}
          </Box>
          {profile && (
            <Button size="small" onClick={openEdit} sx={{ minWidth: 0, p: 0.5 }} aria-label="Edit profile">
              <EditOutlinedIcon fontSize="small" />
            </Button>
          )}
        </Stack>
        <Button
          fullWidth
          size="small"
          variant="outlined"
          startIcon={<LogoutIcon fontSize="small" />}
          onClick={logout}
          sx={{ mt: 2, textTransform: "none", fontSize: "0.8125rem" }}
        >
          Log out
        </Button>
      </Box>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit profile</DialogTitle>
        <Box
          component="form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Title"
                  value={draft.title ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  sx={{ width: 90 }}
                />
                <TextField
                  label="Name"
                  value={draft.name ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  required
                  fullWidth
                />
                <TextField
                  label="Surname"
                  value={draft.surname ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, surname: e.target.value }))}
                  required
                  fullWidth
                />
              </Stack>
              <TextField label="Email" value={draft.email ?? ""} fullWidth disabled />
              <TextField
                select
                label="Research type"
                value={draft.research_type ?? "Researcher"}
                onChange={(e) => setDraft((d) => ({ ...d, research_type: e.target.value as ResearchType }))}
                fullWidth
              >
                {RESEARCH_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Research focus"
                value={draft.research_focus ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, research_focus: e.target.value }))}
                fullWidth
              />
              <Typography variant="caption" color="text.secondary">
                Display name: {preview || "—"}
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
              Save
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
