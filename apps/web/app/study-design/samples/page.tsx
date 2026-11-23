import { SamplesFeature } from "@/features/study-design/SamplesFeature";
import { PageSection } from "@/components/PageSection";
import { StudyDesignShell } from "@/components/StudyDesignShell";

export default function SamplesPage() {
  return (
    <>
      <StudyDesignShell title="Samples and datasets" description="De-identified cohort files.">
        <PageSection>
          <SamplesFeature />
        </PageSection>
      </StudyDesignShell>
    </>
  );
}
