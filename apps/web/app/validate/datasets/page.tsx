"use client";

import { ValidateDatasetsFeature } from "@/features/validate/ValidateDatasetsFeature";
import { PageSection } from "@/components/PageSection";
import { ValidateShell } from "@/components/ValidateShell";

export default function ValidateDatasetsPage() {
  return (
    <ValidateShell
      title="Validate datasets"
      description="De-identified tables. Same files as Samples."
    >
      <PageSection>
        <ValidateDatasetsFeature />
      </PageSection>
    </ValidateShell>
  );
}