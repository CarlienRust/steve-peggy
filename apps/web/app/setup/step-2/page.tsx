"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Button, Checkbox, FormControlLabel, Paper, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { SetupShell } from "@/components/setup/SetupShell";
import { useSetupState } from "@/components/setup/SetupState";

const MODULES: { id: string; label: string; required?: boolean }[] = [
  { id: "core", label: "Core (Study design)", required: true },
  { id: "outcomes", label: "Outcomes" },
  { id: "exposure", label: "Exposure" },
  { id: "microbiome", label: "Microbiome" },
  { id: "diet", label: "Diet" },
];

export default function SetupStep2Page() {
  const router = useRouter();
  const { state, setState } = useSetupState();

  const enabled = new Set(state.enabled_modules ?? ["core"]);
  enabled.add("core");

  const toggle = (id: string) => {
    const next = new Set(enabled);
    if (id === "core") return;
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setState({ enabled_modules: Array.from(next) });
  };

  return (
    <SetupShell title="Evidence modules" subtitle="Choose what Peggy should extract and review from papers." step={2} backHref="/setup/step-1">
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack spacing={1.5}>
          {MODULES.map((m) => (
            <FormControlLabel
              key={m.id}
              control={
                <Checkbox
                  checked={enabled.has(m.id)}
                  onChange={() => toggle(m.id)}
                  disabled={!!m.required}
                />
              }
              label={
                <Box>
                  <Typography fontWeight={600}>{m.label}</Typography>
                  {m.required ? (
                    <Typography variant="caption" color="text.secondary">
                      Required
                    </Typography>
                  ) : null}
                </Box>
              }
              sx={{ alignItems: "flex-start", m: 0 }}
            />
          ))}

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 1 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              variant="outlined"
              onClick={() => router.push("/setup/step-1")}
              sx={{ textTransform: "none" }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              onClick={() => router.push("/setup/step-3")}
              sx={{ textTransform: "none" }}
            >
              Continue
            </Button>
          </Stack>
          <Button component={Link} href="/setup/checks" variant="text" sx={{ textTransform: "none", alignSelf: "flex-start" }}>
            Run system check first
          </Button>
        </Stack>
      </Paper>
    </SetupShell>
  );
}

