import { FindingsSummary } from "@/features/findings/FindingsSummary";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";
import { ProjectAimSection } from "@/components/ProjectAimSection";

export default function ResultsFindingsPage() {
  return (
    <>
      <PageHeader
        compact
        title="Our findings"
        description="What has been found so far, from your uploaded reports."
        descriptionTooltip="Compared against literature in gap analysis and comparison."
      />
      <ProjectAimSection />
      <PageSection>
        <FindingsSummary />
      </PageSection>
    </>
  );
}
