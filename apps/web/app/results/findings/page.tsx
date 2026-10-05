import { FindingsPage } from "@/features/findings/FindingsPage";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";
import { ProjectAimSection } from "@/components/ProjectAimSection";

export default function ResultsFindingsPage() {
  return (
    <>
      <PageHeader
        compact
        title="Findings"
        description="Upload your results, read the summary, and tag findings to objectives."
        descriptionTooltip="Compared against literature in gap analysis and comparison."
      />
      <ProjectAimSection />
      <PageSection>
        <FindingsPage />
      </PageSection>
    </>
  );
}
