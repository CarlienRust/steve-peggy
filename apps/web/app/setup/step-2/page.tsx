"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { SetupShell } from "@/components/setup/SetupShell";
import { useSetupState } from "@/components/setup/SetupState";
import { normalizeObjectives, type WorkspaceObjective } from "@/lib/objectives";

export default function SetupStep2Page() {
  const router = useRouter();
  const { state, setState } = useSetupState();

  const mode = state.start_mode ?? "idea";

  const [title, setTitle] = useState(state.title);
  const [aim, setAim] = useState(state.aim);
  const [objectivesText, setObjectivesText] = useState(() =>
    (state.objectives || []).map((o) => o.text).filter(Boolean).join("\n")
  );
  const [topic, setTopic] = useState(String(state.resources?.["topic"] ?? ""));
  const [resourcesText, setResourcesText] = useState(String(state.resources?.["resources_text"] ?? ""));

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
    const patch: any = { title: title.trim() };
    if (mode === "idea") {
      patch.aim = aim.trim();
      patch.objectives = objectives;
    }
    if (mode === "gap") {
      patch.resources = { ...(state.resources || {}), topic: topic.trim() };
    }
    if (mode === "resources") {
      patch.resources = { ...(state.resources || {}), resources_text: resourcesText.trim() };
    }
    setState(patch);
    router.push("/setup/step-3");
  };

  return (
    <SetupShell
      title={
        mode === "gap"
          ? "Find me a gap"
          : mode === "resources"
            ? "Here is what I have"
            : "I have an idea"
      }
      subtitle={
        mode === "gap"
          ? "Scan the literature for open questions in your topic."
          : mode === "resources"
            ? "List your data, cohorts and resources. Peggy suggests questions you can answer."
            : "Enter your aim and objectives. Peggy checks them against the literature."
      }
      step={2}
      backHref="/setup/step-1"
    >
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack spacing={2}>
          <TextField label="Name" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />

          {mode === "idea" ? (
            <>
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
                />
              </Box>
            </>
          ) : null}

          {mode === "gap" ? (
            <TextField
              label="Topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              fullWidth
              placeholder="e.g. air pollution and depression in Africa"
            />
          ) : null}

          {mode === "resources" ? (
            <TextField
              label="Resources"
              value={resourcesText}
              onChange={(e) => setResourcesText(e.target.value)}
              fullWidth
              multiline
              minRows={6}
              placeholder="List your datasets, cohorts, measures, and constraints."
            />
          ) : null}

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
              onClick={onContinue}
              disabled={!canContinue}
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

