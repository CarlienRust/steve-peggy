import { ValidateAimFeature } from "@/features/validate/ValidateAimFeature";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";

export default function ValidateAimPage() {
  return (
    <>
      <PageHeader
        compact
        title="Validate aim and objectives"
        description="Check wording and fit against literature you have ingested."
      />
      <PageSection>
        <ValidateAimFeature />
      </PageSection>
    </>
  );
}
