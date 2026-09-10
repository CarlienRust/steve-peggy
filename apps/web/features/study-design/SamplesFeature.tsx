"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Alert,
  Autocomplete,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataSafetyBanner } from "@/components/DataSafetyBanner";
import { PageHeader } from "@/components/PageHeader";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import {
  COLLECTION_STATUSES,
  DATA_TYPES,
  IDENTIFIER_LEVELS,
  STUDY_TYPES,
} from "@/lib/studyDesign";
import { detectPhiFlags, phiWarningMessage } from "@/lib/sensitiveData";
import { SamplesUploadSection } from "@/features/study-design/SamplesUploadSection";

export function SamplesFeature() {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, saveSection, isSaving } = useStudyDesign(activeWorkspace?.id);
  const samples = studyDesign.samples ?? {};
  const [summaryWarning, setSummaryWarning] = useState("");

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to describe samples and datasets.</Alert>;
  }

  const onSummaryBlur = (text: string) => {
    const flags = detectPhiFlags(text);
    setSummaryWarning(phiWarningMessage(flags));
  };

  return (
    <>
      <PageHeader
        title="Samples & datasets"
        description="Describe cohort and data in general terms. Optional file upload — confirm ethics approval at your own risk."
      />
      <DataSafetyBanner />
      <Stack spacing={2}>
        <TextField
          select
          label="Study type"
          value={samples.studyType ?? ""}
          onChange={(e) => saveSection("samples", { studyType: e.target.value })}
          SelectProps={{ native: true }}
          fullWidth
        >
          <option value="" />
          {STUDY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </TextField>
        <TextField
          label="Expected sample size (N)"
          placeholder="e.g. 45 or 100–200"
          value={samples.expectedN ?? ""}
          onChange={(e) => saveSection("samples", { expectedN: e.target.value })}
          fullWidth
        />
        <Autocomplete
          multiple
          options={[...DATA_TYPES]}
          value={samples.dataTypes ?? []}
          onChange={(_, v) => saveSection("samples", { dataTypes: v })}
          renderInput={(params) => <TextField {...params} label="Data types" />}
        />
        <TextField
          select
          label="Collection status"
          value={samples.collectionStatus ?? ""}
          onChange={(e) => saveSection("samples", { collectionStatus: e.target.value })}
          SelectProps={{ native: true }}
          fullWidth
        >
          <option value="" />
          {COLLECTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </TextField>
        <TextField
          select
          label="Identifier level"
          value={samples.identifierLevel ?? "de_identified"}
          onChange={(e) => saveSection("samples", { identifierLevel: e.target.value })}
          SelectProps={{ native: true }}
          fullWidth
          helperText="Choose de-identified unless you have ethics approval for identifiable data."
        >
          {IDENTIFIER_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </TextField>
        <TextField
          label="General summary"
          multiline
          minRows={4}
          placeholder="Describe data sources and variables in general terms — no names, MRNs, or dates of birth."
          value={samples.summary ?? ""}
          onChange={(e) => saveSection("samples", { summary: e.target.value })}
          onBlur={(e) => onSummaryBlur(e.target.value)}
          fullWidth
          error={!!summaryWarning}
          helperText={summaryWarning || "Use aggregate descriptions only."}
        />
        {samples.identifierLevel === "identifiable" && (
          <Alert severity="error">
            Potentially identifiable data selected. AI guidance in Ethics, Methods, and Analysis is disabled until you
            switch to de-identified descriptions. Confirm ethics approval via{" "}
            <Link href="/study-design/ethics">Ethics</Link>.
          </Alert>
        )}
        {isSaving && (
          <Typography variant="caption" color="text.secondary">
            Saving…
          </Typography>
        )}

        <SamplesUploadSection />
      </Stack>
    </>
  );
}
