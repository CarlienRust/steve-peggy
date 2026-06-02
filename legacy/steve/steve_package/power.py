import io
import os
import numpy as np
import pandas as pd
from statsmodels.stats.power import TTestIndPower

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
