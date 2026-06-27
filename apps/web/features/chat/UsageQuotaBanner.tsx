"use client";

import { Alert } from "@mui/material";
import { formatResetsAt, type RateLimitBucket } from "@/lib/api";

function usageLabel(bucket: RateLimitBucket, unitLabel: string): string {
  if (bucket.remaining === 0) {
    return `No ${unitLabel} left this hour · resets ${formatResetsAt(bucket.resets_at)}`;
  }
  return `${bucket.remaining} of ${bucket.limit} ${unitLabel} left · resets ${formatResetsAt(bucket.resets_at)}`;
}

type UsageQuotaBannerProps = {
  isError: boolean;
  bucket?: RateLimitBucket;
  unitLabel: string;
  quotaExhausted: boolean;
};

export function UsageQuotaBanner({ isError, bucket, unitLabel, quotaExhausted }: UsageQuotaBannerProps) {
  if (isError) {
    return (
      <Alert severity="warning" variant="outlined">
        Usage unavailable — hourly message limits still apply on the server.
      </Alert>
    );
  }
  if (!bucket) return null;
  return (
    <Alert severity={quotaExhausted ? "warning" : "info"}>
      {usageLabel(bucket, unitLabel)}
    </Alert>
  );
}
