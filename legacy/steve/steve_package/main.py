# main.py - Orchestrator for Steve (Steps 1–10)

import streamlit as st
import pandas as pd

# Import pipeline steps
from preprocessing import read_file, validate_and_clean_data
from power import perform_power_analysis
from plotting import plot_metadata_distribution
from storage import save_to_sqlite
from analysis import run_metadata_tests
from microbiome import (
    alpha_diversity_analysis,
    beta_diversity_analysis,
    differential_abundance
)
from reporting import generate_data_quality_report, append_to_pdf
from init_db import init_db

def main():
    st.title("Steve 🧬 | Microbiome Analysis Pipeline")

    # -----------------------------------
    # Initialize SQLite schema
    # -----------------------------------
    db_path = "steve_data.sqlite"
    init_db(db_path)

    # -----------------------------------
    # STEP 1: Upload Files
    # -----------------------------------
    uploaded_files = st.file_uploader(
        "Upload CSV or XLSX files",
        type=["csv", "xlsx"],
        accept_multiple_files=True
    )

    if not uploaded_files:
        st.info("Please upload one or more data files to proceed.")
        return

    cleaned_dfs: list[pd.DataFrame] = []
    file_names: list[str] = []
    errors: list[str] = []

    # -----------------------------------
    # STEP 2: Validate & Clean
    # -----------------------------------
    for file in uploaded_files:
        try:
            df = read_file(file)
        except Exception as e:
            errors.append(str(e))
            continue

        file_errors, cleaned = validate_and_clean_data(df, getattr(file, "name", "uploaded_file"))
        errors.extend(file_errors)
        if cleaned is not None:
            cleaned_dfs.append(cleaned)
            file_names.append(getattr(file, "name", "uploaded_file"))

    if errors:
        st.error("⚠️ Issues detected during preprocessing:")
        for e in errors:
            st.write(f"- {e}")

    if not cleaned_dfs:
        st.stop()

    # -----------------------------------
    # STEP 3: Power Analysis
    # -----------------------------------
    st.subheader("Step 3: Power Analysis")
    power_results = perform_power_analysis(cleaned_dfs[0])
    st.write(power_results)

    # -----------------------------------
    # STEP 4: Metadata Visualization
    # -----------------------------------
    st.subheader("Step 4: Metadata Distribution")
    for df, name in zip(cleaned_dfs, file_names):
        fig = plot_metadata_distribution(df)
        st.plotly_chart(fig)

    # -----------------------------------
    # STEP 5: Storage
    # -----------------------------------
    st.subheader("Step 5: Store Data in SQLite")
    db_path = "steve_data.sqlite"
    save_to_sqlite(cleaned_dfs, file_names, db_path)
    st.success(f"Data saved to {db_path}")

    # -----------------------------------
    # STEP 6: Metadata Analysis
    # -----------------------------------
    st.subheader("Step 6: Statistical Tests")
    for df, name in zip(cleaned_dfs, file_names):
        results = run_metadata_tests(df)
        st.write(f"**Results for {name}:**")
        st.write(results)

    # -----------------------------------
    # STEP 7: Alpha Diversity
    # -----------------------------------
    st.subheader("Step 7: Alpha Diversity")
    for df in cleaned_dfs:
        alpha_results = alpha_diversity_analysis(df)
        st.write(alpha_results)

    # -----------------------------------
    # STEP 8: Beta Diversity
    # -----------------------------------
    st.subheader("Step 8: Beta Diversity")
    for df in cleaned_dfs:
        beta_results = beta_diversity_analysis(df)
        st.write(beta_results)

    # -----------------------------------
    # STEP 9: Differential Abundance
    # -----------------------------------
    st.subheader("Step 9: Differential Abundance")
    for df in cleaned_dfs:
        diff_results = differential_abundance(df)
        st.write(diff_results)

    # -----------------------------------
    # STEP 10: Reporting
    # -----------------------------------
    st.subheader("Step 10: Data Quality Report")
    report_df = generate_data_quality_report(cleaned_dfs, file_names)
    st.dataframe(report_df)

    if st.button("Download Final Report (PDF)"):
        # Generate PDF including plots from st.session_state
        pdf_buffer = append_to_pdf("Steve Final Report", fig=None)  # Optional: extend to include figures
        st.download_button(
            label="Download PDF",
            data=pdf_buffer,
            file_name="steve_report.pdf",
            mime="application/pdf"
        )


if __name__ == "__main__":
    main()

