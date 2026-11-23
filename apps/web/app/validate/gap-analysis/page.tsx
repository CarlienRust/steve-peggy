import { GapsFeature } from "@/features/gaps/GapsFeature";
import { PageSection } from "@/components/PageSection";
import { ValidateShell } from "@/components/ValidateShell";

export default function ValidateGapAnalysisPage() {
  return (
    <>
      <ValidateShell title="Gap analysis" description="Thin evidence. Abstracts first.">
        <PageSection>
          <GapsFeature />
        </PageSection>
      </ValidateShell>
    </>
  );
}
