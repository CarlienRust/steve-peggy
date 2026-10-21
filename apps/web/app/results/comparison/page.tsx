import { CompareFeature } from "@/features/compare/CompareFeature";
import { PageSection } from "@/components/PageSection";
import { ResultsShell } from "@/components/ResultsShell";

export default function ResultsComparisonPage() {
  return (
    <>
      <ResultsShell title="Comparison" description="Compare your uploaded findings against the literature. Sample data shown.">
        <PageSection>
          <CompareFeature />
        </PageSection>
      </ResultsShell>
    </>
  );
}
