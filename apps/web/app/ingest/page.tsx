import { CorpusManagement } from "@/features/ingest/CorpusManagement";
import { PageHeader } from "@/components/PageHeader";
import { Paper } from "@mui/material";

export default function IngestPage() {
  return (
    <>
      <PageHeader
        eyebrow="02 · Corpus"
        title="Research corpus"
        description="Peer-reviewed literature only — PubMed and PDF papers. Add your own work under Our findings."
      />
      <Paper sx={{ p: 3 }}>
        <CorpusManagement />
      </Paper>
    </>
  );
}
