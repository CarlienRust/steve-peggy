"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, CircularProgress, Grid, Paper, Stack, Typography } from "@mui/material";
import { LocalDevBanner } from "@/components/LocalDevBanner";
import { PeggyWelcomeHub } from "@/components/PeggyWelcomeHub";
import { formatApiError, peggyApi, queryKeys, type Workspace } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { saveActiveWorkspaceId } from "@/lib/userProfile";
import { eyebrowSx } from "@/theme/peggyTheme";

type ActivityItem = { key: string; label: string; at: string };

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day} days ago`;
  return new Date(iso).toLocaleDateString();
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: "center" }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" fontWeight={600} sx={{ mt: 0.5 }}>
        {value}
      </Typography>
    </Paper>
  );
}

export function HomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready, userId } = useAuthSession();

  const workspacesQuery = useQuery({
    queryKey: queryKeys.workspaces(userId ?? undefined),
    queryFn: () => peggyApi.listWorkspaces(),
    enabled: ready && !!userId,
  });
  const papersQuery = useQuery({
    queryKey: queryKeys.corpus("literature"),
    queryFn: () => peggyApi.listCorpus("literature"),
    enabled: ready && !!userId,
  });

  const workspaces = workspacesQuery.data?.workspaces ?? [];
  const papers = papersQuery.data?.papers ?? [];
  const unread = papers.filter((p) => !p.read_at);
  const countsByWs = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of papers) {
      if (!p.workspace_id) continue;
      map[p.workspace_id] = (map[p.workspace_id] ?? 0) + 1;
    }
    return map;
  }, [papers]);

  const activity = useMemo(() => {
    const items: ActivityItem[] = [];
    for (const p of papers) {
      if (p.ingested_at) {
        items.push({
          key: `add-${p.id}-${p.ingested_at}`,
          label: `Added paper${p.title ? `: ${p.title}` : ""}`,
          at: p.ingested_at,
        });
      }
      if (p.read_at) {
        items.push({
          key: `read-${p.id}-${p.read_at}`,
          label: `Marked paper read${p.title ? `: ${p.title}` : ""}`,
          at: p.read_at,
        });
      }
    }
    for (const ws of workspaces) {
      if (ws.last_opened_at) {
        items.push({
          key: `open-${ws.id}-${ws.last_opened_at}`,
          label: `Opened project: ${ws.title}`,
          at: ws.last_opened_at,
        });
      }
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 5);
  }, [papers, workspaces]);

  const loading = !ready || workspacesQuery.isLoading || papersQuery.isLoading;
  const loadError = workspacesQuery.error || papersQuery.error;

  const openProject = (id: string) => {
    saveActiveWorkspaceId(id);
    void peggyApi.updateWorkspace(id, { last_opened_at: new Date().toISOString() }).then(() => {
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
    });
    router.push("/dashboard");
  };

  return (
    <Box>
      <LocalDevBanner />
      <PeggyWelcomeHub />
      {loading ? (
        <CircularProgress size={28} />
      ) : loadError ? (
        <Alert severity="error">{formatApiError(loadError)}</Alert>
      ) : (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <StatCard label="Projects" value={workspaces.length} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatCard label="Papers" value={papers.length} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatCard label="Unread papers" value={unread.length} />
            </Grid>
          </Grid>

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={eyebrowSx}>Your projects</Typography>
              <Button size="small" onClick={() => router.push("/setup/step-1")}>
                + New project
              </Button>
            </Stack>
            {workspaces.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No projects yet. Create one to start a corpus.
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {workspaces.map((ws: Workspace) => (
                  <Grid item xs={12} md={6} key={ws.id}>
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: "100%" }}>
                      <Typography fontWeight={600}>{ws.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 1.5 }}>
                        {(ws.aim || "No research description yet.").slice(0, 180)}
                        {(ws.aim || "").length > 180 ? "…" : ""}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                        {countsByWs[ws.id] ?? 0} papers
                      </Typography>
                      <Button size="small" onClick={() => openProject(ws.id)}>
                        Open project →
                      </Button>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography sx={{ ...eyebrowSx, mb: 1.5 }}>Recent activity</Typography>
            {activity.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No recent activity yet.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {activity.map((item) => (
                  <Stack key={item.key} direction="row" justifyContent="space-between" spacing={2}>
                    <Typography variant="body2">{item.label}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                      {relativeTime(item.at)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
              <Box>
                <Typography sx={{ ...eyebrowSx, mb: 0.75 }}>Reading reminder</Typography>
                <Typography variant="body2" color="text.secondary">
                  {unread.length === 0
                    ? "No papers waiting to be reviewed."
                    : `${unread.length} paper${unread.length === 1 ? "" : "s"} waiting to be reviewed`}
                </Typography>
              </Box>
              <Button size="small" onClick={() => router.push("/reading-journal")}>
                View all →
              </Button>
            </Stack>
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
