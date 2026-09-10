import { ProposalFeature } from "@/features/study-design/ProposalFeature";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";

export default function ProposalPage() {
  return (
    <>
      <PageHeader compact title="Proposal" description="One–two page study or grant draft from project context." />
      <PageSection>
        <ProposalFeature />
      </PageSection>
    </>
  );
}
