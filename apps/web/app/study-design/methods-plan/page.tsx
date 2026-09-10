import { PlannerFeature } from "@/features/study-design/PlannerFeature";
import { Paper } from "@mui/material";

export default function MethodsPlanPage() {
  return (
    <Paper sx={{ p: 3 }}>
      <PlannerFeature
        section="methods"
        title="Methods plan"
        description="Prospective study design, endpoints, and procedures — review your draft or get suggestions from literature."
      />
    </Paper>
  );
}
