"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { SetupShell } from "@/components/setup/SetupShell";
import { useSetupState } from "@/components/setup/SetupState";
import { DisabledTooltipButton } from "@/components/DisabledTooltipButton";

export default function SetupStep1Page() {
  const router = useRouter();
  const { state, setState } = useSetupState();
  const startMode = state.start_mode ?? null;
  const canContinue = !!startMode;

  const onContinue = () => {
    if (!startMode) return;
    router.push("/setup/step-2");
  };

  return (
    <SetupShell
      title="How do you want to start?"
      subtitle="Pick one. You can change this later."
      step={1}
      backHref="/"
      showBackButton={false}
    >
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="stretch">
          <OptionCard
            option="OPTION 1"
            title="I have an idea"
            description="Enter your aim and objectives. Peggy checks them against the literature."
            selected={startMode === "idea"}
            onSelect={() => setState({ start_mode: "idea" })}
          />
          <OptionCard
            option="OPTION 2"
            title="Find me a gap"
            description="Scan the literature for open questions in your topic."
            selected={startMode === "gap"}
            onSelect={() => setState({ start_mode: "gap" })}
          />
          <OptionCard
            option="OPTION 3"
            title="Here is what I have"
            description="List your data, cohorts and resources. Peggy suggests questions you can answer."
            selected={startMode === "resources"}
            onSelect={() => setState({ start_mode: "resources" })}
          />
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 1 }}>
          <Button component={Link} href="/" variant="text" sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Box sx={{ width: 10 }} />
          <DisabledTooltipButton title={canContinue ? "" : "Choose an option to continue"}>
            <Button variant="contained" onClick={onContinue} disabled={!canContinue} sx={{ textTransform: "none" }}>
              Continue
            </Button>
          </DisabledTooltipButton>
        </Stack>
      </Stack>
    </SetupShell>
  );
}

function OptionCard({
  option,
  title,
  description,
  selected,
  onSelect,
}: {
  option: string;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Paper
      variant="outlined"
      onClick={onSelect}
      sx={{
        p: 2.5,
        borderRadius: 2,
        cursor: "pointer",
        borderWidth: selected ? 1.5 : 0.5,
        borderColor: selected ? "primary.main" : "divider",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        flex: "1 0 0",
      }}
    >
      <Typography sx={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "text.secondary" }}>
        {option}
      </Typography>
      <Typography fontWeight={600}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, flex: 1 }}>
        {description}
      </Typography>
    </Paper>
  );
}

