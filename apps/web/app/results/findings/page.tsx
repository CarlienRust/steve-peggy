import { FindingsManagement } from "@/features/findings/FindingsManagement";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";
import { ProjectAimSection } from "@/components/ProjectAimSection";

export default function ResultsFindingsPage() {
  return (
    <>
      <PageHeader
        compact
        title="Our findings"
        description="Cohort results and narrative summaries."
        descriptionTooltip="Compared against literature in gap analysis and comparison."
      />
      <ProjectAimSection />
      <PageSection>
        <FindingsManagement />
      </PageSection>
    </>
  );
}
