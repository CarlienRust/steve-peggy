import { EthicsFeature } from "@/features/study-design/EthicsFeature";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";

export default function EthicsPage() {
  return (
    <>
      <PageHeader compact title="Ethics" description="Approval letters, FMHS guidance, and IRB checklist." />
      <PageSection>
        <EthicsFeature />
      </PageSection>
    </>
  );
}
