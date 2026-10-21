"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PageSection } from "@/components/PageSection";
import { ExtractionReviewFeature } from "@/features/extractions/ExtractionReviewFeature";
import { ValidateShell } from "@/components/ValidateShell";

export default function LiteratureExtractionReviewPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useSearchParams();
  const paperId = useMemo(() => {
    const raw = params.get("paperId") ?? "";
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params]);

  return (
    <ValidateShell title="Literature search" description="Papers in this project. Sample data shown.">
      <PageSection>
        <ExtractionReviewFeature initialPaperId={paperId} />
      </PageSection>
    </ValidateShell>
  );
}

