import pandas as pd
import numpy as np
from scipy.stats import kruskal, mannwhitneyu, f_oneway
from scipy.spatial import distance
from skbio.stats.distance import permanova, DistanceMatrix
from skbio.diversity import alpha_diversity, beta_diversity
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
import seaborn as sns
from statsmodels.stats.multitest import multipletests

# -----------------------------
# Step 7: Alpha Diversity
# -----------------------------

def shannon_index(counts):
    proportions = counts / np.sum(counts)
    proportions = proportions[proportions > 0]
    return -np.sum(proportions * np.log(proportions))

def simpson_index(counts):
    proportions = counts / np.sum(counts)
    return 1 - np.sum(proportions ** 2)

def compute_alpha_diversity(abundance_df, metadata_df, group_col=None):
    results = []
    for sample in abundance_df.index:
        counts = abundance_df.loc[sample].values
        results.append({
            "sample": sample,
            "shannon": shannon_index(counts),
            "simpson": simpson_index(counts),
            group_col: metadata_df.loc[sample, group_col] if group_col else None
        })
    alpha_df = pd.DataFrame(results)

    # group comparison if metadata available
    stats = {}
    if group_col:
        groups = alpha_df[group_col].unique()
        if len(groups) > 2:
            stats["shannon"] = kruskal(*[alpha_df.loc[alpha_df[group_col] == g, "shannon"] for g in groups])
            stats["simpson"] = kruskal(*[alpha_df.loc[alpha_df[group_col] == g, "simpson"] for g in groups])
        elif len(groups) == 2:
            stats["shannon"] = mannwhitneyu(
                alpha_df.loc[alpha_df[group_col] == groups[0], "shannon"],
                alpha_df.loc[alpha_df[group_col] == groups[1], "shannon"]
            )
            stats["simpson"] = mannwhitneyu(
                alpha_df.loc[alpha_df[group_col] == groups[0], "simpson"],
                alpha_df.loc[alpha_df[group_col] == groups[1], "simpson"]
            )
    return alpha_df, stats

def plot_alpha_diversity(alpha_df, group_col):
    fig, axes = plt.subplots(1, 2, figsize=(12, 6))
    sns.boxplot(data=alpha_df, x=group_col, y="shannon", ax=axes[0])
    sns.boxplot(data=alpha_df, x=group_col, y="simpson", ax=axes[1])
    axes[0].set_title("Shannon Diversity")
    axes[1].set_title("Simpson Diversity")
    plt.tight_layout()
    return fig

# -----------------------------
# Step 8: Beta Diversity
# -----------------------------

def compute_beta_diversity(abundance_df, metadata_df, group_col=None):
    # Bray-Curtis
    dist_matrix = distance.squareform(distance.pdist(abundance_df.values, metric="braycurtis"))
    dm = DistanceMatrix(dist_matrix, ids=abundance_df.index)

    # PERMANOVA if metadata
    perm_res = None
    if group_col:
        perm_res = permanova(dm, metadata_df[group_col], permutations=999)

    return dist_matrix, perm_res

def plot_pcoa(dist_matrix, metadata_df, group_col=None):
    pca = PCA(n_components=2)
    coords = pca.fit_transform(dist_matrix)
    pcoa_df = pd.DataFrame(coords, columns=["PC1", "PC2"], index=metadata_df.index)
    pcoa_df[group_col] = metadata_df[group_col].values

    plt.figure(figsize=(8, 6))
    sns.scatterplot(data=pcoa_df, x="PC1", y="PC2", hue=group_col, s=100)
    plt.title("PCoA based on Bray-Curtis")
    plt.tight_layout()
    return plt.gcf()

# -----------------------------
# Step 9: Differential Abundance
# -----------------------------

def differential_abundance(abundance_df, metadata_df, group_col):
    results = []
    groups = metadata_df[group_col].unique()

    for feature in abundance_df.columns:
        values = [abundance_df.loc[metadata_df[group_col] == g, feature] for g in groups]

        if len(groups) == 2:
            stat, pval = mannwhitneyu(values[0], values[1], alternative="two-sided")
        else:
            stat, pval = kruskal(*values)

        results.append({
            "feature": feature,
            "stat": stat,
            "pval": pval
        })

    da_df = pd.DataFrame(results)
    da_df["pval_adj"] = multipletests(da_df["pval"], method="fdr_bh")[1]
    return da_df.sort_values("pval_adj")

def plot_differential_abundance(da_df, abundance_df, top_n=10):
    sig_features = da_df.sort_values("pval_adj").head(top_n)["feature"]
    melted = abundance_df[sig_features].melt(var_name="feature", value_name="abundance")

    plt.figure(figsize=(12, 6))
    sns.boxplot(data=melted, x="feature", y="abundance")
    plt.xticks(rotation=45, ha="right")
    plt.title("Top Differentially Abundant Features")
    plt.tight_layout()
    return plt.gcf()


