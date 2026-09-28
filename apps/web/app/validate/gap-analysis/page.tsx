import { GapsFeature } from "@/features/gaps/GapsFeature";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";

export default function ValidateGapAnalysisPage() {
  return (
    <>
      <PageHeader compact title="Gap analysis" description="Understudied topics and contradictions in your corpus." />
      <PageSection>
        <GapsFeature />
      </PageSection>
    </>
  );
}
