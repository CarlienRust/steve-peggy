import { Alert } from "@mui/material";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";

export default function AnalysisToolPage() {
  return (
    <>
      <PageHeader eyebrow="04 · Analysis tool" title="Analysis tool" description="Interactive analysis workspace. Coming soon." />
      <PageSection>
        <Alert severity="info">Coming soon.</Alert>
      </PageSection>
    </>
  );
}
