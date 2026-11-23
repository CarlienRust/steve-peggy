import { CompareFeature } from "@/features/compare/CompareFeature";
import { PageSection } from "@/components/PageSection";
import { ResultsShell } from "@/components/ResultsShell";

export default function ResultsComparisonPage() {
  return (
    <>
      <ResultsShell title="Comparison" description="Your findings vs the literature.">
        <PageSection>
          <CompareFeature />
        </PageSection>
      </ResultsShell>
    </>
  );
}
