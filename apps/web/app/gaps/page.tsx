import { GapsFeature } from "@/features/gaps/GapsFeature";
import { PageHeader } from "@/components/PageHeader";
import { Paper } from "@mui/material";

export default function GapsPage() {
  return (
    <>
      <PageHeader
        eyebrow="04 · Gap analysis"
        title="Gap analysis"
        description="Structured view of what is understudied, contradictory, or methodologically weak in your corpus."
      />
      <Paper sx={{ p: 3 }}>
        <GapsFeature />
      </Paper>
    </>
  );
}
