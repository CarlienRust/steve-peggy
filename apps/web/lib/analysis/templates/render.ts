export function renderTemplate(src: string, vars: Record<string, string>): string {
  return src.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export type ScriptContext = {
  headers: string[];
  roles: Record<string, string>;
  adminColumns: string[];
  cellThreshold: number;
  covariates: string[];
  planSteps: string[];
  seed: number;
  dataPath: string;
  outcome?: string;
  predictors?: string[];
};

export function scriptVars(ctx: ScriptContext): Record<string, string> {
  const analysisCols = ctx.headers.filter((h) => !ctx.adminColumns.includes(h));
  return {
    COLS_JSON: JSON.stringify(analysisCols),
    COLS_R: analysisCols.map((h) => `"${h.replace(/"/g, '\\"')}"`).join(", "),
    COLS_SPS: analysisCols.map((h) => h.replace(/\s+/g, "_")).join(" "),
    ROLE_COMMENTS: ctx.headers.map((h) => `# ${h}: ${ctx.roles[h] || "analysis"}`).join("\n"),
    PLAN_COMMENTS: ctx.planSteps.map((s) => `# - ${s}`).join("\n") || "# (no plan steps)",
    THRESHOLD: String(ctx.cellThreshold),
    SEED: String(ctx.seed),
    DATA_PATH: ctx.dataPath,
    COVARIATES: ctx.covariates.join(", ") || "(none listed)",
    OUTCOME: ctx.outcome ?? "",
    PREDICTORS_JSON: JSON.stringify(ctx.predictors ?? []),
    PREDICTORS_R: (ctx.predictors ?? []).map((h) => `"${h.replace(/"/g, '\\"')}"`).join(", "),
  };
}
