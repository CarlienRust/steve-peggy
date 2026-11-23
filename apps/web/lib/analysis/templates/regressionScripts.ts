import { renderTemplate, scriptVars, type ScriptContext } from "@/lib/analysis/templates/render";

const PY = `# %%
# Peggy OLS script. Residuals stay local. export_for_peggy writes coefficients only.
{{ROLE_COMMENTS}}
import json
from pathlib import Path

import pandas as pd
import statsmodels.api as sm

SEED = {{SEED}}
DATA_PATH = "{{DATA_PATH}}"
OUTCOME = "{{OUTCOME}}"
PREDICTORS = {{PREDICTORS_JSON}}

# %%
df = pd.read_csv(DATA_PATH)
use = [OUTCOME, *PREDICTORS]
frame = df[use].dropna()
X = sm.add_constant(frame[PREDICTORS], has_constant="add")
model = sm.OLS(frame[OUTCOME], X).fit()

def export_for_peggy(fit, out_path="results/peggy_ols.json"):
    if hasattr(fit, "shape"):
        raise ValueError("Refusing row-level table. Pass a fitted OLS results object.")
    rows = []
    ci = fit.conf_int()
    for name in fit.params.index:
        rows.append({
            "name": name,
            "estimate": float(fit.params[name]),
            "se": float(fit.bse[name]),
            "ciLow": float(ci.loc[name, 0]),
            "ciHigh": float(ci.loc[name, 1]),
            "pApprox": float(fit.pvalues[name]),
        })
    payload = {
        "schema": "ols-coefficients-v1",
        "n": int(fit.nobs),
        "rSquared": float(fit.rsquared),
        "coefficients": rows,
        "engine": "statsmodels",
    }
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2))

export_for_peggy(model)
`;

const R = `# Peggy OLS script. Do not write residual CSVs back to Peggy.
{{ROLE_COMMENTS}}
DATA_PATH <- "{{DATA_PATH}}"
OUTCOME <- "{{OUTCOME}}"
PREDICTORS <- c({{PREDICTORS_R}})
d <- read.csv(DATA_PATH, check.names = FALSE)
f <- as.formula(paste(OUTCOME, "~", paste(PREDICTORS, collapse = " + ")))
fit <- lm(f, data = d)

export_for_peggy <- function(model, out_path = "results/peggy_ols.json") {
  if (is.data.frame(model)) stop("Refusing row-level table.")
  s <- summary(model)
  ci <- confint(model)
  coefs <- lapply(rownames(s$coefficients), function(name) {
    list(
      name = name,
      estimate = unname(s$coefficients[name, 1]),
      se = unname(s$coefficients[name, 2]),
      ciLow = unname(ci[name, 1]),
      ciHigh = unname(ci[name, 2]),
      pApprox = unname(s$coefficients[name, 4])
    )
  })
  payload <- list(schema = "ols-coefficients-v1", n = length(model$residuals), rSquared = s$r.squared, coefficients = coefs, engine = "r-lm")
  jsonlite::write_json(payload, out_path, auto_unbox = TRUE, pretty = TRUE)
}

export_for_peggy(fit)
`;

export function regressionPython(ctx: ScriptContext): string {
  return renderTemplate(PY, scriptVars(ctx));
}

export function regressionR(ctx: ScriptContext): string {
  return renderTemplate(R, scriptVars(ctx));
}
