"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LogoutIcon from "@mui/icons-material/Logout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peggyApi, queryKeys } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { saveActiveWorkspaceId } from "@/lib/userProfile";
import { eyebrowSx, monoSx, peggyColors } from "@/theme/peggyTheme";

export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, error: loadError } = useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: () => peggyApi.listWorkspaces(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [aim, setAim] = useState("");
  const [objectives, setObjectives] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const objs = objectives
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return peggyApi.createWorkspace({ title: title.trim(), aim: aim.trim(), objectives: objs });
    },
    onSuccess: (ws) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      setDialogOpen(false);
      openProject(ws.id);
    },
    onError: (err: Error) => setError(err.message),
  });

  const openProject = (id: string) => {
    saveActiveWorkspaceId(id);
    router.push("/");
  };

  const logout = async () => {
    saveActiveWorkspaceId(null);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const workspaces = data?.workspaces ?? [];

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", p: 3 }}>
      <Box sx={{ maxWidth: 640, mx: "auto" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: 0.5,
                bgcolor: "primary.main",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Typography sx={{ ...monoSx, fontSize: 11, color: "primary.contrastText", lineHeight: 1 }}>P</Typography>
            </Box>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.02em" }}>Peggy</Typography>
          </Box>
          <Button size="small" startIcon={<LogoutIcon />} onClick={logout} sx={{ textTransform: "none" }}>
            Log out
          </Button>
        </Stack>

        <Typography sx={eyebrowSx}>Research projects</Typography>
        <Typography variant="h5" fontWeight={600} sx={{ mb: 1 }}>
          Choose a project
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Open an existing project or create a new one to enter your workspace.
        </Typography>

        {loadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Could not load projects. If this persists, check API CORS includes this site on Render.
          </Alert>
        )}

        {isLoading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {workspaces.map((ws) => (
              <Paper
                key={ws.id}
                sx={{
                  p: 2.5,
                  cursor: "pointer",
                  border: 1,
                  borderColor: "divider",
                  "&:hover": { borderColor: peggyColors.primary, bgcolor: "action.hover" },
                }}
                onClick={() => openProject(ws.id)}
              >
                <Typography fontWeight={600}>{ws.title}</Typography>
                {ws.aim && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    {ws.aim}
                  </Typography>
                )}
              </Paper>
            ))}

            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} sx={{ alignSelf: "flex-start" }}>
              Create new project
            </Button>
          </Stack>
        )}

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>New research project</DialogTitle>
          <Box component="form" onSubmit={onSubmit}>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField label="Project title" value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth />
                <TextField label="Aim" value={aim} onChange={(e) => setAim(e.target.value)} fullWidth multiline minRows={2} />
                <TextField
                  label="Objectives"
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                  helperText="One objective per line"
                />
                {error && <Alert severity="error">{error}</Alert>}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create & open"}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>
      </Box>
    </Box>
  );
}
