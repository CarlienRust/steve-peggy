"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { LocalDevBanner } from "@/components/LocalDevBanner";
import { PeggyWelcomeHub } from "@/components/PeggyWelcomeHub";
import { formatApiError, peggyApi, queryKeys } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { saveActiveWorkspaceId } from "@/lib/userProfile";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function sortByOpened(a: { last_opened_at?: string | null }, b: { last_opened_at?: string | null }) {
  const ta = a.last_opened_at ? new Date(a.last_opened_at).getTime() : 0;
  const tb = b.last_opened_at ? new Date(b.last_opened_at).getTime() : 0;
  return tb - ta;
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
  const eventsQuery = useQuery({
    queryKey: queryKeys.calendar(),
    queryFn: () => peggyApi.listCalendarEvents(),
    enabled: ready && !!userId,
  });
  const papersQuery = useQuery({
    queryKey: queryKeys.corpus("literature"),
    queryFn: () => peggyApi.listCorpus("literature"),
    enabled: ready && !!userId,
  });

  const workspaces = workspacesQuery.data?.workspaces ?? [];
  const mostUsed = useMemo(() => {
    if (workspaces.length === 0) return null;
    return [...workspaces].sort(sortByOpened)[0];
  }, [workspaces]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (eventsQuery.data?.events ?? [])
      .filter((e) => new Date(e.starts_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .slice(0, 3);
  }, [eventsQuery.data?.events]);

  const papers = papersQuery.data?.papers ?? [];
  const lastRead = useMemo(() => {
    const read = papers.filter((p) => p.read_at);
    if (read.length === 0) return null;
    return [...read].sort((a, b) => new Date(b.read_at!).getTime() - new Date(a.read_at!).getTime())[0];
  }, [papers]);
  const nextUnread = useMemo(() => papers.find((p) => !p.read_at) ?? null, [papers]);
  const readThisWeek = papers.some((p) => p.read_at && Date.now() - new Date(p.read_at).getTime() <= WEEK_MS);

  const loading = !ready || workspacesQuery.isLoading || eventsQuery.isLoading || papersQuery.isLoading;
  const loadError = workspacesQuery.error || eventsQuery.error || papersQuery.error;

  const openProject = (id: string) => {
    saveActiveWorkspaceId(id);
    void peggyApi.updateWorkspace(id, { last_opened_at: new Date().toISOString() }).then(() => {
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
    });
    router.push("/dashboard");
  };

  const goJournal = () => {
    router.push("/reading-journal");
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
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              Upcoming events
            </Typography>
            {upcoming.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No upcoming events. Add dates on Calendar.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {upcoming.map((e) => (
                  <Stack key={e.id} direction="row" spacing={2} justifyContent="space-between">
                    <Typography variant="body2">{e.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(e.starts_at).toLocaleString()}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
            <Button size="small" sx={{ mt: 1.5, textTransform: "none" }} onClick={() => router.push("/calendar")}>
              Open calendar
            </Button>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              Reading
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {readThisWeek ? "You have marked a paper as read this week." : "Read one a week."}
            </Typography>
            {lastRead ? (
              <Typography variant="body2" sx={{ mb: 1 }}>
                Return to reading: {lastRead.title || `Paper ${lastRead.id}`}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                No papers marked read yet.
              </Typography>
            )}
            {nextUnread ? (
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                Suggest read next: {nextUnread.title || `Paper ${nextUnread.id}`}
              </Typography>
            ) : papers.length > 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                All literature papers are marked read.
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                No research papers in your corpus yet.
              </Typography>
            )}
            <Stack direction="row" spacing={1}>
              <Button size="small" sx={{ textTransform: "none" }} onClick={goJournal}>
                Return to reading
              </Button>
              <Button size="small" variant="outlined" sx={{ textTransform: "none" }} onClick={goJournal}>
                Open reading journal
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              Most used project
            </Typography>
            {mostUsed ? (
              <>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {mostUsed.title}
                  {mostUsed.last_opened_at
                    ? ` · Last opened ${new Date(mostUsed.last_opened_at).toLocaleString()}`
                    : " · Not opened yet"}
                </Typography>
                <Button size="small" sx={{ textTransform: "none" }} onClick={() => openProject(mostUsed.id)}>
                  Open project
                </Button>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No projects yet. Create one in Project hub.
              </Typography>
            )}
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
