import { Suspense } from "react";
import { CircularProgress, Box } from "@mui/material";
import { ValidateAimFeature } from "@/features/validate/ValidateAimFeature";
import { PageSection } from "@/components/PageSection";
import { ValidateShell } from "@/components/ValidateShell";

export default function ValidateAimPage() {
  return (
    <>
      <ValidateShell
        title="Aim and objectives"
        description="Write them here or paste yours. Peggy checks them against your papers. Sample data shown."
      >
        <PageSection>
          <Suspense
            fallback={
              <Box sx={{ display: "grid", placeItems: "center", py: 6 }}>
                <CircularProgress />
              </Box>
            }
          >
            <ValidateAimFeature />
          </Suspense>
        </PageSection>
      </ValidateShell>
    </>
  );
}
