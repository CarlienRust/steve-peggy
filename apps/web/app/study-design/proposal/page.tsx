import { ProposalFeature } from "@/features/study-design/ProposalFeature";
import { PageSection } from "@/components/PageSection";
import { StudyDesignShell } from "@/components/StudyDesignShell";

export default function ProposalPage() {
  return (
    <>
      <StudyDesignShell title="Proposal" description="A 1 to 2 page draft built from your project. Edit it before you share it.">
        <PageSection>
          <ProposalFeature />
        </PageSection>
      </StudyDesignShell>
    </>
  );
}
