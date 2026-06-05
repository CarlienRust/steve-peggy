"use client";

import { useQuery } from "@tanstack/react-query";
import AddIcon from "@mui/icons-material/Add";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { peggyApi, queryKeys } from "@/lib/api";
import { monoSx } from "@/theme/peggyTheme";
import { CorpusTable } from "@/features/ingest/CorpusTable";
import { FindingsModal } from "@/features/findings/FindingsModal";

export function FindingsManagement() {
  const [open, setOpen] = useState(false);
  const findings = useQuery({
    queryKey: queryKeys.corpus("own_findings"),
    queryFn: () => peggyApi.listCorpus("own_findings"),
  });
  const papers = findings.data?.papers ?? [];

  return (
    <>
      <Alert severity="info" sx={{ mb: 3 }}>
        Our findings are kept separate from the literature corpus. Peggy uses them as the baseline for comparison and can
        include them in gap analysis alongside published research.
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
        emptyMessage='No findings yet. Add a narrative summary or upload your research PDF under "Add our findings".'
        typeLabel={() => "Our findings"}
      />

      <FindingsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
