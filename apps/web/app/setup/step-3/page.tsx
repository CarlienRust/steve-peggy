"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Paper, Stack, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { SetupShell } from "@/components/setup/SetupShell";
import { useSetupState } from "@/components/setup/SetupState";

export default function SetupStep3Page() {
  const router = useRouter();
  const { state, setState } = useSetupState();
  const [countryOrRegion, setCountryOrRegion] = useState(String(state.settings?.["country_or_region"] ?? ""));
  const [settingType, setSettingType] = useState(String(state.settings?.["setting_type"] ?? ""));
  const [population, setPopulation] = useState(String(state.settings?.["population"] ?? ""));

  const onContinue = () => {
    setState({
      settings: {
        ...(state.settings || {}),
        country_or_region: countryOrRegion.trim(),
        setting_type: settingType.trim(),
        population: population.trim(),
      },
    });
    router.push("/setup/step-4");
  };

  return (
    <SetupShell title="Setting" subtitle="Capture the context for this project (used for chips and summaries)." step={3} backHref="/setup/step-2">
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Country / region"
            value={countryOrRegion}
            onChange={(e) => setCountryOrRegion(e.target.value)}
            fullWidth
          />
          <TextField label="Setting type" value={settingType} onChange={(e) => setSettingType(e.target.value)} fullWidth />
          <TextField label="Population" value={population} onChange={(e) => setPopulation(e.target.value)} fullWidth />

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 1 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              variant="outlined"
              onClick={() => router.push("/setup/step-2")}
              sx={{ textTransform: "none" }}
            >
              Back
            </Button>
            <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={onContinue} sx={{ textTransform: "none" }}>
              Continue
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            You can edit these later from the project settings.
          </Typography>
        </Stack>
      </Paper>
    </SetupShell>
  );
}

