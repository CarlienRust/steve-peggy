import { FindingsManagement } from "@/features/findings/FindingsManagement";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";

export default function ReportFindingsPage() {
  return (
    <>
      <PageHeader
        compact
        title="Upload/Report findings"
        description="Narrative, PDF, or HTML. Each upload updates the Our findings summary."
      />
      <PageSection>
        <FindingsManagement />
      </PageSection>
    </>
  );
}
