"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
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
import { peggyApi, queryKeys, formatApiError, type WorkflowResponse } from "@/lib/api";
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
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gapResult, setGapResult] = useState<WorkflowResponse | null>(null);
  const [seedPreview, setSeedPreview] = useState<Record<string, unknown> | null>(null);
  const [ideaDescription, setIdeaDescription] = useState("");
  const [projectIdea, setProjectIdea] = useState("");
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  const resolvedType =
    projectType === "Other" ? projectTypeOther.trim() : projectType.trim();

  const missingDetails = [
    dataTypes.length ? "" : "Data type",
    outcome.trim() ? "" : "Outcome",
    aim.trim() ? "" : "Aim",
    countryOrRegion.trim() ? "" : "Country or region",
    settingType.trim() ? "" : "Setting type",
    population.trim() ? "" : "Population",
  ].filter(Boolean);

  const canNext = useMemo(() => {
    if (step === 1) return title.trim().length > 0;
    if (step === 3) return privacy === "strict" || consent;
    return true;
  }, [step, title, privacy, consent]);

  const persist = async (id: string) => {
    await peggyApi.updateWorkspace(id, {
      title: title.trim() || "Untitled project",
      aim: aim.trim(),
      settings: {
        peer_reviewed_only: true,
        research_field: researchField.trim(),
        starting_point: startingPoint,
        country_or_region: countryOrRegion.trim(),
        setting_type: settingType.trim(),
        population: population.trim(),
        project_idea: (startingPoint === "gap" ? projectIdea : ideaDescription).trim(),
      },
    });
    await peggyApi.patchStudyDesign(id, {
      samples: {
        studyType: resolvedType,
        dataTypes,
        setting: [countryOrRegion.trim(), settingType.trim()].filter(Boolean).join(" · "),
        population: population.trim(),
      },
      analysisPlan: { outcomeTypes: outcome.trim() },
    });
  };

  const ensureWorkspace = async () => {
    if (workspaceId) {
      await persist(workspaceId);
      return workspaceId;
    }
    const ws = await peggyApi.createWorkspace({
      title: title.trim() || "Untitled project",
      aim: aim.trim(),
      resources: { notes: "" },
      enabled_modules: ["core"],
      privacy_mode: "standard",
      last_opened_at: new Date().toISOString(),
      settings: {
        peer_reviewed_only: true,
        research_field: researchField.trim(),
        starting_point: startingPoint,
        country_or_region: "",
        setting_type: "",
        population: "",
      },
    });
    await peggyApi.patchStudyDesign(ws.id, {
      samples: { studyType: resolvedType, dataTypes: [] },
    });
    if (userId) void qc.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
    setActiveWorkspaceId(ws.id);
    setWorkspaceId(ws.id);
    return ws.id;
  };

  const applySuggestionBody = (body: Record<string, unknown>, onlyEmpty: boolean) => {
    const types = Array.isArray(body.dataTypes)
      ? body.dataTypes.map((v) => String(v).trim()).filter(Boolean)
      : [];
    const nextAim = String(body.aim ?? "").trim();
    const nextOutcome = String(body.outcome ?? "").trim();
    const nextCountry = String(body.countryOrRegion ?? "").trim();
    const nextSetting = String(body.settingType ?? "").trim();
    const nextPop = String(body.population ?? "").trim();
    if (types.length && (!onlyEmpty || dataTypes.length === 0)) setDataTypes(types);
    if (nextAim && (!onlyEmpty || !aim.trim())) setAim(nextAim);
    if (nextOutcome && (!onlyEmpty || !outcome.trim())) setOutcome(nextOutcome);
    if (nextCountry && SETUP_COUNTRY_REGIONS.includes(nextCountry as (typeof SETUP_COUNTRY_REGIONS)[number])) {
      if (!onlyEmpty || !countryOrRegion.trim()) setCountryOrRegion(nextCountry);
    }
    if (nextSetting && SETUP_SETTING_TYPES.includes(nextSetting as (typeof SETUP_SETTING_TYPES)[number])) {
      if (!onlyEmpty || !settingType.trim()) setSettingType(nextSetting);
    }
    if (nextPop && (!onlyEmpty || !population.trim())) setPopulation(nextPop);
  };

  const applySeedPreview = (preview: Record<string, unknown>) => {
    setSeedPreview(preview);
    const samples = (preview.samples && typeof preview.samples === "object" ? preview.samples : {}) as Record<
      string,
      string
    >;
    applySuggestionBody(
      {
        aim: preview.aim,
        outcome: preview.outcome,
        dataTypes: preview.dataTypes,
        countryOrRegion: preview.countryOrRegion,
        settingType: preview.settingType,
        population: preview.population,
      },
      true
    );
    const seedAim = String(preview.aim ?? "").trim();
    if (seedAim && !aim.trim()) setAim(seedAim);
    if (samples.studyType && !resolvedType) setProjectType(samples.studyType);
    if (samples.setting && !settingType.trim() && !countryOrRegion.trim()) {
      const hit = SETUP_SETTING_TYPES.find((s) => samples.setting.toLowerCase().includes(s.toLowerCase()));
      if (hit) setSettingType(hit);
    }
    if (preview.population && !population.trim()) setPopulation(String(preview.population));
  };

  const runIdeaSuggestions = async () => {
    if (!workspaceId) return;
    setBusy(true);
    setError(null);
    try {
      await persist(workspaceId);
      const res = await peggyApi.setupSuggestions(workspaceId, ideaDescription);
      applySuggestionBody(res.body, true);
      setSuggestionsLoaded(true);
    } catch (e: unknown) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const runGapScan = async () => {
    const id = await ensureWorkspace();
    await persist(id);
    setBusy(true);
    setError(null);
    try {
      const q = [projectIdea, title, researchField, aim, outcome, population, countryOrRegion, settingType]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" ");
      const res = await peggyApi.gapAnalysis(q || title.trim(), {
        workspaceId: id,
        sourceTypes: ["literature"],
        abstractsOnly: true,
      });
      setGapResult(res);
    } catch (e: unknown) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const finish = useMutation({
    mutationFn: async () => {
      const id = await ensureWorkspace();
      await persist(id);
      await peggyApi.updateWorkspace(id, { privacy_mode: privacy });
      return id;
    },
    onSuccess: () => {
      if (userId) void qc.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      router.push("/dashboard");
    },
    onError: (e: unknown) => setError(formatApiError(e)),
  });

  const onNextFrom1 = async () => {
    setError(null);
    setBusy(true);
    try {
      await ensureWorkspace();
      setStep(2);
    } catch (e: unknown) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onNextFrom2 = async () => {
    setError(null);
    setBusy(true);
    try {
      const id = await ensureWorkspace();
      await persist(id);
      if (startingPoint === "proposal" && proposalFile && !seedPreview) {
        const up = await peggyApi.uploadDocument(proposalFile, {
          title: proposalFile.name.replace(/\.(pdf|html|htm|txt|md)$/i, ""),
          sourceType: "project_documents",
          workspaceId: id,
        });
        if (!up.paper_id) throw new Error("Upload did not return a document id.");
        const seeded = await peggyApi.seedFromDocument({ workspaceId: id, paperId: up.paper_id });
        applySeedPreview(seeded.preview);
        return;
      }
      if (startingPoint === "proposal" && seedPreview) {
        await peggyApi.applyDocumentSeed({ workspaceId: id, preview: seedPreview, overwrite: false });
        await persist(id);
      }
      setStep(3);
    } catch (e: unknown) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const gapTopics = useMemo(() => {
    const raw = gapResult?.body?.gaps;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((g) => {
        if (!g || typeof g !== "object") return "";
        const rec = g as Record<string, unknown>;
        return String(rec.topic ?? rec.gap ?? rec.title ?? "").trim();
      })
      .filter(Boolean)
      .slice(0, 8);
  }, [gapResult]);

  const subtitle =
    step === 3
      ? "AI settings for this project."
      : step === 2 && startingPoint === "gap"
        ? "Add what you already know, then scan for a gap before AI settings."
        : step === 2 && startingPoint === "proposal"
          ? "Fill what you know, upload the proposal, and check the auto-fill before AI settings."
          : step === 2
            ? "Suggestions from your name, type, and field. Edit anything that is wrong."
            : "Name, type, field, and how you want to start.";

  const detailFields = (
    <>
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
          <TextField {...params} label="Data type" placeholder="Diet, gut microbiome, genetics… or type your own" />
        )}
      />
      <TextField
        label="Outcome"
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        placeholder="e.g. incident type 2 diabetes"
      />
      <TextField
        label="Aim"
        value={aim}
        onChange={(e) => setAim(e.target.value)}
        multiline
        minRows={2}
        placeholder="What this project is trying to answer"
      />
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
  );

  return (
    <SetupShell title="New project" subtitle={subtitle} step={step} totalSteps={3} showBackButton={false}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {busy ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                {startingPoint === "proposal" && step === 2 && !seedPreview
                  ? "Reading proposal…"
                  : "Working…"}
              </Typography>
            </Stack>
          ) : null}
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
                label="Project type"
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
                description="Upload a proposal. You will review auto-filled fields before AI settings."
                selected={startingPoint === "proposal"}
                onSelect={() => setStartingPoint("proposal")}
              />
            </>
          ) : null}
          {step === 2 ? (
            <>
              {startingPoint === "idea" ? (
                <>
                  <Alert severity="info">
                    Describe your idea, then run suggestions. Uses hosted AI on your description plus step 1 fields.
                    Edit anything that is wrong before AI settings.
                  </Alert>
                  <TextField
                    label="Describe your idea"
                    value={ideaDescription}
                    onChange={(e) => setIdeaDescription(e.target.value)}
                    multiline
                    minRows={3}
                    fullWidth
                    placeholder="What you want to study, why, and any constraints"
                  />
                  <Button
                    variant="outlined"
                    disabled={busy || !ideaDescription.trim()}
                    onClick={() => void runIdeaSuggestions()}
                    sx={{ alignSelf: "flex-start", textTransform: "none" }}
                  >
                    Suggest fields from my idea
                  </Button>
                  {suggestionsLoaded ? (
                    <Alert severity="success">Suggestions loaded. Check the fields below.</Alert>
                  ) : null}
                </>
              ) : null}
              {startingPoint === "gap" ? (
                <>
                  <Alert severity="info">
                    Add what you know. Gap scan uses public peer-reviewed abstracts (no project PDFs required). Fill:{" "}
                    {missingDetails.length ? missingDetails.join(", ") : "optional fields as needed"}.
                  </Alert>
                  <TextField
                    label="Project idea"
                    value={projectIdea}
                    onChange={(e) => setProjectIdea(e.target.value)}
                    multiline
                    minRows={2}
                    fullWidth
                    placeholder="The question or gap you are exploring"
                  />
                  <Button
                    variant="outlined"
                    disabled={busy}
                    onClick={() => void runGapScan()}
                    sx={{ alignSelf: "flex-start", textTransform: "none" }}
                  >
                    Look for a gap
                  </Button>
                </>
              ) : null}
              {startingPoint === "proposal" ? (
                <Alert severity="info">
                  Upload a proposal, then check the filled fields. Next reads the file if you have not yet; Next
                  again saves what you reviewed.
                </Alert>
              ) : null}
              {detailFields}
              {startingPoint === "proposal" ? (
                <Button component="label" variant="outlined" sx={{ textTransform: "none", alignSelf: "flex-start" }}>
                  {proposalFile ? proposalFile.name : "Upload proposal"}
                  <input
                    type="file"
                    hidden
                    accept=".pdf,.txt,.md,.html"
                    onChange={(e) => {
                      setProposalFile(e.target.files?.[0] ?? null);
                      setSeedPreview(null);
                      e.target.value = "";
                    }}
                  />
                </Button>
              ) : null}
              {startingPoint === "proposal" && seedPreview ? (
                <Alert severity="success">Auto-fill loaded. Check the fields above before you continue.</Alert>
              ) : null}
              {startingPoint === "gap" && gapTopics.length > 0 ? (
                <Alert severity="success">
                  Gap scan: {gapTopics.join("; ")}
                </Alert>
              ) : null}
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
          <Stack direction="row" justifyContent="space-between">
            <Button
              disabled={step === 1 || busy}
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </Button>
            {step === 1 ? (
              <Button variant="contained" disabled={!canNext || busy} onClick={() => void onNextFrom1()}>
                Next
              </Button>
            ) : step === 2 ? (
              <Button variant="contained" disabled={busy} onClick={() => void onNextFrom2()}>
                Next
              </Button>
            ) : (
              <Button variant="contained" disabled={!canNext || finish.isPending} onClick={() => finish.mutate()}>
                Save and open project
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>
    </SetupShell>
  );
}
