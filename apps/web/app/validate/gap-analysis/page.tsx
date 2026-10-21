import { GapsFeature } from "@/features/gaps/GapsFeature";
import { PageSection } from "@/components/PageSection";
import { ValidateShell } from "@/components/ValidateShell";

export default function ValidateGapAnalysisPage() {
  return (
    <>
      <ValidateShell title="Gap analysis" description="Where the evidence is thin. Sample data shown.">
        <PageSection>
          <GapsFeature />
        </PageSection>
      </ValidateShell>
    </>
  );
}
