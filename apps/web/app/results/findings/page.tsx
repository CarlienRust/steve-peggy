import { FindingsPage } from "@/features/findings/FindingsPage";
import { PageSection } from "@/components/PageSection";
import { ResultsShell } from "@/components/ResultsShell";

export default function ResultsFindingsPage() {
  return (
    <>
      <ResultsShell title="Upload and summary" description="Your findings, kept apart from the literature.">
        <PageSection>
          <FindingsPage />
        </PageSection>
      </ResultsShell>
    </>
  );
}
