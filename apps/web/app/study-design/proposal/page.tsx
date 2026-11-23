import { ProposalFeature } from "@/features/study-design/ProposalFeature";
import { PageSection } from "@/components/PageSection";
import { StudyDesignShell } from "@/components/StudyDesignShell";

export default function ProposalPage() {
  return (
    <>
      <StudyDesignShell title="Proposal" description="One- to two-page draft from this project.">
        <PageSection>
          <ProposalFeature />
        </PageSection>
      </StudyDesignShell>
    </>
  );
}
