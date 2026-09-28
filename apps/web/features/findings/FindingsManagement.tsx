"use client";

import { useQuery } from "@tanstack/react-query";
import AddIcon from "@mui/icons-material/Add";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { peggyApi, queryKeys } from "@/lib/api";
import { linkTargetOptions, normalizeObjectives } from "@/lib/objectives";
import { monoSx } from "@/theme/peggyTheme";
import { CorpusTable } from "@/features/ingest/CorpusTable";
import { FindingsModal } from "@/features/findings/FindingsModal";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { useWorkspace } from "@/lib/workspaceContext";
import { pruneFindingLinks, upsertFindingLink } from "@/lib/studyDesign";

export function FindingsManagement() {
  const [open, setOpen] = useState(false);
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, commitSection } = useStudyDesign(activeWorkspace?.id);
  const findings = useQuery({
    queryKey: queryKeys.corpus("own_findings"),
    queryFn: () => peggyApi.listCorpus("own_findings"),
  });
  const papers = findings.data?.papers ?? [];
  const findingLinks = studyDesign.objectiveLinks?.findingLinks ?? [];
  const objectives = normalizeObjectives(activeWorkspace?.objectives);
  const linkOptions = linkTargetOptions(activeWorkspace?.aim, objectives);

  const saveFindingLinks = async (paperId: number, objectiveIds: string[]) => {
    const nextLinks = upsertFindingLink(findingLinks, paperId, objectiveIds);
    await commitSection("objectiveLinks", { findingLinks: nextLinks });
  };

  const onDeletePaper = async (paperId: number) => {
    const remainingIds = papers.filter((p) => p.id !== paperId).flatMap((p) => (p.id == null ? [] : [p.id]));
    const nextLinks = pruneFindingLinks(findingLinks, remainingIds);
    if (nextLinks.length !== findingLinks.length) {
      await commitSection("objectiveLinks", { findingLinks: nextLinks });
    }
  };

  return (
    <>
      <Alert severity="info" sx={{ mb: 3 }}>
        Our findings stay separate from the literature corpus. New uploads update the summary on Our findings. Tag each set to objectives from the table.
      </Alert>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography sx={{ ...monoSx, fontSize: 12, color: "text.secondary" }}>
          {papers.length} finding set{papers.length === 1 ? "" : "s"}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Add our findings
        </Button>
      </Stack>

      <CorpusTable
        papers={papers}
        emptyMessage='No findings yet. Add a narrative, or upload a PDF or HTML file.'
        typeLabel={() => "Our findings"}
        findingLinks={findingLinks}
        linkOptions={linkOptions}
        onSaveFindingLinks={saveFindingLinks}
        onDeletePaper={onDeletePaper}
      />

      <FindingsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
