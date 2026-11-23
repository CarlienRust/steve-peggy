import { EthicsFeature } from "@/features/study-design/EthicsFeature";
import { StudyDesignShell } from "@/components/StudyDesignShell";

export default function EthicsPage() {
  return (
    <StudyDesignShell title="Ethics" description="Checklist from your cohort profile.">
      <EthicsFeature />
    </StudyDesignShell>
  );
}
