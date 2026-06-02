import { CompareFeature } from "@/features/compare/CompareFeature";
import { PageHeader } from "@/components/PageHeader";
import { Paper } from "@mui/material";

export default function ComparePage() {
  return (
    <>
      <PageHeader
        eyebrow="05 · Comparison"
        title="Comparison"
        description="Your finding against ingested literature — agreement, discrepancy, and comparison caveats."
      />
      <Paper sx={{ p: 3 }}>
        <CompareFeature />
      </Paper>
    </>
  );
}
