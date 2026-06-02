# Steve 🧬 | Microbiome Analysis Pipeline

Steve is a modular **microbiome data analysis pipeline** built in Python and Streamlit. It guides users from raw data upload to advanced analysis, visualization, and reporting. The pipeline is structured in 10 steps, enabling clean, reproducible, and interactive workflows.

---

## Features

- **File upload & validation:** Accepts CSV/XLSX files, checks required columns, and handles duplicates.
- **Power analysis:** Basic statistical power checks for study design.
- **Metadata visualization:** Interactive plots of sample distributions.
- **Data storage:** Save cleaned datasets to SQLite.
- **Statistical tests:** Metadata comparisons and significance testing.
- **Microbiome analysis:**  
  - Alpha diversity (Shannon & Simpson indices)  
  - Beta diversity (Bray-Curtis dissimilarity, PCoA)  
  - Differential abundance testing with linear models
- **Reporting:** Generate a **PDF report** with results and figures.

---

## Installation

Install with pip in a Python 3.10+ environment:

```bash
git clone <repository_url>
cd steve
pip install -r requirements.txt

## Usage
Run the Streamlit app:
streamlit run main.py
Upload your CSV or XLSX files containing microbiome and metadata.
Step through the pipeline: cleaning → power analysis → visualization → storage → analysis → report.
Download the final PDF report with all results and plots.

### Pipeline Steps

Step	Description
1	Upload Files
2	Read, validate, and clean data
3	Power analysis
4	Metadata distribution visualization
5	Store cleaned data in SQLite
6	Metadata statistical tests
7	Alpha diversity (Shannon & Simpson)
8	Beta diversity (Bray-Curtis, PCoA)
9	Differential abundance testing
10	Generate PDF report

## Project Structure

steve/
├── __init__.py
├── main.py
├── preprocessing.py
├── power.py
├── plotting.py
├── storage.py
├── analysis.py
├── microbiome.py
├── reporting.py
└── requirements.txt

##📖 Example Usage

import steve

### Run main app
steve.main()

import pandas as pd
from steve import preprocessing, storage, analysis, microbiome, init_db

# 1. Load and clean data
df = pd.read_csv("example_data.csv")
errors, cleaned_df = preprocessing.validate_and_clean_data(df, "example_data.csv")

if errors:
    print("⚠️ Issues found:", errors)

# 2. Initialize the SQLite database
db_path = "steve_data.sqlite"
init_db.initialize_database(db_path)

# 3. Save cleaned data
storage.save_to_sqlite([cleaned_df], ["example_data.csv"], db_path)

# 4. Run statistical tests
results = analysis.run_metadata_tests(cleaned_df)
print("Metadata test results:")
print(results)

# 5. Alpha diversity analysis
alpha = microbiome.alpha_diversity_analysis(cleaned_df)
print("Alpha diversity results:")
print(alpha)

