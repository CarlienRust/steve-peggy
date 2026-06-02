import os
import pandas as pd
import plotly.express as px
from plotly.subplots import make_subplots
# Plotting & Visualization
import plotly.io as pio
pio.templates.default = "plotly"
import kaleido
import plotly.graph_objects as go
import seaborn as sns

# ---- Helper for saving plotly figure as PNG (requires kaleido installed) ----
def save_plot_as_png(fig, output_path: str):
    try:
        fig.write_image(output_path, format="png", engine="kaleido")
    except Exception as e:
        raise ValueError(f"Error saving figure as PNG: {e}")

# -----------------------------
# STEP 4: Manual visualization
# -----------------------------

def plot_data(df: pd.DataFrame, x_col, y_col=None, plot_type="Bar Chart", color_col=None, facet_col="Cohort", title=None):
    if title is None:
        title = f"{(y_col or 'Percentage')} vs {x_col} (Faceted by {facet_col})"

    # Ensure category-type columns are strings for Plotly
    for c in [x_col, color_col, facet_col]:
        if c and c in df.columns and df[c].dtype != "object":
            df[c] = df[c].astype(str)

    fig = None

    if plot_type == "Bar Chart - SD" and y_col:
        g = (
            df.groupby([facet_col, x_col] + ([color_col] if color_col else []))[y_col]
              .agg(['mean', 'std']).reset_index()
        )
        fig = px.bar(g, x=x_col, y="mean", color=color_col, facet_col=facet_col,
                     error_y="std", title=title, labels={"mean": y_col, "std": "SD"})

    elif plot_type == "Bar Chart":
        # percent within (facet, x)
        g = (df.groupby([facet_col, x_col, color_col]).size()
               .reset_index(name="count"))
        g["percent"] = g.groupby([facet_col, x_col])["count"].transform(lambda s: s / s.sum() * 100.0)
        fig = px.bar(g, x=x_col, y="percent", color=color_col, facet_col=facet_col,
                     title=f"Percentage of {color_col} in {x_col} (Faceted by {facet_col})",
                     labels={"percent": "Percentage (%)"}, text="percent")

    elif plot_type == "Box Plot" and y_col:
        fig = px.box(df, x=x_col, y=y_col, color=color_col, facet_col=facet_col, title=title)

    elif plot_type == "Histogram":
        fig = px.histogram(df, x=x_col, color=color_col, facet_col=facet_col, title=f"Distribution of {x_col}")

    elif plot_type == "Line Chart" and y_col:
        g = (
            df.groupby([facet_col, x_col] + ([color_col] if color_col else []))[y_col]
              .agg(['mean', 'std']).reset_index()
        )
        fig = px.line(g, x=x_col, y="mean", color=color_col, facet_col=facet_col,
                      error_y="std", title=title, labels={"mean": y_col, "std": "SD"})

    elif plot_type == "Scatter Plot" and y_col:
        fig = px.scatter(df, x=x_col, y=y_col, color=color_col, facet_col=facet_col, title=title)

    elif plot_type == "Violin Plot" and y_col:
        fig = px.violin(df, x=x_col, y=y_col, color=color_col, facet_col=facet_col, box=True, points="all", title=title)

    if fig is None:
        raise ValueError(f"Could not generate plot type '{plot_type}' — check inputs.")

    fig.update_layout(template="plotly")
    return fig

# -----------------------------
# STEP 6 plotting: bar for categorical, box for numerical
# -----------------------------

def plot_stats_results(summary_df: pd.DataFrame, df: pd.DataFrame, group_col: str):
    """
    Given the summary table from analyze.run_stats_workflow (with Column, Type, Test, p-value, Significant),
    create per-variable plots:
      - Categorical -> bar (percent stacked within Column categories by group)
      - Numerical   -> box (group_col on x, variable on y)
    Returns dict: {column_name: plotly_figure}
    """
    figs = {}
    if summary_df is None or summary_df.empty:
        return figs

    # Use only variables that actually exist in df
    for _, row in summary_df.iterrows():
        col = row["Column"]
        typ = row["Type"]
        if col not in df.columns:
            continue

        if typ == "Categorical":
            tmp = (
                df.groupby([col, group_col]).size().reset_index(name="count")
            )
            # Percent within each category of `col`
            tmp["percent"] = tmp.groupby(col)["count"].transform(lambda s: s / s.sum() * 100.0)
            fig = px.bar(tmp, x=col, y="percent", color=group_col, barmode="group",
                         labels={"percent": "Percentage (%)"},
                         title=f"{col} by {group_col}")
            figs[col] = fig

        elif typ == "Numerical":
            fig = px.box(df, x=group_col, y=col, points="outliers",
                         title=f"{col} by {group_col}")
            figs[col] = fig

    return figs
