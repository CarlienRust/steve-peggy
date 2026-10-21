"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SetupShell } from "@/components/setup/SetupShell";
import { useSetupState, type SetupPrivacyMode } from "@/components/setup/SetupState";
import { peggyApi, queryKeys, formatApiError } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { saveActiveWorkspaceId } from "@/lib/userProfile";

export default function SetupStep4Page() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useAuthSession();
  const { state, setState } = useSetupState();
  const [error, setError] = useState<string | null>(null);

  const canCreate = useMemo(() => state.title.trim().length > 0, [state.title]);

  const createMutation = useMutation({
    mutationFn: async () => {
      return peggyApi.createWorkspace({
        title: state.title.trim(),
        aim: state.aim.trim(),
        objectives: state.objectives,
        resources: state.resources,
        settings: state.settings,
        enabled_modules: state.enabled_modules,
        privacy_mode: state.privacy_mode,
        last_opened_at: new Date().toISOString(),
      });
    },
    onSuccess: (ws) => {
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      saveActiveWorkspaceId(ws.id);
      router.push("/dashboard");
    },
    onError: (err: unknown) => setError(formatApiError(err)),
  });

  const onPrivacyChange = (_: unknown, value: SetupPrivacyMode | null) => {
    if (!value) return;
    setState({ privacy_mode: value });
  };

  return (
    <SetupShell title="Privacy mode" subtitle="Choose where your data can be processed." step={4} backHref="/setup/step-3">
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Stack spacing={0.75}>
            <Typography fontWeight={600}>Privacy</Typography>
            <ToggleButtonGroup
              color="primary"
              value={state.privacy_mode}
              exclusive
              onChange={onPrivacyChange}
              sx={{ alignSelf: "flex-start" }}
            >
              <ToggleButton value="local_only" sx={{ textTransform: "none" }}>
                Local only
              </ToggleButton>
              <ToggleButton value="hosted_allowed" sx={{ textTransform: "none" }}>
                Hosted allowed
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              Local only keeps processing on your machine. Hosted allowed lets Peggy use hosted services when configured.
            </Typography>
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 1 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              variant="outlined"
              onClick={() => router.push("/setup/step-3")}
              sx={{ textTransform: "none" }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              startIcon={<CheckIcon />}
              onClick={() => createMutation.mutate()}
              disabled={!canCreate || createMutation.isPending}
              sx={{ textTransform: "none" }}
            >
              {createMutation.isPending ? "Creating…" : "Create project"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </SetupShell>
  );
}

