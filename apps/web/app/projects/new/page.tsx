"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChoiceCard } from "@/components/ChoiceCard";
import { TrainingOptOutTable } from "@/components/TrainingOptOutTable";
import { ModuleToggleRow } from "@/components/ModuleToggleRow";
import { SetupShell } from "@/components/setup/SetupShell";
import { peggyApi, queryKeys, formatApiError } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { saveActiveWorkspaceId } from "@/lib/userProfile";

const MODULES = [
  { id: "core", label: "Core", description: "Literature, findings, Ask Peggy", required: true },
  { id: "study-design", label: "Study design", description: "Samples, ethics, methods, analysis" },
  { id: "calendar", label: "Calendar", description: "Deadlines and meetings" },
];

export default function NewProjectPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { userId } = useAuthSession();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [resources, setResources] = useState("");
  const [privacy, setPrivacy] = useState<"standard" | "strict">("standard");
  const [modules, setModules] = useState<string[]>(["core", "study-design"]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canNext = useMemo(() => {
    if (step === 2) return title.trim().length > 0;
    if (step === 4) return privacy === "strict" || consent;
    return true;
  }, [step, title, privacy, consent]);

  const create = useMutation({
    mutationFn: () =>
      peggyApi.createWorkspace({
        title: title.trim() || "Untitled project",
        aim: idea.trim(),
        resources: { notes: resources.trim() },
        enabled_modules: modules,
        privacy_mode: privacy,
        last_opened_at: new Date().toISOString(),
        settings: { peer_reviewed_only: true },
      }),
    onSuccess: (ws) => {
      if (userId) void qc.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      saveActiveWorkspaceId(ws.id);
      router.push("/dashboard");
    },
    onError: (e: unknown) => setError(formatApiError(e)),
  });

  return (
    <SetupShell title="New project" subtitle="Four short steps. You can change this later." step={step} showBackButton={false}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {step === 1 ? (
            <>
              <TextField label="Idea or gap" multiline minRows={3} value={idea} onChange={(e) => setIdea(e.target.value)} />
              <TextField label="Resources you already have" multiline minRows={2} value={resources} onChange={(e) => setResources(e.target.value)} />
            </>
          ) : null}
          {step === 2 ? (
            <TextField label="Project title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          ) : null}
          {step === 3 ? (
            <Box>
              {MODULES.map((m) => (
                <ModuleToggleRow
                  key={m.id}
                  label={m.label}
                  description={m.description}
                  required={m.required}
                  checked={modules.includes(m.id)}
                  onChange={(on) =>
                    setModules((prev) => (on ? Array.from(new Set([...prev, m.id])) : prev.filter((x) => x !== m.id)))
                  }
                />
              ))}
            </Box>
          ) : null}
          {step === 4 ? (
            <>
              <ChoiceCard
                title="Standard (recommended)"
                description="Ask Peggy, planners, and abstracts stay on. Project text may go to Render, Supabase, Qdrant Cloud, and Gemini. Opt out of provider training in that account (Gemini: turn off Keep Activity). Peggy cannot verify the setting."
                selected={privacy === "standard"}
                onSelect={() => setPrivacy("standard")}
                tag={{ label: "Hosted AI", tone: "warning" }}
              />
              <ChoiceCard
                title="Strict (AI help off)"
                description="Use this only if this project must not send aim, plans, findings, or dataset summaries to a hosted model. Search and saved records still work. You can switch back to Standard later from your profile menu under Peggy AI settings."
                selected={privacy === "strict"}
                onSelect={() => setPrivacy("strict")}
                tag={{ label: "No project AI", tone: "neutral" }}
              />
              {privacy === "standard" ? <TrainingOptOutTable /> : null}
              {privacy === "standard" ? (
                <FormControlLabel
                  control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} />}
                  label="I have turned off provider training (or I accept the risk)."
                />
              ) : null}
            </>
          ) : null}
          <Stack direction="row" justifyContent="space-between">
            <Button disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            {step < 4 ? (
              <Button variant="contained" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            ) : (
              <Button variant="contained" disabled={!canNext || create.isPending} onClick={() => create.mutate()}>
                Create project
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>
    </SetupShell>
  );
}
