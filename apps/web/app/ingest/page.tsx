import { CorpusManagement } from "@/features/ingest/CorpusManagement";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";

export default function IngestPage() {
  return (
    <>
      <PageHeader eyebrow="02 · Corpus" title="Research corpus" description="PubMed and PDF literature." />
      <PageSection>
        <CorpusManagement />
      </PageSection>
    </>
  );
}
