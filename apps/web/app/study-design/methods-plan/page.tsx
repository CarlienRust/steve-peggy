import { PlannerFeature } from "@/features/study-design/PlannerFeature";
import { PageSection } from "@/components/PageSection";
import { StudyDesignShell } from "@/components/StudyDesignShell";

export default function MethodsPlanPage() {
  return (
    <>
      <StudyDesignShell
        title="Methods plan"
        description="Peggy fills in what it can from your project. Add your own plan to get a review."
      >
        <PageSection>
          <PlannerFeature section="methods" />
        </PageSection>
      </StudyDesignShell>
    </>
  );
}
