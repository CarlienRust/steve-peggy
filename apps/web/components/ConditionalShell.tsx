"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { HomeAppShell } from "@/components/HomeAppShell";
import { WorkspaceProvider } from "@/lib/workspaceContext";

const NO_SHELL_PREFIXES = ["/login", "/auth/", "/onboarding"];

export function ConditionalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const isHomeShell =
    pathname === "/" ||
    pathname === "/projects" ||
    pathname === "/ask" ||
    pathname === "/help" ||
    pathname === "/useful-links" ||
    pathname.startsWith("/setup");
  if (NO_SHELL_PREFIXES.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }
  if (isHomeShell) {
    return <HomeAppShell>{children}</HomeAppShell>;
  }
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
