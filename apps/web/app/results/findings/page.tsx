import { FindingsPage } from "@/features/findings/FindingsPage";
import { PageSection } from "@/components/PageSection";
import { ResultsShell } from "@/components/ResultsShell";

export default function ResultsFindingsPage() {
  return (
    <>
      <ResultsShell title="Upload and summary" description="Add your findings. Peggy keeps them apart from the literature. Sample data shown.">
        <PageSection>
          <FindingsPage />
        </PageSection>
      </ResultsShell>
    </>
  );
}
