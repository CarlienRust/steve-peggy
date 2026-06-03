"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { eyebrowSx, monoSx } from "@/theme/peggyTheme";
import {
  DEFAULT_PROFILE,
  clearProfileSession,
  loadProfile,
  saveProfile,
  type UserProfile,
} from "@/lib/userProfile";

export function ResearcherProfile() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(DEFAULT_PROFILE);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  const openEdit = () => {
    setDraft(profile);
    setEditOpen(true);
  };

  const saveEdit = () => {
    saveProfile(draft);
    setProfile(draft);
    setEditOpen(false);
  };

  const logout = () => {
    clearProfileSession();
    setSignedOut(true);
    setProfile(DEFAULT_PROFILE);
  };

  if (signedOut) {
    return (
      <Box sx={{ pt: 3, borderTop: 1, borderColor: "divider" }}>
        <Typography variant="body2" color="text.secondary">
          Signed out (stub)
        </Typography>
        <Button
          size="small"
          sx={{ mt: 1, px: 0 }}
          onClick={() => {
            setSignedOut(false);
            setProfile(loadProfile());
          }}
        >
          Sign in again
        </Button>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ mt: "auto", pt: 3, borderTop: 1, borderColor: "divider" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography sx={eyebrowSx}>{profile.displayName}</Typography>
            <Typography sx={{ ...monoSx, fontSize: 12, mt: 0.5 }}>{profile.researcherId}</Typography>
            <Typography sx={{ fontSize: 10, color: "text.secondary", mt: 0.5 }}>{profile.focus}</Typography>
          </Box>
          <Button size="small" onClick={openEdit} sx={{ minWidth: 0, p: 0.5 }} aria-label="Edit profile">
            <EditOutlinedIcon fontSize="small" />
          </Button>
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
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Display name"
              value={draft.displayName}
              onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Researcher ID"
              value={draft.researcherId}
              onChange={(e) => setDraft((d) => ({ ...d, researcherId: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Focus"
              value={draft.focus}
              onChange={(e) => setDraft((d) => ({ ...d, focus: e.target.value }))}
              fullWidth
              placeholder="Gut Microbiome · T2D"
            />
            <Typography variant="caption" color="text.secondary">
              Saved locally until Supabase Auth is wired (docs/AUTH.md).
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
