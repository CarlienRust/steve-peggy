"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peggyApi, queryKeys } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { eyebrowSx } from "@/theme/peggyTheme";

export default function WorkspacesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setActiveWorkspaceId } = useWorkspace();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: () => peggyApi.listWorkspaces(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [aim, setAim] = useState("");
  const [objectives, setObjectives] = useState("");
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const objs = objectives
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (editId) {
        return peggyApi.updateWorkspace(editId, { title: title.trim(), aim: aim.trim(), objectives: objs });
      }
      return peggyApi.createWorkspace({ title: title.trim(), aim: aim.trim(), objectives: objs });
    },
    onSuccess: (ws) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      setDialogOpen(false);
      setActiveWorkspaceId(ws.id);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => peggyApi.deleteWorkspace(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces }),
  });

  const openCreate = () => {
    setEditId(null);
    setTitle("");
    setAim("");
    setObjectives("");
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (ws: { id: string; title: string; aim: string; objectives: string[] }) => {
    setEditId(ws.id);
    setTitle(ws.title);
    setAim(ws.aim);
    setObjectives((ws.objectives ?? []).join("\n"));
    setError(null);
    setDialogOpen(true);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const workspaces = data?.workspaces ?? [];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography sx={eyebrowSx}>Research projects</Typography>
          <Typography variant="h1" sx={{ fontSize: "1.75rem", fontWeight: 600 }}>
            Workspaces
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          New workspace
        </Button>
      </Stack>

      {isLoading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : workspaces.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">No workspaces yet. Create your first research project.</Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {workspaces.map((ws) => (
            <Paper key={ws.id} sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={600}>{ws.title}</Typography>
                  {ws.aim && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Aim:</strong> {ws.aim}
                    </Typography>
                  )}
                  {ws.objectives?.length > 0 && (
                    <Box component="ul" sx={{ mt: 1, pl: 2, mb: 0 }}>
                      {ws.objectives.map((o, i) => (
                        <Typography component="li" variant="body2" key={i}>
                          {o}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
                <Stack direction="row" spacing={0.5}>
                  <Button size="small" onClick={() => openEdit(ws)}>
                    Edit
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setActiveWorkspaceId(ws.id);
                      router.push("/");
                    }}
                  >
                    Open
                  </Button>
                  <IconButton
                    size="small"
                    aria-label="Delete workspace"
                    onClick={() => deleteMutation.mutate(ws.id)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? "Edit workspace" : "New workspace"}</DialogTitle>
        <Box component="form" onSubmit={onSubmit}>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField label="Project title" value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth />
              <TextField
                label="Aim"
                value={aim}
                onChange={(e) => setAim(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              <TextField
                label="Objectives"
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
                fullWidth
                multiline
                minRows={4}
                helperText="One objective per line"
              />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
