"use client";

import { useState } from "react";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peggyApi, queryKeys, formatApiError } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { saveActiveWorkspaceId } from "@/lib/userProfile";
import { LocalDevBanner } from "@/components/LocalDevBanner";
import { eyebrowSx } from "@/theme/peggyTheme";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProjectCard } from "@/components/ProjectCard";

export function ProjectHubPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready, userId } = useAuthSession();
  const { data, isLoading, error: loadError } = useQuery({
    queryKey: queryKeys.workspaces(userId ?? undefined),
    queryFn: () => peggyApi.listWorkspaces(),
    enabled: ready && !!userId,
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const workspaces = data?.workspaces ?? [];
  const pageLoading = !ready || isLoading;

  const openProject = (id: string) => {
    saveActiveWorkspaceId(id);
    void peggyApi.updateWorkspace(id, { last_opened_at: new Date().toISOString() }).then(() => {
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
    });
    router.push("/dashboard");
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => peggyApi.deleteWorkspace(id),
    onSuccess: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      setDeleteId(null);
    },
    onError: (err: unknown) => setError(formatApiError(err)),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => peggyApi.updateWorkspace(id, { title }),
    onSuccess: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      setRenameOpen(false);
      setRenameId(null);
      setRenameTitle("");
    },
    onError: (err: unknown) => setError(formatApiError(err)),
  });

  const openRename = (id: string, currentTitle: string) => {
    setRenameId(id);
    setRenameTitle(currentTitle);
    setRenameOpen(true);
  };

  return (
    <Box>
      <LocalDevBanner />

      {pageLoading ? (
        <Box sx={{ display: "grid", placeItems: "center", minHeight: "40vh" }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", justifyContent: "space-between", mb: 3 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={eyebrowSx}>PROJECT HUB</Typography>
              <Typography variant="h4" fontWeight={600} letterSpacing="-0.02em" sx={{ mb: 1 }}>
                Your projects
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, maxWidth: 720 }}>
                Each project keeps its own papers, findings and plans. Nothing is shared between projects.
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => router.push("/projects/new")}
              sx={{ textTransform: "none", flexShrink: 0 }}
            >
              + New project
            </Button>
          </Box>

          {loadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Could not load projects. If this persists, check API CORS includes this site on Render.
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {workspaces.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="body1" fontWeight={600} sx={{ mb: 1 }}>
                No projects yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
                Create a project to ingest literature, plan your study, and ask Peggy with project context.
              </Typography>
              <Button variant="contained" onClick={() => router.push("/projects/new")} sx={{ textTransform: "none" }}>
                + New project
              </Button>
            </Paper>
          ) : (
            <Stack spacing={2}>
              {workspaces.map((ws) => (
                <ProjectCard
                  key={ws.id}
                  workspace={ws}
                  onOpen={() => openProject(ws.id)}
                  onRename={() => openRename(ws.id, ws.title)}
                  onDelete={() => setDeleteId(ws.id)}
                />
              ))}
            </Stack>
          )}
        </Box>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete project?"
        body="This removes the project and its linked data."
        confirmLabel={deleteMutation.isPending ? "Deleting…" : "Delete"}
        destructive
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename project</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Project title"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              required
              fullWidth
            />
            {renameMutation.isError && <Alert severity="error">{formatApiError(renameMutation.error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setRenameOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => renameId && renameMutation.mutate({ id: renameId, title: renameTitle.trim() })}
            disabled={!renameTitle.trim() || renameMutation.isPending}
            sx={{ textTransform: "none" }}
          >
            {renameMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
