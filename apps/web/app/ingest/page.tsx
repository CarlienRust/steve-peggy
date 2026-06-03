import { CorpusManagement } from "@/features/ingest/CorpusManagement";
import { PageHeader } from "@/components/PageHeader";
import { Paper } from "@mui/material";

export default function IngestPage() {
  return (
    <>
      <PageHeader
        eyebrow="02 · Corpus"
        title="Research corpus"
        description="View, edit, and remove ingested literature and internal datasets. Add new sources via the ingest dialog."
      />
      <Paper sx={{ p: 3 }}>
        <CorpusManagement />
      </Paper>
    </>
  );
}
