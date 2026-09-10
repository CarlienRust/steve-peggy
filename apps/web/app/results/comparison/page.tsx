import { CompareFeature } from "@/features/compare/CompareFeature";
import { PageHeader } from "@/components/PageHeader";
import { Paper } from "@mui/material";

export default function ResultsComparisonPage() {
  return (
    <>
      <PageHeader
        title="Comparison"
        description="Your finding against ingested literature — agreement, discrepancy, and comparison caveats."
      />
      <Paper sx={{ p: 3 }}>
        <CompareFeature />
      </Paper>
    </>
  );
}
