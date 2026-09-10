import { PlannerFeature } from "@/features/study-design/PlannerFeature";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";

export default function AnalysisPlanPage() {
  return (
    <>
      <PageHeader compact title="Analysis plan" description="Pre-specified statistics, models, and software." />
      <PageSection>
        <PlannerFeature section="analysis" />
      </PageSection>
    </>
  );
}
