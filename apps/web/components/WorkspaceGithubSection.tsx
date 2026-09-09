"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import GitHubIcon from "@mui/icons-material/GitHub";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { formatApiError, peggyApi, queryKeys, type GitHubRepo, type Workspace } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";

type WorkspaceGithubSectionProps = {
  workspace: Workspace;
  onUpdated?: () => void;
};

export function WorkspaceGithubSection({ workspace, onUpdated }: WorkspaceGithubSectionProps) {
  const queryClient = useQueryClient();
  const { userId } = useAuthSession();

  const connectionQuery = useQuery({
    queryKey: ["github-connection"],
    queryFn: () => peggyApi.githubConnection(),
  });

  const reposQuery = useQuery({
    queryKey: ["github-repos"],
    queryFn: () => peggyApi.githubRepos(),
    enabled: connectionQuery.data?.connected === true,
  });

  const connectMut = useMutation({
    mutationFn: async () => {
      const { authorize_url } = await peggyApi.githubLoginUrl();
      window.location.href = authorize_url;
    },
  });

  const disconnectMut = useMutation({
    mutationFn: () => peggyApi.githubDisconnect(),
    onSuccess: () => {
      void connectionQuery.refetch();
      void reposQuery.refetch();
    },
  });

  const linkMut = useMutation({
    mutationFn: (repo: GitHubRepo) =>
      peggyApi.linkWorkspaceGithub(workspace.id, {
        owner: repo.owner,
        name: repo.name,
        default_branch: repo.default_branch,
      }),
    onSuccess: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      }
      onUpdated?.();
    },
  });

  const unlinkMut = useMutation({
    mutationFn: () => peggyApi.unlinkWorkspaceGithub(workspace.id),
    onSuccess: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      }
      onUpdated?.();
    },
  });

  const syncMut = useMutation({
    mutationFn: () => peggyApi.syncWorkspaceGithub(workspace.id),
    onSuccess: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      }
      onUpdated?.();
    },
  });

  const linked = workspace.github_repo_owner && workspace.github_repo_name;

  return (
    <Stack spacing={1.5} sx={{ pt: 1 }}>
      <Typography variant="subtitle2">GitHub repository</Typography>
      {!connectionQuery.data?.connected ? (
        <Button
          variant="outlined"
          startIcon={connectMut.isPending ? <CircularProgress size={16} /> : <GitHubIcon />}
          onClick={() => connectMut.mutate()}
          disabled={connectMut.isPending}
        >
          Connect GitHub
        </Button>
      ) : (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Connected as {connectionQuery.data.github_username}
          </Typography>
          {linked ? (
            <Box>
              <Link href={workspace.github_repo_url ?? "#"} target="_blank" rel="noopener">
                {workspace.github_repo_owner}/{workspace.github_repo_name}
              </Link>
              {workspace.github_last_synced_at && (
                <Typography variant="caption" display="block" color="text.secondary">
                  Last synced {new Date(workspace.github_last_synced_at).toLocaleString()}
                </Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" variant="contained" disabled={syncMut.isPending} onClick={() => syncMut.mutate()}>
                  {syncMut.isPending ? "Syncing…" : "Sync documentation"}
                </Button>
                <Button size="small" color="inherit" disabled={unlinkMut.isPending} onClick={() => unlinkMut.mutate()}>
                  Unlink repo
                </Button>
              </Stack>
              {syncMut.isSuccess && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  Synced {syncMut.data.ingested.length} file(s)
                  {syncMut.data.skipped.length > 0 ? ` · ${syncMut.data.skipped.length} skipped` : ""}
                </Alert>
              )}
            </Box>
          ) : (
            <Autocomplete
              options={reposQuery.data?.repos ?? []}
              getOptionLabel={(r) => r.full_name}
              loading={reposQuery.isLoading}
              onChange={(_, repo) => {
                if (repo) linkMut.mutate(repo);
              }}
              renderInput={(params) => (
                <TextField {...params} label="Link a repository" size="small" placeholder="Search your repos" />
              )}
            />
          )}
          <Button size="small" color="inherit" onClick={() => disconnectMut.mutate()} disabled={disconnectMut.isPending}>
            Disconnect GitHub account
          </Button>
        </Stack>
      )}
      {connectMut.isError && <Alert severity="error">{formatApiError(connectMut.error)}</Alert>}
      {linkMut.isError && <Alert severity="error">{formatApiError(linkMut.error)}</Alert>}
      {syncMut.isError && <Alert severity="error">{formatApiError(syncMut.error)}</Alert>}
    </Stack>
  );
}
