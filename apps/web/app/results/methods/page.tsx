import { Alert } from "@mui/material";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";

export default function ResultsMethodsPage() {
  return (
    <>
      <PageHeader compact title="Methods" description="Retrospective methods write-up for manuscripts." />
      <PageSection>
        <Alert severity="info">Coming soon.</Alert>
      </PageSection>
    </>
  );
}
