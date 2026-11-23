import { GapsFeature } from "@/features/gaps/GapsFeature";
import { PageSection } from "@/components/PageSection";
import { ValidateShell } from "@/components/ValidateShell";

export default function ValidateGapAnalysisPage() {
  return (
    <>
      <ValidateShell title="Gap analysis" description="Where evidence is thin. Abstracts first; full text when PDFs are in.">
        <PageSection>
          <GapsFeature />
        </PageSection>
      </ValidateShell>
    </>
  );
}
