import { PlannerFeature } from "@/features/study-design/PlannerFeature";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";

export default function MethodsPlanPage() {
  return (
    <>
      <PageHeader compact title="Methods plan" description="Review or draft prospective study methods." />
      <PageSection>
        <PlannerFeature section="methods" />
      </PageSection>
    </>
  );
}
