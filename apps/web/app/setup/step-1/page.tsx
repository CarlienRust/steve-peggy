"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { SetupShell } from "@/components/setup/SetupShell";
import { useSetupState } from "@/components/setup/SetupState";
import { normalizeObjectives, type WorkspaceObjective } from "@/lib/objectives";

export default function SetupStep1Page() {
  const router = useRouter();
  const { state, setState } = useSetupState();
  const [title, setTitle] = useState(state.title);
  const [aim, setAim] = useState(state.aim);
  const [objectivesText, setObjectivesText] = useState(() =>
    (state.objectives || []).map((o) => o.text).filter(Boolean).join("\n")
  );

  useEffect(() => {
    setTitle(state.title);
    setAim(state.aim);
  }, [state.title, state.aim]);

  const objectives: WorkspaceObjective[] = useMemo(() => {
    const raw = objectivesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text) => ({ id: crypto.randomUUID(), text, status: "draft" as const }));
    return normalizeObjectives(raw);
  }, [objectivesText]);

  const canContinue = title.trim().length > 0;

  const onContinue = () => {
    setState({
      title: title.trim(),
      aim: aim.trim(),
      objectives,
    });
    router.push("/setup/step-2");
  };

  return (
    <SetupShell title="Project details" subtitle="Name your project and capture the aim and objectives." step={1} backHref="/setup">
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Project title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
          />
          <TextField
            label="Aim"
            value={aim}
            onChange={(e) => setAim(e.target.value)}
            fullWidth
            multiline
            minRows={3}
          />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              Objectives (one per line)
            </Typography>
            <TextField
              value={objectivesText}
              onChange={(e) => setObjectivesText(e.target.value)}
              fullWidth
              multiline
              minRows={4}
              placeholder={"e.g.\nDefine the exposure\nMeasure outcomes\nIdentify key confounders"}
            />
          </Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button component={Link} href="/setup" variant="text" sx={{ textTransform: "none" }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={onContinue}
              endIcon={<ArrowForwardIcon />}
              disabled={!canContinue}
              sx={{ textTransform: "none" }}
            >
              Continue
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </SetupShell>
  );
}

