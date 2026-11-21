"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChoiceCard } from "@/components/ChoiceCard";
import { TrainingOptOutTable } from "@/components/TrainingOptOutTable";
import { SetupShell } from "@/components/setup/SetupShell";
import { peggyApi, queryKeys, formatApiError } from "@/lib/api";
import { DocumentSeedDialog } from "@/components/DocumentSeedDialog";
import { DATA_TYPES, STUDY_TYPES } from "@/lib/studyDesign";
import { SETUP_COUNTRY_REGIONS, SETUP_SETTING_TYPES } from "@/lib/setupSettings";
import { useAuthSession } from "@/lib/authContext";
import { useWorkspace } from "@/lib/workspaceContext";

const PROJECT_TYPES = ["", ...STUDY_TYPES.filter((t) => t !== "Other"), "Longitudinal", "Clinical", "Other"];

const DATA_TYPE_OPTIONS = [
  ...DATA_TYPES.filter((t) => t !== "Other"),
  "Diet",
  "Gut microbiome",
  "Genetics",
  "Other",
];

type StartingPoint = "idea" | "gap" | "proposal";

export default function NewProjectPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { userId } = useAuthSession();
  const { setActiveWorkspaceId } = useWorkspace();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [aim, setAim] = useState("");
  const [projectType, setProjectType] = useState("");
  const [projectTypeOther, setProjectTypeOther] = useState("");
  const [researchField, setResearchField] = useState("");
  const [dataTypes, setDataTypes] = useState<string[]>([]);
  const [outcome, setOutcome] = useState("");
  const [startingPoint, setStartingPoint] = useState<StartingPoint>("idea");
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [countryOrRegion, setCountryOrRegion] = useState("");
  const [settingType, setSettingType] = useState("");
  const [population, setPopulation] = useState("");
  const [privacy, setPrivacy] = useState<"standard" | "strict">("standard");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string | null>(null);

  const resolvedType =
    projectType === "Other" ? projectTypeOther.trim() : projectType.trim();

  const canNext = useMemo(() => {
    if (step === 1) return title.trim().length > 0;
    if (step === 3) return privacy === "strict" || consent;
    return true;
  }, [step, title, privacy, consent]);

  const create = useMutation({
    mutationFn: async () => {
      const ws = await peggyApi.createWorkspace({
        title: title.trim() || "Untitled project",
        aim: aim.trim(),
        resources: { notes: "" },
        enabled_modules: ["core"],
        privacy_mode: privacy,
        last_opened_at: new Date().toISOString(),
        settings: {
          peer_reviewed_only: true,
          research_field: researchField.trim(),
          starting_point: startingPoint,
          country_or_region: countryOrRegion.trim(),
          setting_type: settingType.trim(),
          population: population.trim(),
        },
      });
      await peggyApi.patchStudyDesign(ws.id, {
        samples: {
          studyType: resolvedType,
          dataTypes,
          setting: [countryOrRegion.trim(), settingType.trim()].filter(Boolean).join(" · "),
        },
        analysisPlan: {
          outcomeTypes: outcome.trim(),
        },
      });
      return { ws };
    },
    onSuccess: ({ ws }) => {
      if (userId) void qc.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      setActiveWorkspaceId(ws.id);
      setCreatedWorkspaceId(ws.id);
      if (startingPoint === "proposal") {
        setStep(4);
        return;
      }
      router.push(startingPoint === "gap" ? "/validate/gap-analysis" : "/dashboard");
    },
    onError: (e: unknown) => setError(formatApiError(e)),
  });

  const subtitle =
    step === 4
      ? "Upload a proposal or brief to fill empty project fields."
      : step === 3
        ? "AI settings for this project."
        : step === 2
          ? "Where and in whom the study takes place. All optional."
          : "Name the project and describe what you are studying. Type and data types are optional.";

  return (
    <SetupShell title="New project" subtitle={subtitle} step={Math.min(step, 3)} totalSteps={3} showBackButton={false}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {step === 1 ? (
            <>
              <TextField
                label="Project name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <TextField
                select
                label="Project type (optional)"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
              >
                {PROJECT_TYPES.map((t) => (
                  <MenuItem key={t || "none"} value={t}>
                    {t || "Not set"}
                  </MenuItem>
                ))}
              </TextField>
              {projectType === "Other" ? (
                <TextField
                  label="Describe project type"
                  value={projectTypeOther}
                  onChange={(e) => setProjectTypeOther(e.target.value)}
                />
              ) : null}
              <TextField
                label="Research field"
                value={researchField}
                onChange={(e) => setResearchField(e.target.value)}
                placeholder="e.g. nutritional epidemiology"
              />
              <Autocomplete
                multiple
                freeSolo
                options={DATA_TYPE_OPTIONS}
                value={dataTypes}
                onChange={(_e, next) => setDataTypes(next.map((v) => String(v).trim()).filter(Boolean))}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return <Chip key={key} size="small" label={option} {...tagProps} />;
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Data type (optional)"
                    placeholder="Diet, gut microbiome, genetics… or type your own"
                  />
                )}
              />
              <TextField
                label="Outcome"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="e.g. incident type 2 diabetes"
              />
              {startingPoint === "idea" ? (
                <TextField
                  label="Aim (optional)"
                  value={aim}
                  onChange={(e) => setAim(e.target.value)}
                  multiline
                  minRows={2}
                  placeholder="What this project is trying to answer"
                />
              ) : null}
              <ChoiceCard
                title="Just an idea"
                description="You have a question or topic and want to start from there."
                selected={startingPoint === "idea"}
                onSelect={() => setStartingPoint("idea")}
              />
              <ChoiceCard
                title="Looking for a gap"
                description="You want to scan the literature for an open question."
                selected={startingPoint === "gap"}
                onSelect={() => setStartingPoint("gap")}
              />
              <ChoiceCard
                title="Already have a proposal"
                description="Upload a proposal or brief. After you create the project, empty fields can be filled from the document."
                selected={startingPoint === "proposal"}
                onSelect={() => setStartingPoint("proposal")}
              />
              {startingPoint === "proposal" ? (
                <Button component="label" variant="outlined" sx={{ textTransform: "none", alignSelf: "flex-start" }}>
                  {proposalFile ? proposalFile.name : "Upload proposal"}
                  <input
                    type="file"
                    hidden
                    accept=".pdf,.txt,.md,.html"
                    onChange={(e) => {
                      setProposalFile(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                </Button>
              ) : null}
            </>
          ) : null}
          {step === 2 ? (
            <>
              <Typography
                sx={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "text.secondary" }}
              >
                SETTING
              </Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel id="new-project-country-label">Country or region</InputLabel>
                  <Select
                    labelId="new-project-country-label"
                    label="Country or region"
                    value={countryOrRegion}
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
                  <InputLabel id="new-project-setting-label">Setting type</InputLabel>
                  <Select
                    labelId="new-project-setting-label"
                    label="Setting type"
                    value={settingType}
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
                label="Population"
                value={population}
                onChange={(e) => setPopulation(e.target.value)}
                fullWidth
                placeholder="e.g. adults aged 18 to 65"
              />
            </>
          ) : null}
          {step === 3 ? (
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
          {step < 4 ? (
            <Stack direction="row" justifyContent="space-between">
              <Button disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
              {step < 3 ? (
                <Button variant="contained" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                  Next
                </Button>
              ) : (
                <Button variant="contained" disabled={!canNext || create.isPending} onClick={() => create.mutate()}>
                  Create project
                </Button>
              )}
            </Stack>
          ) : (
            <Button variant="outlined" onClick={() => router.push("/dashboard")} sx={{ textTransform: "none" }}>
              Skip and go to dashboard
            </Button>
          )}
        </Stack>
      </Paper>
      <DocumentSeedDialog
        open={step === 4}
        closeLabel="Skip"
        initialFile={proposalFile}
        workspaceId={createdWorkspaceId ?? undefined}
        onClose={() => router.push("/dashboard")}
      />
    </SetupShell>
  );
}
