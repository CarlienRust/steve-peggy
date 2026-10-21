import { PlannerFeature } from "@/features/study-design/PlannerFeature";
import { StudyDesignShell } from "@/components/StudyDesignShell";

export default function AnalysisPlanPage() {
  return (
    <StudyDesignShell
      title="Analysis plan"
      description="Peggy fills in what it can from your project and papers. Add your own plan to get a review."
    >
      <PlannerFeature section="analysis" />
    </StudyDesignShell>
  );
}
