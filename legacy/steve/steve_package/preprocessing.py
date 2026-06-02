import io
import os
import numpy as np
import pandas as pd

# -----------------------------
# STEP 2: Read / Validate / Clean
# -----------------------------

REQUIRED_COLUMNS = {"ID"}

def read_file(file):
    """Read CSV/XLSX to DataFrame with simple error handling."""
    name = getattr(file, "name", "uploaded_file")
    ext = str(name).split(".")[-1].lower()
    try:
        if ext == "xlsx":
            return pd.read_excel(file, engine="openpyxl")
        elif ext == "csv":
            return pd.read_csv(file)
        else:
            raise ValueError(f"Unsupported file format: {name}")
    except Exception as e:
        raise RuntimeError(f"Error reading {name}: {e}")

def validate_and_clean_data(df: pd.DataFrame, file_name: str):
    """Validate required columns, drop duplicate IDs, report missing IDs."""
    errors = []
    if df is None:
        errors.append(f"Failed to load {file_name}")
        return errors, None

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        errors.append(f"Missing required columns {missing} in {file_name}")

    if "ID" in df.columns:
        dup = df["ID"].duplicated().sum()
        if dup > 0:
            errors.append(f"{dup} duplicate participant IDs in {file_name} — keeping first.")
            df = df.drop_duplicates(subset="ID", keep="first")

        if df["ID"].isna().sum() > 0:
            errors.append(f"Missing participant IDs in {file_name}")

    return errors, df

