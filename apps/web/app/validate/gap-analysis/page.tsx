import { GapsFeature } from "@/features/gaps/GapsFeature";
import { PageSection } from "@/components/PageSection";
import { ValidateShell } from "@/components/ValidateShell";

export default function ValidateGapAnalysisPage() {
  return (
    <>
      <ValidateShell title="Gap analysis" description="Where the evidence is thin. Run a quick scan on abstracts or full-text analysis when enough PDFs are ingested.">
        <PageSection>
          <GapsFeature />
        </PageSection>
      </ValidateShell>
    </>
  );
}
