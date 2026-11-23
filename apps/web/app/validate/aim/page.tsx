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
        description="Write or paste. Check against your papers."
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
