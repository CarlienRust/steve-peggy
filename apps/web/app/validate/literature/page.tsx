import { CorpusManagement } from "@/features/ingest/CorpusManagement";
import { PageSection } from "@/components/PageSection";
import { ValidateShell } from "@/components/ValidateShell";

export default function ValidateLiteraturePage() {
  return (
    <>
      <ValidateShell title="Literature search" description="Papers in this project. Sample data shown.">
        <PageSection>
          <CorpusManagement />
        </PageSection>
      </ValidateShell>
    </>
  );
}
