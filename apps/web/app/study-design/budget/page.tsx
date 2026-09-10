import { BudgetFeature } from "@/features/study-design/BudgetFeature";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";

export default function BudgetPage() {
  return (
    <>
      <PageHeader compact title="Budget" description="Funding overview and spending constraints for your study." />
      <PageSection>
        <BudgetFeature />
      </PageSection>
    </>
  );
}
