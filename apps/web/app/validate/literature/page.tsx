"use client";

import { Suspense } from "react";
import { CorpusManagement } from "@/features/ingest/CorpusManagement";
import { PageSection } from "@/components/PageSection";
import { ValidateShell } from "@/components/ValidateShell";

export default function ValidateLiteraturePage() {
  return (
    <ValidateShell title="Literature search" description="Papers in this project. Select a row to extract and review fields.">
      <PageSection>
        <Suspense fallback={null}>
          <CorpusManagement />
        </Suspense>
      </PageSection>
    </ValidateShell>
  );
}
