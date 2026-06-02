import io
import os
import numpy as np
import pandas as pd
from scipy import stats
from statsmodels.stats.power import TTestIndPower
import matplotlib.pyplot as plt
import seaborn as sns

# -----------------------------
# STEP 3: Power calculation
# -----------------------------

def count_participants_with_power(
    df: pd.DataFrame,
    group_by_col: str,
    cohort_col: str = "Cohort",
    min_sample_size: int = 30,  # kept if you need it elsewhere
    alpha: float = 0.05,
    power: float = 0.8,
    effect_size: float = 0.5
):
    """Return (count_pivot, power_pivot, power_summary) and a text blob for reporting."""
    count_df = df.groupby([cohort_col, group_by_col]).size().reset_index(name="count")

    analysis = TTestIndPower()
    required_n = int(np.ceil(analysis.solve_power(effect_size=effect_size, alpha=alpha, power=power, alternative="two-sided")))

    count_df["Has Power"] = np.where(count_df["count"] >= required_n, "Sufficient", "Insufficient")

    count_pivot = count_df.pivot(index=group_by_col, columns=cohort_col, values="count").fillna(0).astype(int)
    power_pivot = count_df.pivot(index=group_by_col, columns=cohort_col, values="Has Power").fillna("Insufficient")

    power_summary = pd.DataFrame({
        "Required Sample Size": [required_n],
        "Effect Size (Cohen's d)": [effect_size],
        "Alpha (Significance Level)": [alpha],
        "Power (1 - Beta)": [power],
    })

    report_text = (
        "Participant Count by Group:\n"
        f"{count_pivot}\n"
        "Power Assessment by Group:\n"
        f"{power_pivot}\n"
        "Power Analysis Summary:\n"
        f"{power_summary}"
    )

    return count_pivot, power_pivot, power_summary, report_text

# -----------------------------
# STEP 5: SQLite store / query
# -----------------------------

def store_data_in_sqlite(df: pd.DataFrame, db_path: str = "test_data.db", table: str = "test"):
    if "ID" not in df.columns:
        raise ValueError("The uploaded dataset must contain an 'ID' column.")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cols = df.columns.tolist()
    cur.execute(f"CREATE TABLE IF NOT EXISTS {table} ({', '.join([f'\"{c}\" TEXT' for c in cols])})")

    # Insert all as text to avoid dtype issues
    rows = [tuple(map(lambda x: "" if pd.isna(x) else str(x), r)) for r in df.to_numpy()]
    placeholders = ", ".join(["?"] * len(cols))
    cur.executemany(f'INSERT INTO {table} ("{'","'.join(cols)}") VALUES ({placeholders})', rows)
    conn.commit()
    conn.close()

def query_database(where_clause: str, db_path: str = "test_data.db", table: str = "test") -> pd.DataFrame:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    if cur.fetchone() is None:
        conn.close()
        return pd.DataFrame()

    # Basic sanitation (you already restrict to WHERE body)
    where_clause = where_clause.strip().replace(";", "")
    try:
        cur.execute(f'SELECT * FROM {table} WHERE {where_clause}')
        rows = cur.fetchall()
        columns = [d[0] for d in cur.description]
        df = pd.DataFrame(rows, columns=columns)
    except Exception:
        df = pd.DataFrame()
    finally:
        conn.close()
    return df

# -----------------------------
# STEP 6: Metadata description + stats
# -----------------------------

def classify_columns(df: pd.DataFrame):
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    num_cols = df.select_dtypes(include=["number"]).columns.tolist()
    return cat_cols, num_cols

def check_normality(df: pd.DataFrame, num_cols, min_n: int = 4):
    """Shapiro–Wilk; return dict col->pvalue or NaN if too few values."""
    out = {}
    for col in num_cols:
        series = df[col].dropna()
        out[col] = stats.shapiro(series)[1] if len(series) >= min_n else np.nan
    return out

def _two_group_labels(df: pd.DataFrame, group_col: str):
    """Return exactly 2 labels if possible, else None."""
    levels = [x for x in pd.Series(df[group_col]).dropna().unique()]
    return levels if len(levels) == 2 else None

