"use client";

import { ValidateDatasetsFeature } from "@/features/validate/ValidateDatasetsFeature";
import { PageSection } from "@/components/PageSection";
import { ValidateShell } from "@/components/ValidateShell";

export default function ValidateDatasetsPage() {
  return (
    <ValidateShell
      title="Validate datasets"
      description="Upload de-identified tables and check format, missing variables, and readiness for your planned analysis. Files are shared with Samples & datasets."
    >
      <PageSection>
        <ValidateDatasetsFeature />
      </PageSection>
    </ValidateShell>
  );
}