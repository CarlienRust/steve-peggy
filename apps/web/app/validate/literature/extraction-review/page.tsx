"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RedirectInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const qs = params.toString();
    router.replace(qs ? `/validate/literature?${qs}` : "/validate/literature");
  }, [router, params]);

  return null;
}

/** Deep links keep working; primary UX is inline on /validate/literature */
export default function LiteratureExtractionReviewPage() {
  return (
    <Suspense fallback={null}>
      <RedirectInner />
    </Suspense>
  );
}
