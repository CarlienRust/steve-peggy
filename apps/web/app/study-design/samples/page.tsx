import { SamplesFeature } from "@/features/study-design/SamplesFeature";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";

export default function SamplesPage() {
  return (
    <>
      <PageHeader compact title="Samples & datasets" description="Cohort profile and optional dataset uploads." />
      <PageSection>
        <SamplesFeature />
      </PageSection>
    </>
  );
}