def perform_stat_tests(df: pd.DataFrame, group_col: str, p_threshold: float = 0.05):
    """
    Returns a DataFrame with rows = columns in df (excluding group_col),
    and columns: Column, Type, Test, p-value, Significant.
    - Categorical: Chi-square (fallback to Fisher only for 2x2 with small counts)
    - Numerical: t-test if both groups normal; otherwise Mann–Whitney U
    """
    cat_cols, num_cols = classify_columns(df)
    if group_col in cat_cols:
        cat_cols = [c for c in cat_cols if c != group_col]
    if group_col in num_cols:
        num_cols = [c for c in num_cols if c != group_col]

    results = []

    # Ensure we know the two groups (required for pairwise tests)
    two_levels = _two_group_labels(df, group_col)

    # Categorical
    for col in cat_cols:
        if group_col not in df.columns:
            continue

        contingency = pd.crosstab(df[group_col], df[col])
        # If table has 0-sized any dimension, skip
        if contingency.shape[0] < 2 or contingency.shape[1] < 2:
            results.append({"Column": col, "Type": "Categorical", "Test": "N/A", "p-value": np.nan, "Significant": "No"})
            continue

        # Expected frequencies
        chi2, p_chi, dof, expected = stats.chi2_contingency(contingency, correction=False)

        # Use Fisher only for 2x2 with expected < 5
        if contingency.shape == (2, 2) and (expected < 5).any():
            # scipy fisher_exact returns oddsratio, pvalue
            _, p = stats.fisher_exact(contingency)
            test_name = "Fisher's Exact"
        else:
            p = p_chi
            test_name = "Chi-Square"

        results.append({
            "Column": col,
            "Type": "Categorical",
            "Test": test_name,
            "p-value": float(p),
            "Significant": "Yes" if p < p_threshold else "No",
        })

    # Numerical
    normality = check_normality(df, num_cols)
    for col in num_cols:
        if group_col not in df.columns or two_levels is None:
            results.append({"Column": col, "Type": "Numerical", "Test": "N/A (need exactly 2 groups)", "p-value": np.nan, "Significant": "No"})
            continue

        g1, g2 = two_levels[0], two_levels[1]
        x = pd.to_numeric(df.loc[df[group_col] == g1, col], errors="coerce").dropna()
        y = pd.to_numeric(df.loc[df[group_col] == g2, col], errors="coerce").dropna()

        # If either group too small, skip
        if len(x) < 2 or len(y) < 2:
            results.append({"Column": col, "Type": "Numerical", "Test": "N/A (too few values)", "p-value": np.nan, "Significant": "No"})
            continue

        # decide normal vs non-normal (both normal -> t-test)
        normal_g1 = normality.get(col, np.nan)
        # If you prefer per-group normality, compute Shapiro per group here.
        # For simplicity, use overall as earlier code did:
        is_normal = (not np.isnan(normal_g1)) and (normal_g1 > p_threshold)

        if is_normal:
            _, p = stats.ttest_ind(x, y, equal_var=False, nan_policy="omit")
            test_name = "t-test (independent)"
        else:
            _, p = stats.mannwhitneyu(x, y, alternative="two-sided")
            test_name = "Mann–Whitney U"

        results.append({
            "Column": col,
            "Type": "Numerical",
            "Test": test_name,
            "p-value": float(p),
            "Significant": "Yes" if p < p_threshold else "No",
        })

    return pd.DataFrame(results)

def summarize_metadata_with_tests(df: pd.DataFrame, group_col: str, p_threshold: float = 0.05):
    """
    Returns a single table combining:
      - Categorical: missing, unique, examples + test/p-value/significant
      - Numerical: missing, mean/std (if normal), min/max, IQR (if non-normal) + test/p-value/significant
    """
    desc_rows = []
    stats_df = perform_stat_tests(df, group_col, p_threshold)
    stats_map = {row["Column"]: (row["Test"], row["p-value"], row["Significant"]) for _, row in stats_df.iterrows()}

    for col in df.columns:
        if col == group_col:
            continue
        series = df[col]
        missing = int(series.isna().sum())
        dtype = series.dtype

        test_name, pval, signif = stats_map.get(col, (None, np.nan, None))

        if str(dtype) in ("object", "category"):
            uniq = int(series.nunique(dropna=True))
            examples = ", ".join(map(str, series.dropna().unique()[:5]))
            desc_rows.append({
                "Column": col,
                "Type": "Categorical",
                "Missing": missing,
                "Unique Values": uniq,
                "Examples": examples,
                "Test": test_name,
                "p-value": pval,
                "Significant": signif
            })
        else:
            s = pd.to_numeric(series, errors="coerce")
            sdesc = s.describe()
            # overall normality for display (consistent with earlier)
            normality_p = stats.shapiro(s.dropna())[1] if s.dropna().size >= 4 else np.nan
            is_normal = (not np.isnan(normality_p)) and (normality_p > p_threshold)
            desc_rows.append({
                "Column": col,
                "Type": "Numerical",
                "Missing": missing,
                "Mean": float(sdesc["mean"]) if is_normal else None,
                "Std Dev": float(sdesc["std"]) if is_normal else None,
                "Min": float(sdesc["min"]) if sdesc.get("min", np.nan) == sdesc.get("min", np.nan) else None,
                "Max": float(sdesc["max"]) if sdesc.get("max", np.nan) == sdesc.get("max", np.nan) else None,
                "IQR": float(s.quantile(0.75) - s.quantile(0.25)) if not is_normal and s.dropna().size > 0 else None,
                "Normality p-value": float(normality_p) if not np.isnan(normality_p) else np.nan,
                "Test": test_name,
                "p-value": pval,
                "Significant": signif
            })

    return pd.DataFrame(desc_rows)

def run_stats_workflow(df: pd.DataFrame, group_col: str, subset_col=None, subset_value=None, p_threshold: float = 0.05):
    """Equivalent to your old main() for Step 6; returns the full summary table."""
    if subset_col and subset_value is not None:
        df = df[df[subset_col] == subset_value]
    return summarize_metadata_with_tests(df, group_col, p_threshold)

def run_for_all_subsets(df: pd.DataFrame, group_col: str, subset_col=None, p_threshold: float = 0.05):
    """Wrapper to run summary for each level in subset_col, else one summary."""
    if subset_col:
        out = {}
        for val in pd.Series(df[subset_col]).dropna().unique():
            out[val] = run_stats_workflow(df, group_col, subset_col, val, p_threshold)
        return out
    return {"All Data": run_stats_workflow(df, group_col, p_threshold=p_threshold)}

