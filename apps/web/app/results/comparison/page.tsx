import { CompareFeature } from "@/features/compare/CompareFeature";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";

export default function ResultsComparisonPage() {
  return (
    <>
      <PageHeader compact title="Comparison" description="Your finding vs ingested literature." />
      <PageSection>
        <CompareFeature />
      </PageSection>
    </>
  );
}
