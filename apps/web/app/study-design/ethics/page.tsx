import { EthicsFeature } from "@/features/study-design/EthicsFeature";
import { PageSection } from "@/components/PageSection";
import { StudyDesignShell } from "@/components/StudyDesignShell";

export default function EthicsPage() {
  return (
    <>
      <StudyDesignShell title="Ethics" description="What your committee will ask for. Peggy builds a checklist from your cohort profile.">
        <PageSection>
          <EthicsFeature />
        </PageSection>
      </StudyDesignShell>
    </>
  );
}
