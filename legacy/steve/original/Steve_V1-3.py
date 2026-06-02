"""
# Steve Version 1.3

This app provides a comprehensive data analysis pipeline designed for the following tasks:

1. **Data Upload & Validation**: Users can upload CSV or Excel files. The app automatically validates the dataset by checking for required columns, duplicate participant IDs, and missing values. It then cleans the data accordingly.

2. **Statistical Power Calculation**: Based on user input for effect size, the app performs statistical power calculations using sample size data. It evaluates whether each group within the dataset meets the required sample size for the desired power level (80%).

3. **Data Visualization**: The app allows users to visualize data interactively using Plotly. Users can select specific columns for analysis, choose from various plot types (e.g., bar, box, scatter, line), and apply color-coding and faceting based on groupings like cohort or disease status.

4. **Data Query with SQLite, LangChain, and Hugging Face**: Users can run custom SQL queries on the dataset stored in an SQLite database or use natural language queries for semantic searches. LangChain and Hugging Face integrate to allow advanced querying, including both structured SQL queries and unstructured, semantic searches to explore the dataset.

The app seamlessly integrates data processing, statistical analysis, visualization, and querying in an easy-to-use interface.
"""
#pip install streamlit pandas numpy sqlite3 plotly statsmodels transformers reportlab scipy scikit-learn pillow pypdf2

#pip install \streamlit==1.32.2 \pandas==2.2.1 \numpy==1.26.4 \plotly==5.20.0 \statsmodels==0.14.1 \transformers==4.38.2 \reportlab==4.0.9 \scipy==1.11.4 \pillow==10.2.0 \pypdf2==3.0.1

# Standard Libraries
import os
import io
import sqlite3
from io import BytesIO
from urllib.parse import urlencode, urlparse, parse_qs

# Streamlit & Data Handling
import streamlit as st
import pandas as pd
import numpy as np
import base64

# Plotting & Visualization
import plotly.express as px
import plotly.io as pio
pio.templates.default = "plotly"
import kaleido
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# Statistical Analysis
import scipy.stats as stats
from scipy.stats import chi2_contingency, shapiro, ttest_ind, mannwhitneyu, f_oneway
from scipy.spatial.distance import pdist, squareform
import statsmodels.api as sm
import statsmodels.formula.api as smf
from statsmodels.stats.power import TTestIndPower
from sklearn.preprocessing import StandardScaler
from sklearn.preprocessing import LabelEncoder
from sklearn.decomposition import PCA

# File Handling & PDF Processing
import PyPDF2
from PyPDF2 import PdfMerger
from PIL import Image
import tempfile
import fitz

# Report Generation
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors

# AI/ML & NLP
from transformers import pipeline

#--------------------------------------------------
# Streamlit App Style
#--------------------------------------------------
st.set_page_config(page_title="Steve", layout="wide")

def apply_custom_styles():
    st.markdown(
        """
        <style>
            .stApp {
                background-color: #dde5c2;  /* Light olive green */
            }
            html, body, [class*="css"] {
                color: #2f4f2f; /* dark olive */
                font-family: Arial, sans-serif;
            }
            h1, h2, h3 {
                color: #2f4f2f; /* dark olive */
            }
            .image-container {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
            }

            /* General font styling */
            html, body, [class*="css"] {
                color: #2f4f2f; /* dark olive */
                font-family: Arial, sans-serif;
            }

            /* Headings */
            h1, h2, h3, h4, h5, h6 {
                color: #2f4f2f; /* dark olive */
            }

            /* Form labels */
            .stTextInput > label, .stSelectbox > label, .stSlider > label {
                color: black;
            }

            /* Buttons */
            .stButton > button {
                background-color: beige;
                color: black;
                border-radius: 5px;
                border: 1px solid black;
            }

            /* Tables and DataFrames */
            .stDataFrame, .stTable {
                background-color: white;
                color: black;
            }

            /* Sidebar */
            .css-1d391kg {
                background-color: #c8d8a5;  /* Slightly darker for sidebar */
                color: black;
            }

            /* Optional: Add padding to main container */
            .stApp {
                padding: 1rem;
            }
            
            footer {
                visibility: hidden;
            }
            .footer-custom {
                position: fixed;
                bottom: 0;
                left: 0;
                width: 100%;
                background-color: #bfcda3;
                text-align: center;
                padding: 8px;
                font-size: 14px;
                font-weight: bold;
                color: black;
            }
        </style>
        <div class="footer-custom">
            Steve Version 1.3.2025
        </div>
        """,
        unsafe_allow_html=True
    )

# Add this right at the top of your Streamlit script (first thing after import statements)
apply_custom_styles()

def image_to_base64(image_path):
    with open(image_path, "rb") as img_file:
        return base64.b64encode(img_file.read()).decode()

base64_image = image_to_base64("steve_photo.png")

st.markdown(
    f"""
    <style>
        .image-container {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
        }}
        .welcome-text {{
            font-size: 52px;
            font-weight: bold;
            color: #2f4f2f; /* dark olive */
        }}
        .top-right-image {{
            height: 150px;
            width: 150px;
            border-radius: 10px;
        }}
    </style>
    <div class="image-container">
        <div class="welcome-text">Welcome to Steve</div>
        <img src="data:image/png;base64,{base64_image}" class="top-right-image">
    </div>
    """,
    unsafe_allow_html=True
)

# Example Logo Placeholder
def add_logo():
    st.sidebar.image("steve_logo.png", width=100)

# Example: Use the logo function (you can place this wherever you want)
add_logo()

#--------------------------------------------------
# Functions
#--------------------------------------------------

# Initialize Hugging Face Text Generation Model
generator = pipeline('text-generation', model='gpt2')
#--------------------------------------------------
# Step 2: Function to validate and clean the data

REQUIRED_COLUMNS = {"ID"}

def read_file(file):
    """Reads a single file (CSV or Excel) into a Pandas DataFrame."""
    file_type = file.name.split(".")[-1].lower()
    
    read_func = {
        "xlsx": lambda f: pd.read_excel(f, engine="openpyxl"),
        "csv": lambda f: pd.read_csv(f)
    }.get(file_type)

    if read_func:
        try:
            return read_func(file)
        except Exception as e:
            st.error(f"Error reading {file.name}: {e}")
    else:
        st.error(f"Unsupported file format: {file.name}")
    
    return None

# Function to validate and clean the data
def validate_and_clean_data(df, file_name):
    """Validates and cleans a DataFrame."""
    errors = []

    if df is None:
        errors.append(f"Failed to load {file_name}")
        return errors, None

    # Check for missing required columns (convert df.columns to a set)
    missing_cols = REQUIRED_COLUMNS - set(df.columns)
    if missing_cols:
        errors.append(f"Missing required columns: {missing_cols} in {file_name}")

    if "ID" in df.columns:
        duplicate_count = df["ID"].duplicated().sum()
        if duplicate_count > 0:
            errors.append(f"{duplicate_count} duplicate participant IDs found in {file_name}")
            df = df.drop_duplicates(subset="ID", keep="first")

        # Check for missing IDs
        if df["ID"].isna().sum() > 0:
            errors.append(f"Missing participant IDs in {file_name}")

    return errors, df

#--------------------------------------------------    
# Step 3: Function to perform power calculation
def count_participants_with_power(df, group_by_col, cohort_col="Cohort", min_sample_size=30, alpha=0.05, power=0.8, effect_size=0.5):
    count_df = df.groupby([cohort_col, group_by_col]).size().reset_index(name="count")

    # Calculate required sample size per group using power analysis
    analysis = TTestIndPower()
    required_n = analysis.solve_power(effect_size=effect_size, alpha=alpha, power=power, alternative='two-sided')
    required_n = np.ceil(required_n).astype(int)  # Round up to nearest whole number

    # Check if each group meets the required sample size
    count_df["Has Power"] = count_df["count"].apply(lambda x: "Sufficient" if x >= required_n else "Insufficient")

    # Pivot table for better readability
    count_pivot = count_df.pivot(index=group_by_col, columns=cohort_col, values="count").fillna(0).astype(int)

    # Power assessment pivot
    power_pivot = count_df.pivot(index=group_by_col, columns=cohort_col, values="Has Power").fillna("Insufficient")

    # Power analysis summary
    power_summary = pd.DataFrame({"Required Sample Size": [required_n],
                                  "Effect Size (Cohen's d)": [effect_size],
                                  "Alpha (Significance Level)": [alpha],
                                  "Power (1 - Beta)": [power]
                                 })
    # Store results in session state
    power_text = f"Participant Count by Group:\n {count_pivot}\n Power Assessment by Group:\n {power_pivot}\n Power Analysis Summary:\n {power_summary}"
    text = f"**Power calculations:** \n {power_text}"
    st.session_state.pdf_content.append({"text": text, "figure": None})

    return count_pivot, power_pivot, power_summary
#--------------------------------------------------
#Step 4: Manual Visualization

