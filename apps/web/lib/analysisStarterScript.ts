import { descriptivePython, descriptiveR, descriptiveSpss } from "@/lib/analysis/templates/descriptive";

function ctx(headers: string[], roles: Record<string, string>, planSteps: string[]) {
  return {
    headers,
    roles,
    adminColumns: headers.filter((h) => roles[h] === "admin"),
    cellThreshold: 5,
    covariates: [],
    planSteps,
    seed: 1,
    dataPath: "data/your-file.csv",
  };
}

export function starterPython(headers: string[], roles: Record<string, string>, planSteps: string[]): string {
  return descriptivePython(ctx(headers, roles, planSteps));
}

export function starterR(headers: string[], roles: Record<string, string>, planSteps: string[]): string {
  return descriptiveR(ctx(headers, roles, planSteps));
}

export function starterSpss(headers: string[], roles: Record<string, string>, planSteps: string[]): string {
  return descriptiveSpss(ctx(headers, roles, planSteps));
}
