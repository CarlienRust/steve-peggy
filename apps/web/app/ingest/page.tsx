import { IngestFeature } from "@/features/ingest/IngestFeature";
import { PageHeader } from "@/components/PageHeader";
import { Paper } from "@mui/material";

export default function IngestPage() {
  return (
    <>
      <PageHeader
        eyebrow="02 · Ingest corpus"
        title="Ingest corpus"
        description="Paste PMIDs, DOIs, or run a PubMed search. Upload internal datasets as narrative findings."
      />
      <Paper sx={{ p: 3 }}>
        <IngestFeature />
      </Paper>
    </>
  );
}