def plot_data(df, x_col, y_col=None, plot_type="Bar Chart", color_col=None, facet_col="Cohort", title=None):
    fig_md = None

    # Default title if not provided
    if title is None:
        title = f"{y_col if y_col else 'Percentage'} vs {x_col} (Faceted by {facet_col})"

    # Ensure categorical columns are strings
    if df[x_col].dtype != "object":
        df[x_col] = df[x_col].astype(str)

    if color_col and df[color_col].dtype != "object":
        df[color_col] = df[color_col].astype(str)

    df_grouped = df.copy()

    # If y_col is specified, ensure it is numeric for mean/std calculations
    if y_col:
        df_grouped[y_col] = pd.to_numeric(df_grouped[y_col], errors='coerce')
        #df_grouped = df_grouped.dropna(subset=[y_col])  # Drop rows where conversion to numeric failed

    # Debug: Check the data after numeric conversion
    print(f"Data after conversion:\n{df_grouped[[x_col, y_col, color_col, facet_col]].head()}")
    
    if plot_type == "Bar Chart - SD":
        if y_col:
            # Bar chart for mean ± SD
            summary_df = df_grouped.groupby([facet_col, x_col, color_col])[y_col].agg(['mean', 'std']).reset_index()

            # Debug: Check the aggregated summary data
            print(f"Aggregated Data (mean, std):\n{summary_df.head()}")

            # Ensure we have valid values
            if summary_df['mean'].isnull().any() or summary_df['std'].isnull().any():
                print("Warning: Some values are NaN after aggregation. Check your data.")
            
            # Plot the bar chart with error bars
            fig_md = px.bar(summary_df, x=x_col, y="mean", color=color_col, facet_col=facet_col,
                            error_y="std", title=title,
                            labels={"mean": y_col, "std": "Standard Deviation"})
    elif plot_type == "Bar Chart":
        # Percentage bar chart (original logic for proportions)
        count_df = df.groupby([facet_col, x_col, color_col]).size().reset_index(name="count")
        count_df["percent"] = count_df.groupby([facet_col, x_col])["count"].transform(lambda x: x / x.sum() * 100)

        # Debug: Check the percentage data
        print(f"Percentage Data:\n{count_df.head()}")

        fig_md = px.bar(count_df, x=x_col, y="percent", color=color_col, facet_col=facet_col,
                        title=f"Percentage of {color_col} in {x_col} (Faceted by {facet_col})",
                        labels={"percent": "Percentage (%)"}, text="percent")

    elif plot_type == "Box Plot":
        fig_md = px.box(df_grouped, x=x_col, y=y_col, color=color_col, facet_col=facet_col, title=title)

    elif plot_type == "Histogram":
        fig_md = px.histogram(df_grouped, x=x_col, color=color_col, facet_col=facet_col, title=f"Distribution of {x_col}", height=600)

    elif plot_type == "Line Chart":
        if y_col:
            # Line chart with mean ± SD as error bars
            summary_df = df_grouped.groupby([facet_col, x_col, color_col])[y_col].agg(['mean', 'std']).reset_index()

            # Debug: Check the aggregated data for line chart
            print(f"Line Chart Aggregated Data:\n{summary_df.head()}")

            fig_md = px.line(summary_df, x=x_col, y="mean", color=color_col, facet_col=facet_col,
                             error_y="std", title=title,
                             labels={"mean": y_col, "std": "Standard Deviation"})
        else:
            fig_md = px.line(df_grouped, x=x_col, y=y_col, color=color_col, facet_col=facet_col, title=title)

    elif plot_type == "Scatter Plot":
        fig_md = px.scatter(df_grouped, x=x_col, y=y_col, color=color_col, facet_col=facet_col, title=title)

    elif plot_type == "Violin Plot":
        fig_md = px.violin(df_grouped, x=x_col, y=y_col, color=color_col, facet_col=facet_col,
                           box=True, points="all", title=title, 
                           color_discrete_sequence=px.colors.qualitative.Set1)

    # Debugging step
    print(f"Plot Type: {plot_type}")
    if fig_md is None:
        raise ValueError(f"Plot of type '{plot_type}' could not be generated. Please check the input data and plot type.")

    # Apply layout and save plot
    fig_md.update_layout(template="plotly")

    image_path = f"Metadata_{x_col}_{plot_type}plot.png"
    save_plot_as_png(fig_md, image_path)

    # Append to session state PDF content
    text = f"{plot_type} of {y_col} vs {x_col}" if y_col else f"{plot_type} of {x_col}"
    st.session_state.pdf_content.append({"text": text, "figure": fig_md})

    return fig_md


#--------------------------------------------------
# Step 5: Function to store data in SQLite

def store_data_in_sqlite(df):
    print(f"Data to be inserted:\n{df.head()}")  # Print the first few rows of the data

    db_path = 'test_data.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Ensure "ID" column is present
    if "ID" not in df.columns:
        raise ValueError("The uploaded dataset must contain an 'ID' column.")

    # Create table if not exists
    columns = df.columns
    create_table_query = f"CREATE TABLE IF NOT EXISTS test ({', '.join([f'{col} TEXT' for col in columns])})"
    cursor.execute(create_table_query)

    # Debugging: Verify table creation
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f"Tables in database after creation: {tables}")

    # Insert data
    for _, row in df.iterrows():
        insert_query = f"INSERT INTO test ({', '.join(columns)}) VALUES ({', '.join(['?' for _ in columns])})"
        cursor.execute(insert_query, tuple(row.astype(str)))  # Convert to string to avoid type mismatches

    conn.commit()
    print(f"{len(df)} rows inserted.")
    conn.close()

# Function to query SQLite database securely
def query_database(query):
    conn = sqlite3.connect('test_data.db')
    cursor = conn.cursor()

    # Check if "test" table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='test'")
    if cursor.fetchone() is None:
        st.error("Error: No data found. Please upload files and validate first.")
        conn.close()
        return pd.DataFrame()  # Return empty DataFrame

    try:
        # Ensure we have a well-formed query without semicolons or multiple statements
        query = query.strip().replace(";", "")  # Remove potential semicolons to avoid multi-statements
        
        # Now we can safely pass the query to the cursor
        cursor.execute(f"SELECT * FROM test WHERE {query}")
        result = cursor.fetchall()

        # Get column names
        columns = [desc[0] for desc in cursor.description]
        result_df = pd.DataFrame(result, columns=columns)

        if result_df.empty:
            st.warning("No matching records found.")

    except Exception as e:
        st.error(f"Error executing query: {e}")
        result_df = pd.DataFrame()  # Return empty DataFrame

    conn.close()
    return result_df

# Function to generate AI-based response
def generate_response(query, db_results):
    if db_results:
        result_count = len(db_results)
        response_text = f"The query '{query}' returned {result_count} patients. Details are available in the database.\n"
    else:
        response_text = f"No patients were found for the query: '{query}'."

    generated_text = generator(response_text, max_length=150)
    return generated_text[0]['generated_text']
#--------------------------------------------------
# Step 6: Metadata statistical tests

# Function to classify columns as categorical or numerical
def classify_columns(df):
    cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
    num_cols = df.select_dtypes(include=['number']).columns.tolist()
    return cat_cols, num_cols

# Function to check normality using the Shapiro-Wilk test
def check_normality(df, num_cols):
    normality_results = {}
    for col in num_cols:
        stat, p_value = stats.shapiro(df[col].dropna())
        normality_results[col] = p_value
    return normality_results

# Perform statistical tests
def perform_stat_tests(df, cat_cols, num_cols, normality_results, group_col, p_threshold):
    sig_results = {}
    
    # Perform Chi-Square or Fisher's Exact Test for categorical columns
    for col in cat_cols:
        if group_col in df.columns:
            contingency_table = pd.crosstab(df[group_col], df[col])
            if (contingency_table < 5).any().any():
                # Use Fisher's Exact Test for small sample sizes
                _, p_value = stats.fisher_exact(contingency_table)
            else:
                chi2_stat, p_value, _, _ = stats.chi2_contingency(contingency_table)
            
            p_value = p_value.item() if isinstance(p_value, np.ndarray) else p_value
            if p_value < p_threshold:
                sig_results[col] = ("Chi-Square or Fisher's Exact", p_value)
    
    # Perform t-tests or non-parametric tests for numerical columns
    for col in num_cols:
        if group_col in df.columns:
            if normality_results[col] < p_threshold:
                t_stat, p_value = stats.ttest_ind(df[df[group_col] == 'Patients'][col].dropna(), 
                                                   df[df[group_col] == 'Controls'][col].dropna())
                p_value = p_value.item() if isinstance(p_value, np.ndarray) else p_value
                if p_value < p_threshold:
                    sig_results[col] = ("T-Test", p_value)
            else:
                stat, p_value = stats.mannwhitneyu(df[df[group_col] == 'Patients'][col].dropna(), 
                                                   df[df[group_col] == 'Controls'][col].dropna())
                p_value = p_value.item() if isinstance(p_value, np.ndarray) else p_value
                if p_value < p_threshold:
                    sig_results[col] = ("Mann-Whitney U", p_value)
    
    return sig_results

