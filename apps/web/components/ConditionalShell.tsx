"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { WorkspaceProvider } from "@/lib/workspaceContext";

// Routes that should render without the project shell/sidebar.
// Sidebar should only appear once inside a specific project workspace.
const NO_SHELL_PREFIXES = ["/login", "/auth/", "/onboarding", "/setup"];

export function ConditionalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const isPublic =
    pathname === "/" ||
    NO_SHELL_PREFIXES.some((p) => pathname.startsWith(p));
  if (isPublic) {
    return <>{children}</>;
  }
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
