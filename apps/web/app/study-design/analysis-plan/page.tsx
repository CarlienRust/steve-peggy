import { PlannerFeature } from "@/features/study-design/PlannerFeature";
import { Paper } from "@mui/material";

export default function AnalysisPlanPage() {
  return (
    <Paper sx={{ p: 3 }}>
      <PlannerFeature
        section="analysis"
        title="Analysis plan"
        description="Pre-specified statistics, models, and software — aligned with sample size and budget."
      />
    </Paper>
  );
}
