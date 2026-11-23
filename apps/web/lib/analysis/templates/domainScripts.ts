import { renderTemplate, scriptVars, type ScriptContext } from "@/lib/analysis/templates/render";

const MICRO = `# %%
# Gut microbiome — feature table descriptives only. Do not send FASTQ to Peggy.
# Prefer QIIME 2 or DADA2 (named community pipelines). Record the version in analysis_runs.
{{ROLE_COMMENTS}}
import json
from pathlib import Path
import pandas as pd

CELL_THRESHOLD = {{THRESHOLD}}
DATA_PATH = "{{DATA_PATH}}"

df = pd.read_csv(DATA_PATH, index_col=0)
# rows = samples, columns = features (counts). Confirm orientation before rarefaction.

def export_for_peggy(frame: pd.DataFrame, out_path="results/peggy_aggregates.json"):
    if frame.shape[0] > 0 and frame.shape[1] > 0 and frame.shape[0] == len(frame):
        if "sample_id" in [c.lower() for c in frame.columns]:
            raise ValueError("Refusing row-level export.")
    n_feat = int((frame.sum(axis=0) > 0).sum())
    payload = {"schema": "column-aggregates-v1", "n_samples": int(frame.shape[0]), "n_features": n_feat, "engine": "pandas"}
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    Path(out_path).write_text(json.dumps(payload, indent=2))

export_for_peggy(df)
`;

const SNP = `# SNP panel QC — summary statistics only. Do not commit .bed/.bim/.fam or .vcf.
# Run PLINK locally. Peggy never sees genotypes.
# plink2 --bfile YOUR_PREFIX --freq --hardy --missing --out results/qc
# Then import class D summaries via export_for_peggy / Results import.
`;

const ML = `# Machine learning — training stays on your machine. Peggy only reviews imported metrics.
# Nested CV, no leakage from the full matrix. export_for_peggy writes metrics JSON only.
# Do not write per-participant predictions back to Peggy.
`;

export function microbiomePython(ctx: ScriptContext): string {
  return renderTemplate(MICRO, scriptVars(ctx));
}

export function snpGuidance(_ctx: ScriptContext): string {
  return SNP;
}

export function mlGuidance(_ctx: ScriptContext): string {
  return ML;
}

const DIET = `# Diet analysis checklist script. Class C stays local.
# Document assessment method, energy adjustment, and measurement error (STROBE-nut — confirm version before citing).
{{ROLE_COMMENTS}}
def export_for_peggy(payload, out_path="results/peggy_aggregates.json"):
    raise ValueError("Refusing row-level export.") if hasattr(payload, "to_csv") else None
`;

const EXPOSOME = `# Exposome missingness/correlation. Multiple testing must be stated.
{{ROLE_COMMENTS}}
def export_for_peggy(summary, out_path="results/peggy_aggregates.json"):
    if getattr(summary, "shape", None) and len(getattr(summary, "index", [])) == getattr(summary, "shape", [0])[0]:
        raise ValueError("Refusing row-level export.")
`;

const OMICS = `# Generic omics QC. Normalization, batch, FDR — by data type.
{{ROLE_COMMENTS}}
def export_for_peggy(summary, out_path="results/peggy_aggregates.json"):
    raise ValueError("Refusing row-level export.") if hasattr(summary, "iloc") else None
`;

export function dietPython(ctx: ScriptContext): string {
  return renderTemplate(DIET, scriptVars(ctx));
}

export function exposomePython(ctx: ScriptContext): string {
  return renderTemplate(EXPOSOME, scriptVars(ctx));
}

export function omicsPython(ctx: ScriptContext): string {
  return renderTemplate(OMICS, scriptVars(ctx));
}
