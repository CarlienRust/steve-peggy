import { PlannerFeature } from "@/features/study-design/PlannerFeature";
import { StudyDesignShell } from "@/components/StudyDesignShell";

export default function MethodsPlanPage() {
  return (
    <StudyDesignShell
      title="Methods plan"
      description="Context, methods, analysis, then review."
    >
      <PlannerFeature />
    </StudyDesignShell>
  );
}
