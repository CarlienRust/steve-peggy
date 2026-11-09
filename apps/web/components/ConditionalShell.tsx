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
    pathname === "/calendar" ||
    pathname === "/reading-journal" ||
    pathname.startsWith("/setup");
  const inner = NO_SHELL_PREFIXES.some((p) => pathname.startsWith(p)) ? (
    children
  ) : isHomeShell ? (
    <HomeAppShell>{children}</HomeAppShell>
  ) : (
    <AppShell>{children}</AppShell>
  );

  return <WorkspaceProvider>{inner}</WorkspaceProvider>;
}
