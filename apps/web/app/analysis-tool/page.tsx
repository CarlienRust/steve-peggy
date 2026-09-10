import { SectionPlaceholder } from "@/components/SectionPlaceholder";
import { Paper } from "@mui/material";

export default function AnalysisToolPage() {
  return (
    <Paper sx={{ p: 3 }}>
      <SectionPlaceholder
        eyebrow="04 · Analysis tool"
        title="Analysis tool"
        description="Interactive analysis workspace for running pre-specified models on your data. Planned for a future release."
      />
    </Paper>
  );
}