# Plot the results
def plot_results(df, sig_results, group_col):
    if not sig_results:
        st.write("No statistically significant differences found.")
        return
    
    num_plots = len(sig_results)
    cols = 2
    rows = (num_plots // cols) + (num_plots % cols > 0)
    
    fig = make_subplots(rows=rows, cols=cols, subplot_titles=[f"{col} ({test}, p={p:.4f})" for col, (test, p) in sig_results.items()])
    
    row, col_idx = 1, 1
    for col, (test, p) in sig_results.items():
        if col == group_col:
            continue
            
        if test == "Chi-Square" or test == "Fisher's Exact":
            # Calculate percentages for each category in group_col
            df_percentages = df.groupby([col, group_col]).size().reset_index(name='count')
            if 'count' in df_percentages.columns:
                df_percentages = df_percentages.rename(columns={'count': f'{col}_count'})
            df_percentages['percentage'] = df_percentages.groupby(col)[f'{col}_count'].transform(lambda x: x / x.sum() * 100)
            
            # Create the bar plot with percentages
            hist = px.bar(df_percentages, x=col, y='percentage', color=group_col, barmode='group', 
                          labels={col: col, 'percentage': 'Percentage'})
            for trace in hist.data:
                fig.add_trace(trace, row=row, col=col_idx)
        else:
            # For other tests (e.g., boxplots)
            box = px.box(df, x=group_col, y=col)
            for trace in box.data:
                fig.add_trace(trace, row=row, col=col_idx)
        
        col_idx += 1
        if col_idx > cols:
            row += 1
            col_idx = 1
    
    fig.update_layout(height=300 * rows, width=900, title_text="Statistical Test Results",
                      template="plotly"
                      )
    st.plotly_chart(fig)

# Main function to process data
def main(df, group_col, subset_col=None, subset_value=None, p_threshold=0.05):
    if subset_col and subset_value:
        df = df[df[subset_col] == subset_value]
    
    cat_cols, num_cols = classify_columns(df)
    normality_results = check_normality(df, num_cols)
    
    all_sig_results = {}
    for col in cat_cols + num_cols:
        sig_results = perform_stat_tests(df, [col] if col in cat_cols else [], [col] if col in num_cols else [], normality_results, group_col, p_threshold)
        all_sig_results.update(sig_results)
    
    plot_results(df, all_sig_results, group_col)
    return all_sig_results

# Run for all subsets
def run_for_all_subsets(df, group_col, subset_col=None, p_threshold=0.05):
    if subset_col:
        unique_values = df[subset_col].dropna().unique()
        results = {}
        for value in unique_values:
            st.write(f"Processing subset: {subset_col} = {value}")
            results[value] = main(df, group_col, subset_col, value, p_threshold)
        return results
    
    return main(df, group_col, subset_col=None, p_threshold=p_threshold)

#--------------------------------------------------
# Step 7: Alpha-diversity
def shannon_diversity(microbiome_data):
    """Calculate Shannon diversity index."""
    proportions = microbiome_data.div(microbiome_data.sum(axis=1), axis=0)
    shannon_index = - (proportions * np.log(proportions)).sum(axis=1)
    return shannon_index

def simpson_diversity(microbiome_data):
    """Calculate Simpson's diversity index."""
    proportions = microbiome_data.div(microbiome_data.sum(axis=1), axis=0)
    simpson_index = 1 - (proportions ** 2).sum(axis=1)
    return simpson_index

def alpha_div_test(results_df, covariates, p_threshold=0.05):
    """
    Perform alpha diversity tests (Shannon and Simpson) based on covariates.
    results_df: DataFrame containing covariates and computed diversity indices.
    """
    alpha_results = {}

    for covariate in covariates:
        # Ensure the covariate is categorical (bin continuous if necessary)
        if results_df[covariate].dtype != 'object' and results_df[covariate].nunique() > 2:
            try:
                results_df[covariate] = pd.qcut(results_df[covariate], q=2, labels=["low", "high"])
            except ValueError:
                results_df[covariate] = pd.cut(results_df[covariate], bins=2, labels=["low", "high"])

        if results_df[covariate].nunique() < 2:
            alpha_results[covariate] = {
                'Shannon_p_value': np.nan,
                'Simpson_p_value': np.nan,
                'Shannon_significant': False,
                'Simpson_significant': False
            }
            continue

        group1 = results_df[results_df[covariate] == results_df[covariate].unique()[0]]
        group2 = results_df[results_df[covariate] == results_df[covariate].unique()[1]]

        shannon_p_value = ttest_ind(group1['Shannon'], group2['Shannon'], nan_policy='omit').pvalue
        simpson_p_value = ttest_ind(group1['Simpson'], group2['Simpson'], nan_policy='omit').pvalue

        alpha_results[covariate] = {
            'Shannon_p_value': shannon_p_value,
            'Simpson_p_value': simpson_p_value,
            'Shannon_significant': shannon_p_value < p_threshold,
            'Simpson_significant': simpson_p_value < p_threshold
        }

        formatted_results = "\n".join([
            f"{key}: Shannon p = {value['Shannon_p_value']:.4f}, "
            f"Significant = {'Yes' if value['Shannon_p_value'] <= p_threshold else 'No'}\n"
            f"Simpson p = {value['Simpson_p_value']:.4f}, "
            f"Significant = {'Yes' if value['Simpson_p_value'] <= p_threshold else 'No'}"
            for key, value in alpha_results.items()
        ])

        if "pdf_content" not in st.session_state:
            st.session_state.pdf_content = []
            
        text = f"**Alpha-diversity:** \n {formatted_results} \n Covariates: {covariates} \n Significant threshold: {p_threshold}"
        #st.session_state.pdf_content.append(f"Alpha-diversity Results:\n{formatted_results}")
        st.session_state.pdf_content.append({
            'text': text,
            'figure': None})
    
    return alpha_results

#--------------------------------------------------
# Step 8: Beta-diversity
def beta_div_test(merged_df_gut, group_column, covariates, p_threshold=0.05):
    """
    Perform beta-diversity analysis using Bray-Curtis dissimilarity and PERMANOVA-like test.

    Parameters:
    merged_df_gut (pd.DataFrame): Microbiome + metadata (samples x features + covariates).
    group_column (str): Grouping variable (e.g., 'Status').
    covariates (list): List of covariates to adjust for.
    p_threshold (float): P-value cutoff for significance.

    Returns:
    dict: Beta-diversity results with p-values for each covariate.
    """

    # --- Step 1: Bray-Curtis Dissimilarity Matrix ---
    feature_columns = [col for col in merged_df_gut.columns if col not in covariates + [group_column]]
    bray_curtis_matrix = squareform(pdist(merged_df_gut[feature_columns], metric='braycurtis'))
    dissimilarity_df = pd.DataFrame(bray_curtis_matrix, index=merged_df_gut.index, columns=merged_df_gut.index)

    # --- Step 2: PERMANOVA-like Test (One-Way ANOVA on Distances) ---
    beta_results = {}

    le = LabelEncoder()
    merged_df_gut[group_column] = le.fit_transform(merged_df_gut[group_column])

    group_data = []
    for group, group_indices in merged_df_gut.groupby(group_column).groups.items():
        subset = dissimilarity_df.loc[group_indices, group_indices]
        dist_values = subset.values[np.triu_indices(len(subset), k=1)]
        group_data.append(dist_values)

    if len(group_data) > 1:
        f_stat, p_val = f_oneway(*group_data)
        beta_results[group_column] = {'PERMANOVA_p_value': p_val, 'PERMANOVA_significant': p_val < p_threshold}
    else:
        beta_results[group_column] = {'PERMANOVA_p_value': np.nan, 'PERMANOVA_significant': False}

    # --- Step 3: Covariate Adjustment (Optional) ---
    for covariate in covariates:
        if merged_df_gut[covariate].dtype != 'object':
            merged_df_gut[covariate] = pd.qcut(merged_df_gut[covariate], q=2, labels=["low", "high"])

        le.fit(merged_df_gut[covariate])
        merged_df_gut[covariate] = le.transform(merged_df_gut[covariate])

        covariate_group_data = []
        for group, group_indices in merged_df_gut.groupby(covariate).groups.items():
            subset = dissimilarity_df.loc[group_indices, group_indices]
            dist_values = subset.values[np.triu_indices(len(subset), k=1)]
            covariate_group_data.append(dist_values)

        if len(covariate_group_data) > 1:
            f_stat, p_val = f_oneway(*covariate_group_data)
            beta_results[covariate] = {'PERMANOVA_p_value': p_val, 'PERMANOVA_significant': p_val < p_threshold}
        else:
            beta_results[covariate] = {'PERMANOVA_p_value': np.nan, 'PERMANOVA_significant': False}

    # --- Step 4: PCoA Plot using PCA (Principal Component Analysis) ---
    pca = PCA(n_components=2)  # Calculate the first two principal components
    pcoa_results = pca.fit_transform(bray_curtis_matrix)  # PCoA based on Bray-Curtis distances
    ord_df = pd.DataFrame(pcoa_results, columns=["PC1", "PC2"], index=merged_df_gut.index)
    ord_df[group_column] = merged_df_gut[group_column].values

    # --- Step 5: Plot the Results ---
    if ord_df[group_column].nunique() == 2:
        remap = {
            ord_df[group_column].unique()[0]: "Control",
            ord_df[group_column].unique()[1]: "Patient"
        }
        ord_df[group_column] = ord_df[group_column].map(remap)
        
    fig_bd = px.scatter(ord_df, x='PC1', y='PC2', color=group_column, title="PCoA (PCA) - Beta Diversity (Bray-Curtis)", color_discrete_sequence=px.colors.qualitative.Set2,
        hover_name=ord_df.index)
    
    fig_bd.update_traces(marker=dict(size=10, line=dict(width=1, color='DarkSlateGrey')))
    
    fig_bd.update_layout(
        width=700, height=500,
        xaxis_title=f"PC1 ({ord_df['PC1'].var()*100:.2f}% variance explained)",
        yaxis_title=f"PC2 ({ord_df['PC2'].var()*100:.2f}% variance explained)",
        template="plotly"
    )
    
    # Save plot as PNG
    image_path = "pcoa_plot.png"
    fig = fig_bd
    save_plot_as_png(fig, image_path)

    # Format and display results
    formatted_results = "\n".join(
        [f"{key}: PERMANOVA p-value = {value['PERMANOVA_p_value']:.4f} \n Significant = {value['PERMANOVA_significant']}"
         for key, value in beta_results.items()]
         )
    beta_results = formatted_results
    
    # Append results to the session state for PDF generation
    if "pdf_content" not in st.session_state:
        st.session_state.pdf_content = []  # Initialize if it doesn't exist

    text = f"**Beta-diversity results:**\n{beta_results}\n Covariates: {covariates}\n Significant threshold: {p_threshold}"
    #st.session_state.pdf_content.append(f"Beta-diversity Results:\n{formatted_results}")
    st.session_state.pdf_content.append({
        'text':text,
        'figure': fig_bd
        })
    return beta_results, fig_bd

#--------------------------------------------------
# Step 9: Differential abundance
def diff_abun_test(merged_df_gut, group_column, covariates=None, p_threshold=0.05, labels="Yes"):
    """
    Perform differential abundance testing on microbial features using a linear model, accounting for covariates.
    
    Parameters:
    merged_df_gut (pd.DataFrame): Microbiome data (rows = samples, columns = microbial features)
    group_column (str): Column name in merged_df_gut that holds group information (e.g., 'Status')
    covariates (list of str, optional): List of column names in merged_df_gut to be used as covariates (default is None)
    p_threshold (float): p-value threshold for significance
    
    Returns:
    pd.DataFrame: Results of the differential abundance testing

    Debug:
    st.write(f"Group column received: {group_column}")
    st.write(f"Covariates received: {covariates}")
    st.write(f"Data frame received: {merged_df_gut}")
    st.write(f"Columns in merged_df_gut: {merged_df_gut.columns}")
    merged_df_gut.columns = merged_df_gut.columns.str.strip()
    st.write(f"Columns after stripping spaces: {merged_df_gut.columns}")
    """

    # Ensure the group column exists
    if group_column not in merged_df_gut.columns:
        raise ValueError(f"Group column '{group_column}' not found in merged_df_gut.")
        
    # Ensure the group column exists
    if group_column not in merged_df_gut.columns:
        raise ValueError(f"Group column '{group_column}' not found in the DataFrame. Available columns: {', '.join(merged_df_gut.columns)}")
    
    # Ensure covariates (if provided) are valid
    if covariates:
        invalid_covariates = [cov for cov in covariates if cov not in merged_df_gut.columns]
        if invalid_covariates:
            raise ValueError(f"Invalid covariates: {', '.join(invalid_covariates)}")

    # Initialize results container
    da_results = []

    # Convert non-numeric columns to categorical (if necessary)
    for cov in covariates:
        if merged_df_gut[cov].dtype == 'object':
            merged_df_gut[cov] = merged_df_gut[cov].astype('category')
    
    st.write(f"Linear model: feature ~ group_column + covariates (optional)")
    # Iterate through each feature in the dataset
    for feature in merged_df_gut.columns:
        # Skip the group column itself
        if feature == group_column:
            continue
        
        # Ensure the feature is numeric
        if merged_df_gut[feature].dtype not in ['int64', 'float64']:
            continue  # Skip non-numeric features
        
        # Create the formula for the linear model
        formula = f"{feature} ~ {group_column}"
        
        # If covariates are provided, add them to the formula
        if covariates:
            formula += " + " + " + ".join(covariates)
        
        # Fit the linear model using OLS (Ordinary Least Squares)
        try:
            missing_covariates = [cov for cov in covariates if cov not in merged_df_gut.columns]
            assert not missing_covariates, f"The following covariates are missing from merged_df_gut: {missing_covariates}"

            model = smf.ols(formula, data=merged_df_gut).fit()
            
        except KeyError as e:
            st.write(f"KeyError encountered: {e}")

        # If there are multiple terms related to 'Status', we choose the relevant one (typically the first)
        # Find the term(s) related to 'Status' in the model parameters
        status_terms = [term for term in model.params.index if group_column in term]
        p_val = None

        # If there's at least one term related to 'Status'
        if status_terms:
            # Choose the first term (assuming it's the one we're interested in)
            group_coeff = model.params[status_terms[0]]
            p_val = model.pvalues[status_terms[0]]
        else:
            raise ValueError(f"No coefficient found for '{group_column}' in the model.")

        # Determine significance based on p-value and threshold
        significance = "Yes" if p_val < p_threshold else "No"

        # Proceed with your code to store results
        result = {
            'Feature': feature,
            'P-value': p_val if p_val is not None else 'N/A',
            'Significant': significance,  # Add significance based on p-value comparison
            'Intercept': model.params['Intercept'],
            'Group_Coefficient': group_coeff,
            'Covariate_Coefficients': {cov: model.params[cov] for cov in covariates if cov in model.params} if covariates else None
            }
        da_results.append(result)
    
        # Convert da_results list of dictionaries into a DataFrame
        da_results_df = pd.DataFrame(da_results)
        
        # Now you can access the 'P-value' and 'Significant' columns properly
        for index, row in da_results_df.iterrows():
            feature = row['Feature']
            p_value = row['P-value']
            significance = row['Significant']
                      
    # Return the results as a DataFrame
    return pd.DataFrame(da_results)

def plot_volcano(da_results, p_threshold=0.05, labels="Yes"):
    """
    Enhanced Volcano Plot in Plotly

    da_results: DataFrame containing results from differential abundance
    - Required columns: 'P-value', 'Group_Coefficient', 'Feature', 'Significant'
    - p_threshold: significance threshold
    - fc_threshold: effect size threshold (log2 fold change)
    """
    fc_threshold = 1
    label_top_n = 20
    
    # Ensure p_threshold is a numeric value
    p_threshold = float(p_threshold)  # Ensure it's a float

    da_results = pd.DataFrame(da_results)
    da_results['-log10(p-value)'] = -np.log10(da_results['P-value'])

    # Convert to numeric values, coercing errors to NaN
    da_results['P-value'] = pd.to_numeric(da_results['P-value'], errors='coerce')
    da_results['Group_Coefficient'] = pd.to_numeric(da_results['Group_Coefficient'], errors='coerce')

    # Define the volcano_color function
    def volcano_color(row, p_threshold, fc_threshold):
        """
        This function assigns colors based on significance (p-value) and effect size (fold change).

        - Red: Significant (P-value < threshold) and large effect size (absolute fold change >= threshold)
        - Blue: Significant (P-value < threshold) but small effect size
        - Green: Large effect size but not significant (P-value >= threshold)
        - Gray: Not significant and small effect size
        """
        if pd.isna(row['P-value']) or pd.isna(row['Group_Coefficient']):
            return 'gray'  # For invalid rows
        if row['P-value'] < p_threshold and abs(row['Group_Coefficient']) >= fc_threshold:
            return 'red'  # Significant and large effect size
        elif row['P-value'] < p_threshold:
            return 'blue'  # Significant but small effect size
        elif abs(row['Group_Coefficient']) >= fc_threshold:
            return 'green'  # Large effect size but not significant
        else:
            return 'gray'  # Not significant and small effect size
    
    # Apply the color categorization to the DataFrame
    da_results['Volcano_Category'] = da_results.apply(volcano_color, axis=1, p_threshold=p_threshold, fc_threshold=1)
    da_results['Label'] = ""

    if labels == "Yes":
        # Filter significant features (red color means significant)
        sig_features = da_results[da_results['Volcano_Category'] == 'red']  # Filter for significant features
        if not sig_features.empty:
            # Ensure top N features are selected by smallest p-value
            top_features = sig_features.nsmallest(label_top_n, 'P-value')['Feature'].tolist()
            # Convert to strings
            top_features = [str(feature) for feature in top_features]
            # Add labels to the features based on the top N features
            da_results['Label'] = np.where(da_results['Feature'].isin(top_features), da_results['Feature'], "")
        else:
            st.write("No significant features found.")  # In case no significant features

    # Volcano plot
    fig_v = px.scatter(
        da_results,
        x='Group_Coefficient',
        y='-log10(p-value)',
        color='Volcano_Category',
        hover_name='Feature',
        hover_data={'P-value': True, 'Group_Coefficient': True},
        text='Label',  # <-- This adds the text labels to the plot
        color_discrete_map={
            'red': 'red',     # Significant and large effect size
            'blue': 'blue',   # Significant but small effect size
            'green': 'green', # Large effect size but not significant
            'gray': 'gray'    # Not significant and small effect size
        },
        title="Differential Abundance (Volcano Plot)",
        labels={
            'Group_Coefficient': 'Effect Size (log2 Fold Change)',
            '-log10(p-value)': '-log10(p-value)',
            'Volcano_Category': 'Significance and Effect Size Categories'
        },
        width=900,
        height=600
    )

    # Add threshold lines
    fig_v.add_vline(x=fc_threshold, line=dict(color='black', dash='dash'))
    fig_v.add_vline(x=-fc_threshold, line=dict(color='black', dash='dash'))
    fig_v.add_hline(y=-np.log10(p_threshold), line=dict(color='black', dash='dash'))

    # Improve text label appearance (make smaller & offset)
    fig_v.update_traces(
        marker=dict(size=8, line=dict(width=1, color='DarkSlateGrey')),
        textposition='top center',
        textfont=dict(size=10, color='black')
    )

    # Layout tweaks
    fig_v.update_layout(
        legend_title_text='Significance',
        plot_bgcolor='rgba(245, 245, 245, 1)',
        font=dict(size=14),
        template="plotly"
        )

    # Save plot as PNG
    image_path = "vol_plot.png"
    fig = fig_v
    save_plot_as_png(fig, image_path)

    st.plotly_chart(fig_v)
    # Add explanation below the graph
    explanation_text = """
    This function assigns colors based on significance (p-value) and effect size (fold change):
    
    - **Red**: Significant (P-value < threshold) and large effect size (absolute fold change >= threshold)
    - **Blue**: Significant (P-value < threshold) but small effect size
    - **Green**: Large effect size but not significant (P-value >= threshold)
    - **Gray**: Not significant and small effect size
    """
    st.markdown(explanation_text) 
    
def plot_relative_abundance(merged_df_gut, group_column, top_n=10):
    # Identify numeric taxa columns
    taxa_columns = merged_df_gut.select_dtypes(include=[np.number]).columns.tolist()

    # Separate data by group
    control_data = merged_df_gut[merged_df_gut[group_column] == "Control"]
    patient_data = merged_df_gut[merged_df_gut[group_column] == "Patient"]

    # Aggregate mean relative abundance for each feature in the Control group
    control_means = control_data[taxa_columns].mean(axis=0)
    
    # Aggregate mean relative abundance for each feature in the Patient group
    patient_means = patient_data[taxa_columns].mean(axis=0)

    # Normalize each group to 100%
    control_total = control_means.sum()  # Total sum for the Control group
    patient_total = patient_means.sum()  # Total sum for the Patient group
    
    control_normalized = (control_means / control_total) * 100
    patient_normalized = (patient_means / patient_total) * 100

    # Convert to DataFrame for easier plotting
    control_df = control_normalized.reset_index()
    control_df.columns = ['Taxa', 'Relative Abundance']
    control_df[group_column] = 'Control'  # Add the group column

    patient_df = patient_normalized.reset_index()
    patient_df.columns = ['Taxa', 'Relative Abundance']
    patient_df[group_column] = 'Patient'  # Add the group column

    # Combine the two dataframes (Control and Patient) for plotting
    plot_df = pd.concat([control_df, patient_df])

    # Select the top N taxa across both groups
    #top_taxa = plot_df.groupby("Taxa")["Relative Abundance"].mean().nlargest(top_n).index.tolist()

    # Subset to top N taxa for plotting
    #plot_df = plot_df[plot_df["Taxa"].isin(top_taxa)]

    # Create a stacked bar chart showing relative abundance as a percentage
    fig_ra = px.bar(plot_df, 
                 x=group_column, 
                 y="Relative Abundance", 
                 color="Taxa", 
                 title=f"Relative Abundance by {group_column} (as % within each group)", 
                 barmode="stack",
                 labels={'Relative Abundance': 'Relative Abundance (%)'},
                 category_orders={group_column: ["Control", "Patient"]})  # Ensure the group column order is correct

    # Explicitly set the y-axis to show percentages from 0 to 100
    fig_ra.update_layout(
        xaxis_title=group_column,  # Label x-axis with the group name
        yaxis_title="Relative Abundance (%)",  # Label y-axis as percentage
        template="plotly"
        )

    # Save plot as PNG
    image_path = "ra_plot_percentage_no_status_group.png"
    fig = fig_ra
    save_plot_as_png(fig, image_path)

    text = f"**Relative abundance plot between {group_column} groups**\n"
    st.session_state.pdf_content.append({
            'text': text,
            'figure': fig
        })
    
    st.plotly_chart(fig_ra)

#--------------------------------------------------
# Step 10: Downloadable report
# Function to generate a data quality report

# Define required columns
REQUIRED_COLUMNS = {"ID"}  # Adjust as needed

# Function to generate a data quality report
def generate_data_quality_report(cleaned_dfs, file_names):
    report = []
    for df, file_name in zip(cleaned_dfs, file_names):
        id_column = df.get("ID", pd.Series(dtype=object))

        file_report = {
            "File Name": file_name,
            "Total Rows": len(df),
            "Total Columns": len(df.columns),
            "Missing Participant IDs": int(id_column.isna().sum()),
            "Duplicate Participant IDs": int(id_column.duplicated().sum()),
            "Missing Values (Any Column)": int(df.isna().sum().sum()),
            "Missing Required Columns": ", ".join(map(str, REQUIRED_COLUMNS - set(df.columns))),
        }
        report.append(file_report)

    report_df = pd.DataFrame(report)

    if "pdf_content" not in st.session_state:
        st.session_state.pdf_content = []

    text = f"**Data quality summary:** \n {report_df.to_string(index=False)}"
    st.session_state.pdf_content.append({"text": text, 
                                         "figure": None})
    
    return report_df

# Function to create a standalone PDF page from text and optional figure
def append_to_pdf(text, fig=None):
    page_width, page_height = letter
    margin = 50  # 1-inch margins

    pdf_buffer = io.BytesIO()
    c = canvas.Canvas(pdf_buffer, pagesize=letter)

    # Header for each page (optional)
    def add_header():
        c.setFont("Helvetica-Bold", 12)
        c.drawString(margin, page_height - margin + 10, "Final Report of Results")

    # Draw text content (handles long text across pages)
    def draw_text_block(text, start_y):
        c.setFont("Helvetica", 10)
        y_position = start_y
        for line in text.split("\n"):
            c.drawString(margin, y_position, line)
            y_position -= 14
            if y_position < margin + 100:  # Trigger new page
                c.showPage()
                add_header()
                c.setFont("Helvetica", 10)
                y_position = page_height - margin - 30
        return y_position

    # Process text (if it's a list, join it into a string)
    if isinstance(text, list):
        text = "\n".join(text)

    # Add header and draw text block
    add_header()
    y_position = draw_text_block(text, page_height - margin - 30)

    # Add plot if provided
    if fig:
        img_bytes = fig.to_image(format="png", engine="kaleido")
        img_stream = io.BytesIO(img_bytes)
        img = Image.open(img_stream).convert("RGB")

        # Scale image to fit page (leave margins)
        max_img_width = page_width - 2 * margin
        max_img_height = y_position - margin - 20
        img.thumbnail((max_img_width, max_img_height), Image.LANCZOS)

        # New page if no space left for image
        if y_position - img.height < margin:
            c.showPage()
            add_header()
            y_position = page_height - margin - 30

        # Center image horizontally
        img_x = (page_width - img.width) / 2
        img_y = y_position - img.height

        # Save and draw image
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_img:
            img.save(temp_img, format="PNG")
            temp_img_path = temp_img.name

        c.drawImage(temp_img_path, img_x, img_y, width=img.width, height=img.height)

        # Clean up temp file
        os.remove(temp_img_path)

        # Update position after image (optional space for footer)
        y_position = img_y - 20

    c.showPage()
    c.save()

    pdf_buffer.seek(0)
    return pdf_buffer

# Helper function to save the plot as an image (assumes fig is a plotly figure)
def save_plot_as_image(fig):
    if fig is None:
        raise ValueError("Figure is None, cannot save.")
    try:
        img_bytes = fig.to_image(format="png", engine="kaleido")
        return img_bytes
    except Exception as e:
        raise ValueError(f"Error saving plot as image: {e}")

def save_plot_as_png(fig, output_path):
    if fig is None:
        raise ValueError("Figure is None, unable to save it.")
    try:
        fig.write_image(output_path, format="png", engine="kaleido")
    except Exception as e:
        raise ValueError(f"An error occurred while saving the figure as PNG: {e}")
    
#--------------------------------------------------    
# NAVIGATION: Get URL query parameters
# Function to switch pages dynamically
def switch_page(page_name):
    st.query_params["page"] = page_name  # Updated to use st.query_params

# Get the current page from query parameters
query_params = st.query_params
page = query_params.get("page", "home")  # Default to "home"

#--------------------------------------------------
# Streamlit App
#--------------------------------------------------
if page == "home":
    #st.title("Welcome to Steve")
    
    # Add description with Markdown for styling
    st.markdown("""
    ## About Steve
    
    This is a data analysis tool that allows you to upload datasets and perform various operations.

    - Data Validation: Clean and validate your data before analysis.
    - Metadata:
        - Subsetting and participant selection
        - Power Calculation: Calculate statistical power based on effect size.
        - Data Visualization: Generate interactive charts and graphs for data exploration.
    - Microbiome data:
        - Alpha- and beta-diversity
        - Differential abundance

    Please upload your dataset to get started and explore the various features.
    Click buttons twice to navigate to new page!
    """)
    
# NAVIGATION: Sidebar appears only after validation
st.sidebar.subheader("MENU")

if st.sidebar.button("About"):
    switch_page("home") 
if st.sidebar.button("Upload and validation data"):
    switch_page("upload") 
if st.sidebar.button("Report download"):
    switch_page("download")

st.sidebar.subheader("Metadata")

if st.sidebar.button("Participant selection and subset"):
    switch_page("query")
if st.sidebar.button("Power calculation"):
    switch_page("power")
if st.sidebar.button("Visualizing data distribution"):
    switch_page("visualization")
if st.sidebar.button("Metadata stats test"):
    switch_page("metadata")
 
st.sidebar.subheader("Microbiome data") 
  
if st.sidebar.button("Alpha-diversity"):
    switch_page("alpha")
if st.sidebar.button("Beta-diversity"):
    switch_page("beta")
if st.sidebar.button("Differential abundance"):
    switch_page("abundance")
        
# Ensure session state variables exist
if "df" not in st.session_state:
    st.session_state.df = None  # Placeholder for data
if "validated" not in st.session_state:
    st.session_state.validated = False
if 'pdf_content' not in st.session_state:
    st.session_state.pdf_content = []

#--------------------------------------------------
# Step 1: File Upload
if page == "upload":
    st.subheader("Upload and Validation Data")
    st.markdown("""
    About uploading

    - You can upload multiple files for Metadata
    - You can only upload a single file for the microbiome. It must be quality-checked and contain count data (Relative abundance).
    - There should be corresponding IDs between all files
    - Column names should not contain ; $ % @ : "" - + =
    
    Click buttons twice to navigate to new page!
    """)
    
    # Upload metadata files (e.g., patient metadata)
    uploaded_files_metadata = st.file_uploader(
        "Upload patient metadata files (CSV or Excel)", type=["csv", "xlsx"], accept_multiple_files=True
    )

    # Upload gut microbiome data (Excel only)
    uploaded_file_gut = st.file_uploader(
        "Upload gut microbiome data (Excel)", type=["xlsx"], key="gut_file"
    )

    # Store uploaded metadata files in session state
    if uploaded_files_metadata:
        st.session_state.uploaded_files_metadata = uploaded_files_metadata
        st.write(f"**{len(uploaded_files_metadata)} file(s) uploaded.**")

    # Store uploaded gut microbiome file in session state
    if uploaded_file_gut:
        st.session_state.uploaded_file_gut = uploaded_file_gut
        st.write("**Gut file uploaded.**")

    # ---------------- Step 2.1: Data Validation ----------------
    if st.button("Data Validation"):
        dfs = [read_file(file) for file in uploaded_files_metadata]
        cleaned_dfs_metadata = []
        validation_errors_metadata = {}

        # Validate and clean each uploaded file
        for df, file in zip(dfs, uploaded_files_metadata):
            errors, cleaned_df = validate_and_clean_data(df, file.name)
            validation_errors_metadata[file.name] = errors

            if errors:
                st.error(f"Validation issues in {file.name}:")
                for error in errors:
                    st.write(f"   - {error}")
            else:
                st.success(f"{file.name} passed validation!")

            # Add cleaned data to list if no errors
            if cleaned_df is not None:
                cleaned_dfs_metadata.append(cleaned_df)

        # Merge metadata dataframes on "ID"
        if cleaned_dfs_metadata:
            combined_df_metadata = cleaned_dfs_metadata[0]
            for df in cleaned_dfs_metadata[1:]:
                combined_df_metadata = pd.merge(combined_df_metadata, df, on="ID", how="outer")

            # Drop rows where "ID" is missing after merging
            combined_df_metadata = combined_df_metadata.dropna(subset=["ID"])

            st.write("### Combined Data", combined_df_metadata)

            # Save the combined DataFrame to session state
            st.session_state.df = combined_df_metadata
            st.session_state.validated = True  # Update validation flag

            # Generate the data quality report (Ensure function is defined)
            if "generate_data_quality_report" in globals():
                report_df = generate_data_quality_report(cleaned_dfs_metadata, [file.name for file in uploaded_files_metadata])
                st.write("### Data Quality Report", report_df)
            else:
                st.warning("`generate_data_quality_report` function is missing!")

        if "uploaded_file_gut" in st.session_state and st.session_state.uploaded_file_gut:
            uploaded_file_gut = st.session_state.uploaded_file_gut

        # ---------------- Step 2.2: Gut Microbiome Data Validation ----------------
            df_gut = read_file(uploaded_file_gut)

            # Validate the gut microbiome data
            errors_gut, cleaned_df_gut = validate_and_clean_data(df_gut, uploaded_file_gut.name)

            if errors_gut:
                st.error(f"Validation issues in {uploaded_file_gut.name}:")
                st.write(f"   - {error}")
            else:
                st.success(f"{uploaded_file_gut.name} passed validation!")

            # Save gut microbiome DataFrame to session state
            if cleaned_df_gut is not None:
                st.session_state.df_gut = cleaned_df_gut

            # Ensure that the IDs match between metadata and microbiome data
            if "df" in st.session_state and "df_gut" in st.session_state:
                merged_df = pd.merge(st.session_state.df, st.session_state.df_gut, on="ID", how="outer")
                st.write("### Merged Data (Metadata + Gut Microbiome)", merged_df)

            # Save the merged DataFrame to session state
            st.session_state.merged_df = merged_df

#--------------------------------------------------           
# Step 3: Power calculation
if page == "power" and st.session_state.validated:
    st.subheader("Power Calculation")
    st.markdown("""
    About power calculation

    - The calculation that is used to determine the minimum sample size needed for a research study
    - Power: calculated as 1-β (also expressed as “1 - Type II error probability”)
        - Ideal = 0.80 or 80%
    - Alpha (significance threshold): 0.05
    - Effect size (Cohen's d): m1 – m2 / pooled SD
        - Small d=0.2; Medium d=0.5; Large d=0.8
    - https://clincalc.com/stats/samplesize.aspx
    
    Click buttons twice to navigate to new page!
    """)

    if "filtered_df" in st.session_state:
        # If the filtered DataFrame exists, use it
        df = st.session_state.filtered_df
    else:
        # Otherwise, use the original DataFrame
        df = st.session_state.df

    # User selects effect size (Cohen's d)
    effect_size = st.radio("Select Effect Size (Cohen's d)", [0.2, 0.5, 0.8], index=1, horizontal=True)

    if st.button("Submit Power Calculation"):
            # Perform the power calculation
        count_df, power_df, power_summary = count_participants_with_power(df, group_by_col="Status", effect_size=effect_size)

        st.write("Participant Count by Group:", count_df)
        st.write("Power Assessment by Group:", power_df)
        st.write("Power Analysis Summary:", power_summary)
        
#--------------------------------------------------
# Step 4: Visualization
if page == "visualization" and st.session_state.validated:
    st.subheader("Manual Data Visualization")
    st.markdown("""
    About data visualization

    - Based on metadata 
    - Bar plots: horizontal column chart to show summary statistics for categorical data. No error bars, show percentages.
    - Bar plots - SD: horizontal column chart to show summary statistics. You can calculate the mean, standard deviation, and plot error bars based on the standard deviation or standard error.
    - Boxplots: to show between-group and within-group variation, 
        - five-number summary: minimum, first quartile, median, third quartile, and maximum
    - Histograms: to show data distributions.
    - Line graphs: to plot continuous data or data with infinite values, trends over time.
    - Scatter plots: to show relationships among numerical variables.
    - Violin plot: to observe the distribution of numeric data
    
    Click buttons twice to navigate to new page!
    """)

    if "filtered_df" in st.session_state:
        # If the filtered DataFrame exists, use it
        df = st.session_state.filtered_df
    else:
        # Otherwise, use the original DataFrame
        df = st.session_state.df
    st.write("**Select Columns for Visualization**")

    numerical_columns = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_columns = df.select_dtypes(exclude=[np.number]).columns.tolist()

    x_col = st.selectbox("X-axis", numerical_columns + categorical_columns)
    y_col = st.selectbox("Y-axis", numerical_columns + categorical_columns)

    # Optional Color Coding
    color_col = st.selectbox("Color By (Optional)", ["None"] + categorical_columns)

    # Facet plots
    facet_col = st.selectbox("Facet By", ["None"] + categorical_columns)

    # Graph type selection
    graph_type = st.selectbox("Select Graph Type", ["Bar Chart", "Bar Chart - SD", "Box Plot", "Histogram", "Line Chart", "Scatter Plot", "Violin Plot"])

    # Interactive filters
    filter_col = st.selectbox("Filter By (Optional)", ["None"] + categorical_columns)

    if filter_col != "None":
        unique_values = df[filter_col].unique()
        selected_values = st.multiselect(f"Select values for {filter_col}", unique_values, default=unique_values)
        df = df[df[filter_col].isin(selected_values)]  # Apply filter

    if st.button("Generate Plot"):
        if df.empty:
            st.error("No data available after filtering. Please adjust filters.")
        else:
            # Use the reusable plotting function
            fig = plot_data(df, x_col, y_col, plot_type=graph_type, color_col=color_col, facet_col=facet_col)

            st.plotly_chart(fig, use_container_width=True)
            
#--------------------------------------------------    
# Step 5: Query - Participant selection and subset
# Ensure session state key is initialized
st.session_state.setdefault("pdf_content", [])

# Step 5: Query
if page == "query" and st.session_state.validated:
    st.subheader("Participant selection and subset")

    # Make sure the DataFrame is available in session state
    if "df" in st.session_state:
        df = st.session_state.df
        
        # Store the data in SQLite
        store_data_in_sqlite(df)  # Ensure that this function is called to save data in the SQLite DB

        # List numerical and categorical columns for the user to select from
        numerical_columns = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_columns = df.select_dtypes(exclude=[np.number]).columns.tolist()

        st.markdown("Available columns for selection: " + ', '.join(numerical_columns + categorical_columns))

        # Allow users to filter by multiple columns
        filter_criteria = []
        num_filters = st.number_input("Number of filters", min_value=1, max_value=5, value=1)

        for i in range(num_filters):
            st.subheader(f"Filter {i+1}")
            filter_col = st.selectbox(f"Select Filter Column {i+1}", categorical_columns + numerical_columns, key=f"filter_col_{i}")
            
            if filter_col in numerical_columns:
                filter_operator = st.selectbox(f"Select Comparison Operator {i+1}", ["=", ">", "<", ">=", "<="], key=f"operator_{i}")
                filter_value = st.number_input(f"Enter {filter_col} value {i+1}", value=0.0, key=f"value_{i}")
            else:
                filter_operator = st.selectbox(f"Select Comparison Operator {i+1}", ["=", "!="], key=f"operator_cat_{i}")
                filter_value = st.selectbox(f"Enter {filter_col} value {i+1}", df[filter_col].dropna().unique(), key=f"value_cat_{i}")
            
            filter_criteria.append((filter_col, filter_operator, filter_value))

            filtered_df = df.copy()
            
            for filter_col, filter_operator, filter_value in filter_criteria:
                if filter_operator == "=":
                    filtered_df = filtered_df[filtered_df[filter_col] == filter_value]
                elif filter_operator == "!=":
                    filtered_df = filtered_df[filtered_df[filter_col] != filter_value]
                elif filter_operator == ">":
                    filtered_df = filtered_df[filtered_df[filter_col] > filter_value]
                elif filter_operator == "<":
                    filtered_df = filtered_df[filtered_df[filter_col] < filter_value]
                elif filter_operator == ">=":
                    filtered_df = filtered_df[filtered_df[filter_col] >= filter_value]
                elif filter_operator == "<=":
                    filtered_df = filtered_df[filtered_df[filter_col] <= filter_value]
                    
            # Display filtered data and number of selected participants
            st.write(f"### Filtered Data")
            st.write(filtered_df)

        # Button to apply filters
        apply_filters = st.button("Apply Filters")

        if apply_filters:
            # Display filtered data and number of selected participants
            st.write(f"Number of participants selected: {len(filtered_df)}")
            # Save the filtered data to session state
            st.session_state.filtered_df = filtered_df

            # Subset the microbiome data (if available)
            if "df_gut" in st.session_state:
                df_gut = st.session_state.df_gut
                subset_gut = df_gut[df_gut["ID"].isin(filtered_df["ID"])]
                st.session_state.filtered_df_gut = subset_gut
                st.write(f"### Subset Gut Microbiome Data")
                st.write(subset_gut)

            # Store the filtered DataFrame for use in other steps
            st.session_state.filtered_df = filtered_df

            #st.session_state.pdf_content.append(f"Metadata Statistical Tests Results:\n{results_text}")
            text = f"**Data subset** \n Criteria: \n {filter_criteria} \n Number of participants selected: {len(filtered_df)}"
            st.session_state.pdf_content.append({
                'text': text,
                'figure': None})
        else:
            st.warning("No data available for selection. Please upload and validate data first.")

        
#--------------------------------------------------
# Step 6: Metadata statistical tests
if page == "metadata" and st.session_state.validated:
    st.subheader("Metadata Statistical Tests")
    st.markdown("""
    About statistical tests

    - Suggested alpha (significance threshold): 0.05
    - Shapiro-Wilk test: Normality
    - Chi-Square or Fisher's Exact Test (n < 5) for categorical columns
    - t-tests or non-parametric tests for numerical columns
    
    Click buttons twice to navigate to new page!
    """)
    
    if "filtered_df" in st.session_state:
        # If the filtered DataFrame exists, use it
        df = st.session_state.filtered_df
    else:
        # Otherwise, use the original DataFrame
        df = st.session_state.df

    # Select the group column for the statistical test
    group_col = st.selectbox("Select Group Column", df.columns)

    # Optional: Select a subset column to filter data
    subset_col = st.selectbox("Select Subset Column (optional)", [None] + df.columns.tolist())
    subset_value = None
    if subset_col:
        subset_value = st.selectbox(f"Select value in {subset_col}", df[subset_col].dropna().unique())
        
    # Set the p-value threshold
    p_threshold = st.slider("Select p-value threshold", 0.01, 0.1, 0.05, 0.01)
        
    if st.button("Run Analysis"):
        # Run statistical tests based on the selection
        results = run_for_all_subsets(df, group_col, subset_col, p_threshold)
    
        # Process results into a DataFrame for easier handling
        if isinstance(results, dict) and isinstance(list(results.values())[0], dict):
            # Case: Multiple subsets (results is a nested dictionary)
            all_results = []
            for subset, subset_results in results.items():
                for col, (test, p_value) in subset_results.items():
                    all_results.append({
                        "subset": subset,
                        "column": col,
                        "test": test,
                        "p_value": p_value
                    })
            results_df = pd.DataFrame(all_results)
        else:
            # Case: Single subset (results is a flat dictionary)
            results_df = pd.DataFrame([
                {"column": col, "test": test, "p_value": p}
                for col, (test, p) in results.items()
            ])

        # Display results table in Streamlit
        st.write("### Statistical Test Results")
        st.dataframe(results_df)

        # Identify significant columns based on p-value threshold
        significant_columns = results_df[results_df['p_value'] < p_threshold]['column'].unique().tolist()

        # Store significant columns in session_state for later microbiome analysis
        st.session_state.significant_columns = significant_columns

        # Append results to session state for PDF generation (convert to string for inclusion in text)
        results_text = results_df.to_string(index=False)
        #st.session_state.pdf_content.append(f"Metadata Statistical Tests Results:\n{results_text}")
        text = f"**Statistical Metadata:** \n {results_text} \n Significant threshold: {p_threshold}"
        st.session_state.pdf_content.append({
            'text': text,
            'figure': None
        })

        # Notify the user about significant columns
        if significant_columns:
            st.write("### Significant Variables Identified:")
            st.write(significant_columns)
        else:
            st.write("### No Significant Variables Identified based on the selected threshold.")

#--------------------------------------------------
# Step 7: Alpha-diversity
if page == "alpha" and st.session_state.validated:
    st.subheader("Alpha-diversity tests")
    st.markdown("""
    About alpha-diversity

    - Perform **Metadata Statistical Tests** first
    - Suggested alpha (significance threshold): 0.05
    - Based on Shannon and Simpson indices
    - Metadata columns with statistically significant difference used as covariates
    
    Click buttons twice to navigate to new page!
    """)
    
    df = st.session_state.filtered_df if "filtered_df" in st.session_state else st.session_state.df
    df_gut = st.session_state.filtered_df_gut if "filtered_df_gut" in st.session_state else st.session_state.df_gut

    merged_df_gut = df_gut.merge(df, on='ID')

    # Identify microbiome (numeric) columns and covariates (metadata)
    feature_columns = merged_df_gut.columns.difference(df.columns).tolist()

    if "significant_columns" in st.session_state:
        covariates = st.session_state.significant_columns
        st.write(f"Metadata column with statistically significant difference:\n{covariates}")
    else:
        st.warning("No significant covariates found. Please select from metadata.")
        covariates = st.multiselect("Select Additional Covariate(s)", df.columns, key="non_sig_cov")

    p_threshold = st.slider("Select p-value threshold", 0.01, 0.1, 0.05, 0.01)

    if st.button("Run Analysis"):
        microbiome_data = merged_df_gut[feature_columns]
        metadata = merged_df_gut[covariates]

        shannon_indices = shannon_diversity(microbiome_data)
        simpson_indices = simpson_diversity(microbiome_data)

        results_df = metadata.copy()
        results_df['Shannon'] = shannon_indices
        results_df['Simpson'] = simpson_indices

        alpha_results = alpha_div_test(results_df, covariates, p_threshold)

        st.write("**Alpha-diversity results:**")
        st.write(alpha_results)


#--------------------------------------------------
# Step 8: Beta-diversity
if page == "beta" and st.session_state.validated:
    st.subheader("Beta-diversity tests")
    st.markdown("""
    About beta-diversity

    - Perform **Metadata Statistical Tests** first
    - Suggested alpha (significance threshold): 0.05
    - Based on PERMANOVA with estimations of distance
    - Metadata columns with statistically significant difference used as covariates - can select additional columns
    - PCOA plot used for visualization
    
    Click buttons twice to navigate to new page!
    """)

    if "filtered_df" in st.session_state:
        # If the filtered DataFrame exists, use it
        df = st.session_state.filtered_df
    else:
        # Otherwise, use the original DataFrame
        df = st.session_state.df
        
    if "filtered_df_gut" in st.session_state:
        # If the filtered gut DataFrame exists, use it
        df_gut = st.session_state.filtered_df_gut
    else:
        # Otherwise, use the original gut microbiome DataFrame
        df_gut = st.session_state.df_gut

    # Merge metadata and microbiome data
    merged_df_gut = df_gut.merge(df, on='ID')
    
    # Set the group column correctly
    group_column = 'Status'  # Grouping column is a single column, not a list

    # Define feature columns (the microbiome data columns)
    feature_columns = merged_df_gut.drop(columns=df.columns).columns.tolist()  # Exclude metadata columns

    # Check if significant columns exist in the session state
    if "significant_columns" in st.session_state:
        # Use the significant columns if they exist
        covariates = st.session_state.significant_columns
        # Exclude group_column from covariates
        covariates = [cov for cov in covariates if cov != group_column]
        st.write(f"Statistically significant covariates:\n{covariates}. [Default: None] Comparing groups within **{group_column}** only!")
    else:
        # Warn the user that no significant columns were found
        st.warning("No significant covariates found from metadata tests. Default: None")
    
    # Allow the user to select additional covariates (optional), excluding the group_column
    cov_columns = df.drop(columns=[group_column]).columns.tolist()  # Exclude group_column properly
    non_sig_cov = st.multiselect("Select Additional Covariate (optional)", cov_columns, key="non_sig_cov")
    
    # If additional covariates were selected, add them to the covariates list
    if non_sig_cov:
        covariates.extend(non_sig_cov)  # Extend with non-significant covariates

    # Show the final list of covariates to the user
    st.write(f"Final covariates selected for analysis: {covariates}")

    # P-value threshold slider
    p_threshold = st.slider("Select p-value threshold", 0.01, 0.1, 0.05, 0.01)
    
    if st.button("Run Analysis"):
        # Merge the microbiome data and covariates into one DataFrame
        merged_df_gut = merged_df_gut[feature_columns + [group_column] + covariates]
        #st.write(merged_df_gut)
        
        # Run the beta-diversity test
        beta_results, fig = beta_div_test(merged_df_gut, group_column, covariates, p_threshold)

        st.write("**Beta-diversity results:**")
        st.write(beta_results)
        st.write(fig)

#--------------------------------------------------
# Step 9: Differential abundance

if page == "abundance" and st.session_state.validated:
    st.subheader("Differential abundance")
    st.markdown("""
    About differential abundance

    - Perform **Metadata Statistical Tests** first
    - Suggested alpha (significance threshold): 0.05
    - Using a linear model
    - Metadata columns with statistically significant difference used as covariates - can select additional columns
    - Volcano plot used for visualization
    - Additional plot: Relative abundance vs samples/Status
    
    Click buttons twice to navigate to new page!
    """)

    if "filtered_df" in st.session_state:
        df = st.session_state.filtered_df
    else:
        df = st.session_state.df
        
    if "filtered_df_gut" in st.session_state:
        df_gut = st.session_state.filtered_df_gut
    else:
        df_gut = st.session_state.df_gut

    # Assuming both dataframes have a column 'ID' to join on
    merged_df_gut = df_gut.merge(df, on='ID')

    # Set the group column correctly
    group_column = 'Status'  # Grouping column is a single column, not a list
    
    # Check if 'Status' is in merged_df_gut
    if group_column not in merged_df_gut.columns:
        st.error(f"Group column '{group_column}' is missing from the merged DataFrame.")
        
    # Define feature columns (the microbiome data columns)
    feature_columns = merged_df_gut.drop(columns=df.columns).columns.tolist()  # Exclude metadata columns

    # Check if significant columns exist in the session state
    if "significant_columns" in st.session_state:
        # Use the significant columns if they exist
        covariates = st.session_state.significant_columns
        # Exclude group_column from covariates
        covariates = [cov for cov in covariates if cov != group_column]
        st.write(f"Statistically significant covariates:\n{covariates}. Default: None. Comparing groups within **{group_column}** only!")
    else:
        # Warn the user that no significant columns were found
        st.warning("No significant covariates found from metadata tests. Default: None")
    
    # Allow the user to select additional covariates (optional), excluding the group_column
    cov_columns = df.drop(columns=[group_column]).columns.tolist()  # Exclude group_column properly
    non_sig_cov = st.multiselect("Select Additional Covariate (optional)", cov_columns, key="non_sig_cov")
    
    # If additional covariates were selected, add them to the covariates list
    if non_sig_cov:
        covariates.extend(non_sig_cov)  # Extend with non-significant covariates

    # Show the final list of covariates to the user
    st.write(f"Final covariates selected for analysis: {covariates}")

    p_threshold = st.slider("Select p-value threshold", 0.01, 0.1, 0.05, 0.01)
    labels = st.radio("Include labels for Volcano plot", ["Yes", "No"])

    if st.button("Run Analysis"):
        # Ensure 'Status' is in the final merged_df_gut
        merged_df_gut = merged_df_gut[feature_columns + [group_column] + covariates]
        da_results = diff_abun_test(merged_df_gut, group_column, covariates, p_threshold, labels)

        # Format and display results
        formatted_results = "\n".join([f"{row['Feature']}: p-value = {row['P-value']:.4f}, Significant = {row['Significant']}"
                                       for _, row in da_results.iterrows()])

        st.write("**Differential abundance results:**")
        st.write(da_results)
        
        vol_plot = plot_volcano(da_results, p_threshold, labels) #log fold change vs p-value.
        ra_plot = plot_relative_abundance(merged_df_gut, group_column, top_n=10)

        # Append results to session state for further processing (e.g., PDF generation)
        if "pdf_content" not in st.session_state:
            st.session_state.pdf_content = []  # Initialize if it doesn't exist
        
        #st.session_state.pdf_content.append(f"Differential Abundance Results: {formatted_results}")
        text = f"**Differential abundance results:** \n {formatted_results} \n Covariates: {covariates} \n Significant threshold: {p_threshold}"
        st.session_state.pdf_content.append({
            'text': text,
            'figure': vol_plot
        })
   
#--------------------------------------------------
# Button to generate and download the PDF
# Step 10: Downloadable report
if page == "download" and st.session_state.validated:
    st.subheader("Final Report")

    merger = PdfMerger()

    # Append all content pages
    for content in st.session_state.pdf_content:
        if isinstance(content, dict) and 'text' in content:
            fig = content.get('figure')  # This can be None if some pages are text-only
            pdf_part = append_to_pdf(content['text'], fig)
            merger.append(pdf_part)

    final_pdf = io.BytesIO()
    merger.write(final_pdf)
    merger.close()
    final_pdf.seek(0)

    st.download_button(
        label="Download Report",
        data=final_pdf,
        file_name="Data_Report.pdf",
        mime="application/pdf"
    )









    