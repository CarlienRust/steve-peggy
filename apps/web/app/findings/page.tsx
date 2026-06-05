import { FindingsManagement } from "@/features/findings/FindingsManagement";
import { PageHeader } from "@/components/PageHeader";
import { Paper } from "@mui/material";

export default function FindingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="03 · Our findings"
        title="Our research & findings"
        description="Upload your cohort results, internal analyses, and narrative summaries. Peggy compares these against the literature corpus and can factor them into gap analysis."
      />
      <Paper sx={{ p: 3 }}>
        <FindingsManagement />
      </Paper>
    </>
  );
}
