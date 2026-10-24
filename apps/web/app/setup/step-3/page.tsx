"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField, Typography } from "@mui/material";
import { SETUP_COUNTRY_REGIONS, SETUP_SETTING_TYPES } from "@/lib/setupSettings";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { SetupShell } from "@/components/setup/SetupShell";
import { useSetupState } from "@/components/setup/SetupState";

const MODULES: Array<{
  id: string;
  title: string;
  description: string;
  required?: boolean;
  tag: string;
}> = [
  {
    id: "core",
    title: "Core",
    description: "Design, setting, sample size, covariates adjusted, effect estimate.",
    required: true,
    tag: "Always on",
  },
  { id: "outcomes", title: "Outcomes", description: "Primary and secondary outcomes and effect direction.", tag: "v1" },
  {
    id: "exposure",
    title: "Exposure",
    description: "Environmental and psychosocial exposures and how they were measured.",
    tag: "v1",
  },
  {
    id: "microbiome",
    title: "Microbiome",
    description: "Sample type, sequencing region, platform, pipeline, diversity metrics.",
    tag: "v1",
  },
  { id: "diet", title: "Diet", description: "How diet was assessed and the period it covers.", tag: "v1" },
];

export default function SetupStep3Page() {
  const router = useRouter();
  const { state, setState } = useSetupState();
  const [countryOrRegion, setCountryOrRegion] = useState(String(state.settings?.["country_or_region"] ?? ""));
  const [settingType, setSettingType] = useState(String(state.settings?.["setting_type"] ?? ""));
  const [population, setPopulation] = useState(String(state.settings?.["population"] ?? ""));

  const enabled = new Set(state.enabled_modules ?? ["core"]);
  enabled.add("core");

  const toggle = (id: string) => {
    if (id === "core") return;
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setState({ enabled_modules: Array.from(next) });
  };

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
    <SetupShell
      title="Setting and modules"
      subtitle="Peggy only extracts the fields your modules need. You can change this later."
      step={3}
      showBackButton={false}
    >
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack spacing={2.5}>
          <Stack spacing={2} sx={{ p: 0.5 }}>
            <Typography sx={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "text.secondary" }}>
              SETTING
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel id="setup-country-label">Country or region</InputLabel>
                <Select
                  labelId="setup-country-label"
                  label="Country or region"
                  value={countryOrRegion || ""}
                  onChange={(e) => setCountryOrRegion(String(e.target.value))}
                >
                  <MenuItem value="">
                    <em>Select…</em>
                  </MenuItem>
                  {SETUP_COUNTRY_REGIONS.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="setup-setting-label">Setting type</InputLabel>
                <Select
                  labelId="setup-setting-label"
                  label="Setting type"
                  value={settingType || ""}
                  onChange={(e) => setSettingType(String(e.target.value))}
                >
                  <MenuItem value="">
                    <em>e.g. Urban community</em>
                  </MenuItem>
                  {SETUP_SETTING_TYPES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label="POPULATION"
              value={population}
              onChange={(e) => setPopulation(e.target.value)}
              fullWidth
              placeholder="e.g. adults aged 18 to 65"
            />
          </Stack>

          <Stack spacing={1.25} sx={{ p: 0.5 }}>
            <Typography sx={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "text.secondary" }}>
              EVIDENCE MODULES
            </Typography>
            {MODULES.map((m) => {
              const on = enabled.has(m.id);
              return (
                <Stack
                  key={m.id}
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{ py: 1.25, px: 1, borderTop: 1, borderColor: "divider" }}
                >
                  <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={600}>{m.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      {m.description}
                    </Typography>
                  </Stack>
                  <Chip
                    label={m.tag}
                    size="small"
                    variant="outlined"
                    sx={{ borderRadius: 999, px: 0.5, bgcolor: "background.default" }}
                  />
                  <Switch checked={on} disabled={!!m.required} onChange={() => toggle(m.id)} />
                </Stack>
              );
            })}
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, pt: 0.5 }}>
              Medication and genetics modules come in a later release.
            </Typography>
          </Stack>

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
        </Stack>
      </Paper>
    </SetupShell>
  );
}

