"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, Chip, Paper, Stack, Tooltip, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SetupShell } from "@/components/setup/SetupShell";
import { useSetupState } from "@/components/setup/SetupState";
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
      showBackButton={false}
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
              onClick={() => setState({ privacy_mode: "local_only" })}
            />
            <Tooltip title="Hosted models are not available in this release.">
              <Box sx={{ flex: "1 0 0" }}>
                <ChoiceCard
                  selected={false}
                  disabled
                  title="Allow a hosted model"
                  tag={<Chip label="Sends text out" color="warning" size="small" sx={{ borderRadius: 999 }} />}
                  description="Can give better answers on some tasks. Text from your papers and findings is sent to the provider you choose."
                  onClick={() => {}}
                />
              </Box>
            </Tooltip>
          </Stack>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography sx={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "text.secondary", mb: 1 }}>
              YOUR PROJECT
            </Typography>
            <SummaryRow label="Name" value={state.title.trim()} onEdit={() => router.push("/setup/step-2")} />
            <SummaryRow label="Aim" value={state.aim.trim()} onEdit={() => router.push("/setup/step-2")} />
            <SummaryRow label="Setting" value={settingLabel} onEdit={() => router.push("/setup/step-3")} />
            <SummaryRow label="Modules" value={modulesLabel} onEdit={() => router.push("/setup/step-3")} />
            <SummaryRow
              label="Privacy"
              value={state.privacy_mode === "local_only" ? "Local only" : "Allow a hosted model"}
              onEdit={() => {
                document.getElementById("setup-privacy-choices")?.scrollIntoView({ behavior: "smooth" });
              }}
            />
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
  disabled,
  title,
  tag,
  description,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  tag: ReactNode;
  description: string;
  onClick: () => void;
}) {
  return (
    <Paper
      variant="outlined"
      onClick={disabled ? undefined : onClick}
      id={title === "Local only" ? "setup-privacy-choices" : undefined}
      sx={{
        p: 2.5,
        borderRadius: 2,
        cursor: disabled ? "not-allowed" : "pointer",
        borderWidth: selected ? 1.5 : 0.5,
        borderColor: selected ? "primary.main" : "divider",
        flex: "1 0 0",
        opacity: disabled ? 0.5 : 1,
        height: "100%",
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

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
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
      <Button variant="text" onClick={onEdit} sx={{ textTransform: "none", color: "secondary.main" }}>
        Edit
      </Button>
    </Stack>
  );
}
