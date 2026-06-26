"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/AppShell";

const PUBLIC_PREFIXES = ["/login", "/auth/"];

export function ConditionalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (isPublic) {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}
