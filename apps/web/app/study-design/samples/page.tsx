import { SamplesFeature } from "@/features/study-design/SamplesFeature";
import { PageSection } from "@/components/PageSection";
import { StudyDesignShell } from "@/components/StudyDesignShell";

export default function SamplesPage() {
  return (
    <>
      <StudyDesignShell title="Samples and datasets" description="Cohort and de-identified datasets.">
        <PageSection>
          <SamplesFeature />
        </PageSection>
      </StudyDesignShell>
    </>
  );
}
