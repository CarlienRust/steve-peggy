import { BudgetFeature } from "@/features/study-design/BudgetFeature";
import { PageSection } from "@/components/PageSection";
import { StudyDesignShell } from "@/components/StudyDesignShell";

export default function BudgetPage() {
  return (
    <>
      <StudyDesignShell title="Budget" description="Line items, linked to objectives where they apply. Sample figures shown.">
        <PageSection>
          <BudgetFeature />
        </PageSection>
      </StudyDesignShell>
    </>
  );
}
