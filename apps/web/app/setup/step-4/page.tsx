"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
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

  const setPrivacy = (value: SetupPrivacyMode) => setState({ privacy_mode: value });

  const modulesLabel = useMemo(() => {
    const mods = (state.enabled_modules || []).filter(Boolean);
    if (mods.length === 0) return "";
    const nice = mods.map((m) => (m === "core" ? "Core" : m[0].toUpperCase() + m.slice(1)));
    return nice.join(", ");
  }, [state.enabled_modules]);

  const settingLabel = useMemo(() => {
    const s = state.settings || {};
    const parts = [s["country_or_region"], s["setting_type"], s["population"]].filter(Boolean).map(String);
    return parts.join(", ");
  }, [state.settings]);

  return (
    <SetupShell
      title="Privacy"
      subtitle="Choose where Peggy is allowed to send text. You can change this per project."
      step={4}
      backHref="/setup/step-3"
    >
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack spacing={2.5}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
            <ChoiceCard
              selected={state.privacy_mode === "local_only"}
              title="Local only"
              tag={<Chip label="Recommended" size="small" sx={{ borderRadius: 999 }} />}
              description="Everything stays on this computer. Peggy uses the local model."
              onClick={() => setPrivacy("local_only")}
            />
            <ChoiceCard
              selected={state.privacy_mode === "hosted_allowed"}
              title="Allow a hosted model"
              tag={<Chip label="Sends text out" color="warning" size="small" sx={{ borderRadius: 999 }} />}
              description="Can give better answers on some tasks. Text from your papers and findings is sent to the provider you choose."
              onClick={() => setPrivacy("hosted_allowed")}
            />
          </Stack>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography sx={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "text.secondary", mb: 1 }}>
              YOUR PROJECT
            </Typography>
            <SummaryRow label="Name" value={state.title.trim()} />
            <SummaryRow label="Aim" value={state.aim.trim()} />
            <SummaryRow label="Setting" value={settingLabel} />
            <SummaryRow label="Modules" value={modulesLabel} />
            <SummaryRow label="Privacy" value={state.privacy_mode === "local_only" ? "Local only" : "Allow a hosted model"} />
          </Paper>

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

function ChoiceCard({
  selected,
  title,
  tag,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  tag: ReactNode;
  description: string;
  onClick: () => void;
}) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2.5,
        borderRadius: 2,
        cursor: "pointer",
        borderWidth: selected ? 1.5 : 0.5,
        borderColor: selected ? "primary.main" : "divider",
        flex: "1 0 0",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Box
          sx={{
            width: 20,
            height: 20,
            borderRadius: 999,
            border: 1,
            borderColor: selected ? "primary.main" : "text.secondary",
            display: "grid",
            placeItems: "center",
          }}
        >
          {selected ? <Box sx={{ width: 10, height: 10, borderRadius: 999, bgcolor: "primary.main" }} /> : null}
        </Box>
        <Typography fontWeight={600} sx={{ flex: 1 }}>
          {title}
        </Typography>
        {tag}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
        {description}
      </Typography>
    </Paper>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
      sx={{ py: 1, px: 1, borderTop: 1, borderColor: "divider" }}
    >
      <Typography fontWeight={600} sx={{ width: 140 }}>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1, lineHeight: 1.6 }}>
        {value || "—"}
      </Typography>
      <Button variant="text" sx={{ textTransform: "none", color: "secondary.main" }}>
        Edit
      </Button>
    </Stack>
  );
}

