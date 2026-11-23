import { renderTemplate, scriptVars, type ScriptContext } from "@/lib/analysis/templates/render";

const PY = `# %%
# Peggy descriptive script. No row-level data is embedded.
# Run in VS Code or convert to a notebook. Peggy does not execute this.
{{ROLE_COMMENTS}}
{{PLAN_COMMENTS}}
# Covariates from the plan / similar studies (document; do not auto-include): {{COVARIATES}}
import json
from pathlib import Path

import pandas as pd

SEED = {{SEED}}
CELL_THRESHOLD = {{THRESHOLD}}
DATA_PATH = "{{DATA_PATH}}"
COLS = {{COLS_JSON}}

# %%
df = pd.read_csv(DATA_PATH, usecols=COLS)

def export_for_peggy(frame: pd.DataFrame, out_path: str = "results/peggy_aggregates.json") -> None:
    """Write class D aggregates only. Refuse a raw table dump."""
    if frame.shape[0] == len(frame) and "participant" in (c.lower() for c in frame.columns):
        raise ValueError("Refusing row-level export. Pass column summaries only.")
    out = []
    for col in frame.columns:
        s = frame[col]
        row = {"name": col, "n": int(s.notna().sum()), "missingPercent": float(s.isna().mean() * 100)}
        if pd.api.types.is_numeric_dtype(s):
            row["mean"] = None if s.dropna().empty else float(s.mean())
            row["sd"] = None if s.dropna().empty else float(s.std(ddof=1))
            row["median"] = None if s.dropna().empty else float(s.median())
        else:
            vc = s.dropna().astype(str).value_counts()
            freqs = []
            for val, n in vc.items():
                count = f"<{CELL_THRESHOLD}" if 0 < int(n) < CELL_THRESHOLD else int(n)
                freqs.append({"value": str(val), "count": count})
            row["frequencies"] = freqs
        out.append(row)
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"schema": "column-aggregates-v1", "aggregates": out}, indent=2))

# %%
export_for_peggy(df)
`;

const R = `# Peggy descriptive script. No row-level data is embedded.
{{ROLE_COMMENTS}}
{{PLAN_COMMENTS}}
# Covariates from the plan / similar studies: {{COVARIATES}}
SEED <- {{SEED}}
CELL_THRESHOLD <- {{THRESHOLD}}
DATA_PATH <- "{{DATA_PATH}}"
cols <- c({{COLS_R}})
d <- read.csv(DATA_PATH, check.names = FALSE)[, cols, drop = FALSE]

export_for_peggy <- function(frame, out_path = "results/peggy_aggregates.json") {
  stopifnot(is.data.frame(frame))
  out <- lapply(names(frame), function(col) {
    s <- frame[[col]]
    n <- sum(!is.na(s))
    miss <- mean(is.na(s)) * 100
    row <- list(name = col, n = n, missingPercent = miss)
    if (is.numeric(s)) {
      row$mean <- if (n) mean(s, na.rm = TRUE) else NA
      row$sd <- if (n > 1) stats::sd(s, na.rm = TRUE) else NA
      row$median <- if (n) stats::median(s, na.rm = TRUE) else NA
    } else {
      tab <- table(as.character(s))
      row$frequencies <- lapply(names(tab), function(v) {
        k <- as.integer(tab[[v]])
        list(value = v, count = if (k > 0 && k < CELL_THRESHOLD) paste0("<", CELL_THRESHOLD) else k)
      })
    }
    row
  })
  json <- jsonlite::toJSON(list(schema = "column-aggregates-v1", aggregates = out), auto_unbox = TRUE, pretty = TRUE)
  dir.create(dirname(out_path), showWarnings = FALSE, recursive = TRUE)
  writeLines(json, out_path)
}

export_for_peggy(d)
`;

const SPS = `* Peggy SPSS syntax — descriptives only. No data file is embedded.
* Admin columns were omitted. Small-cell suppression is not automatic in SPSS; check counts under {{THRESHOLD}}.
GET FILE='{{DATA_PATH}}'.
DATASET NAME peggy.
FREQUENCIES VARIABLES={{COLS_SPS}}
  /STATISTICS=MEAN STDDEV MEDIAN.
EXECUTE.
`;

export function descriptivePython(ctx: ScriptContext): string {
  return renderTemplate(PY, scriptVars(ctx));
}

export function descriptiveR(ctx: ScriptContext): string {
  return renderTemplate(R, scriptVars(ctx));
}

export function descriptiveSpss(ctx: ScriptContext): string {
  return renderTemplate(SPS, scriptVars(ctx));
}
