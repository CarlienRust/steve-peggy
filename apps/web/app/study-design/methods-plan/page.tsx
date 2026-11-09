import { PlannerFeature } from "@/features/study-design/PlannerFeature";
import { StudyDesignShell } from "@/components/StudyDesignShell";

export default function MethodsPlanPage() {
  return (
    <StudyDesignShell
      title="Methods plan"
      description="Walk through project context, methods, then analysis. Review both together when you are ready."
    >
      <PlannerFeature />
    </StudyDesignShell>
  );
}
