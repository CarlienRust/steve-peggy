"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { WorkspaceProvider } from "@/lib/workspaceContext";

const PUBLIC_PREFIXES = ["/login", "/auth/", "/onboarding"];

export function ConditionalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (isPublic) {
    return <>{children}</>;
  }
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
