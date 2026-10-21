import { SamplesFeature } from "@/features/study-design/SamplesFeature";
import { PageSection } from "@/components/PageSection";
import { StudyDesignShell } from "@/components/StudyDesignShell";

export default function SamplesPage() {
  return (
    <>
      <StudyDesignShell title="Samples and datasets" description="Describe your cohort. Add de-identified datasets Peggy can use.">
        <PageSection>
          <SamplesFeature />
        </PageSection>
      </StudyDesignShell>
    </>
  );
}
