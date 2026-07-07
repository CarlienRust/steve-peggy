"use client";

import { FormEvent, useEffect, useState } from "react";
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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LogoutIcon from "@mui/icons-material/Logout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peggyApi, queryKeys, formatApiError } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { createClient } from "@/lib/supabase/client";
import { loadActiveWorkspaceId, saveActiveWorkspaceId } from "@/lib/userProfile";
import { PeggyBrandLockup } from "@/components/PeggyBrandLockup";
import { PeggyWelcomeHub } from "@/components/PeggyWelcomeHub";
import { eyebrowSx, peggyColors } from "@/theme/peggyTheme";

export function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready, userId } = useAuthSession();
  const { data, isLoading, error: loadError } = useQuery({
    queryKey: queryKeys.workspaces(userId ?? undefined),
    queryFn: () => peggyApi.listWorkspaces(),
    enabled: ready && !!userId,
  });
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: queryKeys.profile(userId ?? undefined),
    queryFn: () => peggyApi.getProfileOptional(),
    enabled: ready && !!userId,
    retry: false,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [aim, setAim] = useState("");
  const [objectives, setObjectives] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [canBackToDashboard, setCanBackToDashboard] = useState(false);

  useEffect(() => {
    setCanBackToDashboard(!!loadActiveWorkspaceId());
  }, []);

  const createMutation = useMutation({
    mutationFn: async () => {
      const objs = objectives
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return peggyApi.createWorkspace({ title: title.trim(), aim: aim.trim(), objectives: objs });
    },
    onSuccess: (ws) => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      }
      setDialogOpen(false);
      openProject(ws.id);
    },
    onError: (err: unknown) => setError(formatApiError(err)),
  });

  const openProject = (id: string) => {
    saveActiveWorkspaceId(id);
    router.push("/dashboard");
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
  const hasProfile = !!profile;
  const createProjectLabel = workspaces.length === 0 ? "Create first project" : "Create new project";
  const pageLoading = !ready || isLoading || profileLoading;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      <Box
        component="header"
        sx={{
          flexShrink: 0,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          px: { xs: 2.5, sm: 3, md: 4 },
          py: 2,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 1200,
            mx: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <PeggyBrandLockup variant="sidebar" />
          <Button size="small" startIcon={<LogoutIcon />} onClick={logout} sx={{ textTransform: "none", flexShrink: 0 }}>
            Log out
          </Button>
        </Box>
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          width: "100%",
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 2.5, sm: 3, md: 4 },
          py: { xs: 3, sm: 4, md: 5 },
        }}
      >
        {canBackToDashboard && (
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push("/dashboard")}
            sx={{ textTransform: "none", mb: 2, px: 0, minWidth: 0 }}
          >
            Back to dashboard
          </Button>
        )}

        {pageLoading ? (
          <Box sx={{ display: "grid", placeItems: "center", minHeight: "40vh" }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: workspaces.length > 0 ? "minmax(0, 1fr) minmax(0, 1fr)" : "1fr",
              },
              gap: { xs: 4, lg: 6 },
              alignItems: "start",
            }}
          >
            <Box sx={{ minWidth: 0, maxWidth: workspaces.length > 0 ? "none" : 720 }}>
              <PeggyWelcomeHub
                hasProfile={hasProfile}
                onCreateProject={() => setDialogOpen(true)}
                createProjectLabel={createProjectLabel}
              />
            </Box>

            {workspaces.length > 0 && (
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={eyebrowSx}>Research projects</Typography>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                  Choose a project
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Open an existing project to enter your workspace.
                </Typography>

                {loadError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    Could not load projects. If this persists, check API CORS includes this site on Render.
                  </Alert>
                )}

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
                </Stack>
              </Box>
            )}

            {!workspaces.length && loadError && (
              <Alert severity="error">
                Could not load projects. If this persists, check API CORS includes this site on Render.
              </Alert>
            )}
          </Box>
        )}

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{workspaces.length === 0 ? "Create your first project" : "New research project"}</DialogTitle>
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
