import { CorpusManagement } from "@/features/ingest/CorpusManagement";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";

export default function ValidateLiteraturePage() {
  return (
    <>
      <PageHeader compact title="Literature search" description="PubMed and PDF literature." />
      <PageSection>
        <CorpusManagement />
      </PageSection>
    </>
  );
}
