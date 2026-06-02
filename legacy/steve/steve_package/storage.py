import io
import os
import numpy as np
import pandas as pd
import sqlite3

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

