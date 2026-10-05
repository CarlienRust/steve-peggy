"use client";

import { useQuery } from "@tanstack/react-query";
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
import { StudyDesignSaveBar } from "@/features/study-design/StudyDesignSaveBar";
import { peggyApi, queryKeys } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import {
  COLLECTION_STATUSES,
  DATA_TYPES,
  IDENTIFIER_LEVELS,
  STUDY_TYPES,
  linkedDocumentsChanged,
  linkedDocumentsFromPapers,
} from "@/lib/studyDesign";
import { detectPhiFlags, phiWarningMessage } from "@/lib/sensitiveData";
import { SamplesUploadSection } from "@/features/study-design/SamplesUploadSection";

export function SamplesFeature() {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, saveSection, commitSection, isSectionDirty, savingSection } = useStudyDesign(
    activeWorkspace?.id
  );
  const samples = studyDesign.samples ?? {};
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});
  const datasets = useQuery({
    queryKey: queryKeys.corpus("sample_datasets", activeWorkspace?.id),
    queryFn: () => peggyApi.listCorpus("sample_datasets", activeWorkspace?.id),
    enabled: !!activeWorkspace?.id,
  });
  const datasetPapers = datasets.data?.papers ?? [];
  const uploadsChanged = linkedDocumentsChanged(samples.linkedDocuments, datasetPapers);

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to describe samples and datasets.</Alert>;
  }

  const onPhiBlur = (field: string, text: string) => {
    setFieldWarnings((prev) => ({ ...prev, [field]: phiWarningMessage(detectPhiFlags(text)) }));
  };

  return (
    <>
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

        <Typography variant="subtitle2" sx={{ pt: 1 }}>
          Cohort & recruitment
        </Typography>
        <TextField
          label="Recruitment"
          multiline
          minRows={2}
          placeholder="e.g. Consecutive adults at outpatient clinic; flyers in waiting area; referral from clinicians"
          value={samples.recruitment ?? ""}
          onChange={(e) => saveSection("samples", { recruitment: e.target.value })}
          onBlur={(e) => onPhiBlur("recruitment", e.target.value)}
          fullWidth
          error={!!fieldWarnings.recruitment}
          helperText={fieldWarnings.recruitment || "Sites, channels, and approach — no patient names."}
        />
        <TextField
          label="Inclusion criteria"
          multiline
          minRows={2}
          placeholder="e.g. Age 18–65; diagnosed T2D; HbA1c ≥ 7%; able to provide informed consent"
          value={samples.inclusionCriteria ?? ""}
          onChange={(e) => saveSection("samples", { inclusionCriteria: e.target.value })}
          onBlur={(e) => onPhiBlur("inclusionCriteria", e.target.value)}
          fullWidth
          error={!!fieldWarnings.inclusionCriteria}
          helperText={fieldWarnings.inclusionCriteria || "Who may participate — general terms only."}
        />
        <TextField
          label="Exclusion criteria"
          multiline
          minRows={2}
          placeholder="e.g. Pregnancy; active cancer treatment; unable to read English"
          value={samples.exclusionCriteria ?? ""}
          onChange={(e) => saveSection("samples", { exclusionCriteria: e.target.value })}
          onBlur={(e) => onPhiBlur("exclusionCriteria", e.target.value)}
          fullWidth
          error={!!fieldWarnings.exclusionCriteria}
          helperText={fieldWarnings.exclusionCriteria || "Who should not participate."}
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
          onBlur={(e) => onPhiBlur("summary", e.target.value)}
          fullWidth
          error={!!fieldWarnings.summary}
          helperText={fieldWarnings.summary || "Use aggregate descriptions only."}
        />
        {samples.identifierLevel === "identifiable" && (
          <Alert severity="error">
            Potentially identifiable data selected. AI guidance in Ethics, Methods, and Analysis is disabled until you
            switch to de-identified descriptions. Confirm ethics approval via{" "}
            <Link href="/study-design/ethics">Ethics</Link>.
          </Alert>
        )}
        <SamplesUploadSection />
        <StudyDesignSaveBar
          dirty={isSectionDirty("samples") || uploadsChanged}
          saving={savingSection === "samples"}
          note="Uploaded PDFs stay in your corpus. Save links them to this project and does not replace the fields you type."
          onSave={() =>
            commitSection("samples", { linkedDocuments: linkedDocumentsFromPapers(datasetPapers) })
          }
        />
      </Stack>
    </>
  );
}
