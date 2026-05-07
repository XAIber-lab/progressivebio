import os.path, sys, warnings
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from pathlib import Path
import numpy as np

warnings.filterwarnings("ignore")
sys.path.append(os.path.join(os.path.dirname(os.path.realpath(__file__)), os.pardir))
from topology_analysis import get_topology


# ----------------------------
# Global style / config
# ----------------------------
METHODS = ["degree", "closeness", "betweeness", "rmc", "random", "spectral", "pagerank"]

DATASETS = {
    "synthetic": {
        "label": "synthetic",
        "color": "blue",
    },
    "twitter_benchmark": {
        "label": "real",
        "color": "red",
    },
}

LABEL_FS = 24
TITLE_FS = 24
TICK_FS = 14
LEGEND_FS = 20
LINE_W = 2.2
MARKER_S = 20

FIXED_YLIM_METRICS = {"KT", "KT_gen", "jaccard"}


# ----------------------------
# Helpers
# ----------------------------
def pad_with_zero(x_index, *series_list):
    """
    Ensure curves start at iteration 0 with value 0.
    x_index: Index (or array) of iteration values (sorted).
    series_list: one or more pandas Series/arrays aligned with x_index.
    Returns: new_x, [new_series...]
    """
    if 0 in x_index:
        return x_index, list(series_list)

    new_x = np.insert(x_index, 0, 0)
    new_series_list = []
    for s in series_list:
        arr = np.asarray(s)
        arr0 = np.insert(arr, 0, 0.0)
        new_series_list.append(arr0)
    return new_x, new_series_list


def trim_zero_and_ensure_min_x(x, *series_list):
    """Remove x=0 from the data and return x, [series...]"""
    x = np.asarray(x)
    if len(x) == 0:
        return x, list(series_list)

    mask = x > 0
    if not mask.any():
        return np.array([], dtype=x.dtype), [np.array([], dtype=np.asarray(s).dtype) for s in series_list]

    x_trim = x[mask]
    s_trim = [np.asarray(s)[mask] for s in series_list]
    return x_trim, s_trim


def ensure_parent_dir(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)


def load_and_prepare(csv_path, filter_small=False):
    df = pd.read_csv(csv_path)

    if "s_qualityGT" in df.columns and "s_qualityRel" in df.columns:
        df["delta_quality_relative"] = abs(df["s_qualityGT"] - df["s_qualityRel"])

    if "s_qualityGT" in df.columns and "s_qualityAbs" in df.columns:
        df["delta_quality_absolute"] = abs(df["s_qualityGT"] - df["s_qualityAbs"])

    if "s_qualityGT" in df.columns and "s_qualityAbs" in df.columns:
        gt = pd.to_numeric(df["s_qualityGT"], errors="coerce")
        absq = pd.to_numeric(df["s_qualityAbs"], errors="coerce")
        with np.errstate(divide="ignore", invalid="ignore"):
            df["delta_quality_absolute_percentage"] = abs(gt - absq) / gt.replace(0, np.nan)

    if filter_small:
        df_iter1 = df[df["iteration"] == 1]
        if not df_iter1.empty and "sample" in df_iter1.columns:
            small_files = df_iter1[df_iter1["sample"] < 7]["file"].unique()
            df = df[~df["file"].isin(small_files)]
            print(f"Filtered out {len(small_files)} small files")
        else:
            print("Warning: Could not filter - missing iteration=1 or sample column")

    for col in ["iteration", "num_edges", "node_coverage", "KT", "KT_gen", "jaccard",
                "delta_quality_relative", "delta_quality_absolute", "delta_quality_absolute_percentage"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    return df


def validate_required(df, required, dataset_name):
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns in {dataset_name}: {missing}")


def get_metric_series(df_subset, metric):
    grouped = df_subset.groupby("iteration")[metric]

    med = grouped.median().sort_index()
    q25 = grouped.quantile(0.25).sort_index()
    q75 = grouped.quantile(0.75).sort_index()
    vmin = grouped.min().sort_index()
    vmax = grouped.max().sort_index()

    x = med.index.values

    if "quality" not in metric:
        x, (med_y, q25_y, q75_y, vmin_y, vmax_y) = pad_with_zero(
            x, med.values, q25.values, q75.values, vmin.values, vmax.values
        )
    else:
        x, (med_y, q25_y, q75_y, vmin_y, vmax_y) = trim_zero_and_ensure_min_x(
            x, med.values, q25.values, q75.values, vmin.values, vmax.values
        )

    return x, med_y, q25_y, q75_y, vmin_y, vmax_y


def draw_dataset_curve(ax, df_subset, metric, color, label):
    if df_subset.empty:
        return

    if metric not in df_subset.columns:
        return

    series_df = df_subset.dropna(subset=["iteration", metric])
    if series_df.empty:
        return

    x, med_y, q25_y, q75_y, vmin_y, vmax_y = get_metric_series(series_df, metric)

    if len(x) == 0:
        return

    ax.fill_between(x, q25_y, q75_y, alpha=0.12, color=color)
    ax.plot(x, med_y, color=color, linewidth=LINE_W, label=label)
    ax.scatter(x, vmin_y, color=color, marker="v", s=MARKER_S, alpha=0.45)
    ax.scatter(x, vmax_y, color=color, marker="^", s=MARKER_S, alpha=0.45)

    if metric in FIXED_YLIM_METRICS:
        ax.set_ylim(-1, 1.2)


def apply_axes_style(axes):
    axes = np.atleast_2d(axes)
    for row in axes:
        for ax in row:
            ax.tick_params(axis="both", labelsize=TICK_FS)
    return axes


def add_matrix_labels(axes, col_names, bottom_xlabel="Iteration"):
    axes = np.atleast_2d(axes)

    for i, method in enumerate(METHODS):
        axes[i, 0].set_ylabel(method, fontsize=LABEL_FS, fontweight="bold")
        if i == len(METHODS) - 1:
            for j in range(len(col_names)):
                axes[i, j].set_xlabel(bottom_xlabel, fontsize=LABEL_FS, fontweight="bold")

    for j, col_name in enumerate(col_names):
        axes[0, j].text(
            0.5,
            1.08,
            col_name,
            transform=axes[0, j].transAxes,
            ha="center",
            va="bottom",
            fontsize=TITLE_FS,
            fontweight="bold",
        )

    for i in range(len(METHODS)):
        for j in range(len(col_names)):
            axes[i, j].set_title("")


def add_legend(fig_or_axes):
    if isinstance(fig_or_axes, np.ndarray):
        ax = np.atleast_2d(fig_or_axes)[0, -1]
    else:
        ax = fig_or_axes
    ax.legend(loc="upper right", fontsize=LEGEND_FS, frameon=True)


def finalize_figure(output_path):
    ensure_parent_dir(output_path)
    plt.tight_layout(pad=1.4, w_pad=1.0, h_pad=1.2)
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"Figure saved to {output_path}")


def build_shared_edge_bins(df_synth, df_real):
    combined = pd.concat([df_synth[["num_edges"]], df_real[["num_edges"]]], ignore_index=True)
    combined = combined.dropna(subset=["num_edges"])

    if combined.empty:
        return ["all_edges"], None

    edges_quantiles = combined["num_edges"].quantile([0.33, 0.66])

    if edges_quantiles.isna().any():
        return ["all_edges"], None

    q33, q66 = int(edges_quantiles[0.33]), int(edges_quantiles[0.66])

    cols = [
        f"small",
        f"medium",
        f"large",
    ]

    def assign_bins(df):
        return {
            cols[0]: df["num_edges"] <= edges_quantiles[0.33],
            cols[1]: (df["num_edges"] > edges_quantiles[0.33]) & (df["num_edges"] <= edges_quantiles[0.66]),
            cols[2]: df["num_edges"] > edges_quantiles[0.66],
        }

    return cols, assign_bins


def metric_exists_in_both(df_synth, df_real, metric):
    return (metric in df_synth.columns) and (metric in df_real.columns)


# ----------------------------
# Plot functions
# ----------------------------
def plot_kt_matrix_compare(csv_synth, csv_real, output_path, filter_small=False, plot_node_coverage=False):
    df_synth = load_and_prepare(csv_synth, filter_small=filter_small)
    df_real = load_and_prepare(csv_real, filter_small=filter_small)

    required = {"file", "iteration", "method", "KT", "KT_gen", "s_qualityGT", "s_qualityRel", "s_qualityAbs", "jaccard"}
    validate_required(df_synth, required, "synthetic")
    validate_required(df_real, required, "twitter_benchmark")

    metrics = ["KT", "KT_gen", "jaccard"]#, "delta_quality_relative", "delta_quality_absolute"]

    if plot_node_coverage and metric_exists_in_both(df_synth, df_real, "node_coverage"):
        metrics.append("node_coverage")
    elif plot_node_coverage:
        print("WARNING: node_coverage missing in one dataset. Skipping it.")

    print(f"Plotting {len(metrics)} metrics: {metrics}")

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(METHODS),
        ncols=len(metrics),
        figsize=(5.6 * len(metrics), 4.4 * len(METHODS)),
        sharex=True,
        sharey="col",
    )
    axes = apply_axes_style(axes)

    for i, method in enumerate(METHODS):
        dfm_synth = df_synth[df_synth["method"] == method]
        dfm_real = df_real[df_real["method"] == method]

        for j, metric in enumerate(metrics):
            ax = axes[i, j]

            draw_dataset_curve(
                ax, dfm_synth, metric,
                color=DATASETS["synthetic"]["color"],
                label=DATASETS["synthetic"]["label"],
            )
            draw_dataset_curve(
                ax, dfm_real, metric,
                color=DATASETS["twitter_benchmark"]["color"],
                label=DATASETS["twitter_benchmark"]["label"],
            )

    add_matrix_labels(axes, metrics, bottom_xlabel="Iteration")
    add_legend(axes)
    finalize_figure(output_path)


def plot_metric_by_edges_compare(csv_synth, csv_real, output_path, metric, filter_small=False):
    df_synth = load_and_prepare(csv_synth, filter_small=filter_small)
    df_real = load_and_prepare(csv_real, filter_small=filter_small)

    required = {"file", "iteration", "method", "num_edges", metric}
    validate_required(df_synth, required, "synthetic")
    validate_required(df_real, required, "twitter_benchmark")

    df_synth = df_synth.dropna(subset=["num_edges"])
    df_real = df_real.dropna(subset=["num_edges"])

    if df_synth.empty and df_real.empty:
        print(f"Warning: No valid num_edges data. Skipping {output_path}")
        return

    cols, assign_bins = build_shared_edge_bins(df_synth, df_real)

    if assign_bins is None:
        bins_synth = {"all_edges": pd.Series([True] * len(df_synth), index=df_synth.index)}
        bins_real = {"all_edges": pd.Series([True] * len(df_real), index=df_real.index)}
    else:
        bins_synth = assign_bins(df_synth)
        bins_real = assign_bins(df_real)

    print(f"Plotting metric '{metric}' in {len(cols)} edge bins")

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(METHODS),
        ncols=len(cols),
        figsize=(16.5, 4.4 * len(METHODS)),
        sharex=True,
        sharey="col",
    )
    axes = apply_axes_style(axes)

    for i, method in enumerate(METHODS):
        dfm_synth = df_synth[df_synth["method"] == method]
        dfm_real = df_real[df_real["method"] == method]

        for j, col_name in enumerate(cols):
            ax = axes[i, j]

            if col_name == "all_edges":
                dfs = dfm_synth
                dfr = dfm_real
            else:
                mask_s = bins_synth[col_name].reindex(dfm_synth.index, fill_value=False)
                mask_r = bins_real[col_name].reindex(dfm_real.index, fill_value=False)
                dfs = dfm_synth[mask_s]
                dfr = dfm_real[mask_r]

            draw_dataset_curve(
                ax, dfs, metric,
                color=DATASETS["synthetic"]["color"],
                label=DATASETS["synthetic"]["label"],
            )
            draw_dataset_curve(
                ax, dfr, metric,
                color=DATASETS["twitter_benchmark"]["color"],
                label=DATASETS["twitter_benchmark"]["label"],
            )

    add_matrix_labels(axes, cols, bottom_xlabel="Iteration")
    add_legend(axes)
    finalize_figure(output_path)


def plot_kt_by_edges_compare(csv_synth, csv_real, output_path, filter_small=False, plot_node_coverage=False):
    plot_metric_by_edges_compare(csv_synth, csv_real, output_path, metric="KT", filter_small=filter_small)


def plot_ktgen_by_edges_compare(csv_synth, csv_real, output_path, filter_small=False, plot_node_coverage=False):
    plot_metric_by_edges_compare(csv_synth, csv_real, output_path, metric="KT_gen", filter_small=filter_small)


def plot_jaccard_by_edges_compare(csv_synth, csv_real, output_path, filter_small=False, plot_node_coverage=False):
    plot_metric_by_edges_compare(csv_synth, csv_real, output_path, metric="jaccard", filter_small=filter_small)


def plot_delta_qualityRel_by_edges_compare(csv_synth, csv_real, output_path, filter_small=False, plot_node_coverage=False):
    plot_metric_by_edges_compare(csv_synth, csv_real, output_path, metric="delta_quality_relative", filter_small=filter_small)


def plot_delta_qualityAbs_by_edges_compare(csv_synth, csv_real, output_path, filter_small=False, plot_node_coverage=False):
    plot_metric_by_edges_compare(csv_synth, csv_real, output_path, metric="delta_quality_absolute", filter_small=filter_small)


def plot_delta_qualityAbsPerc_by_edges_compare(csv_synth, csv_real, output_path, filter_small=False, plot_node_coverage=False):
    plot_metric_by_edges_compare(csv_synth, csv_real, output_path, metric="delta_quality_absolute_percentage", filter_small=filter_small)


# ----------------------------
# Main
# ----------------------------
if __name__ == "__main__":
    for folder in ["data"]:
        synthetic_file = f"progressive/{folder}/results_synthetic.csv"
        real_file = f"progressive/{folder}/results_twitter_benchmark.csv"

        plot_aggregate = f"progressive/plot/{folder}/cmp_aggregate_synth_vs_real.png"

        plot_size_std = f"progressive/plot/{folder}/cmp_size_KT_synth_vs_real.png"
        plot_size_gen = f"progressive/plot/{folder}/cmp_size_KTgen_synth_vs_real.png"
        plot_size_jac = f"progressive/plot/{folder}/cmp_size_jaccard_synth_vs_real.png"
        plot_size_qualRel = f"progressive/plot/{folder}/cmp_size_qualityRel_synth_vs_real.png"
        plot_size_qualAbs = f"progressive/plot/{folder}/cmp_size_qualityAbs_synth_vs_real.png"
        plot_size_qualAbsPercentage = f"progressive/plot/{folder}/cmp_size_qualityAbsPerc_synth_vs_real.png"

        plot_kt_matrix_compare(
            synthetic_file,
            real_file,
            plot_aggregate,
            filter_small=False,
            plot_node_coverage=False,
        )

        plot_kt_by_edges_compare(
            synthetic_file,
            real_file,
            plot_size_std,
            filter_small=False,
            plot_node_coverage=False,
        )

        plot_ktgen_by_edges_compare(
            synthetic_file,
            real_file,
            plot_size_gen,
            filter_small=False,
            plot_node_coverage=False,
        )

        plot_jaccard_by_edges_compare(
            synthetic_file,
            real_file,
            plot_size_jac,
            filter_small=False,
            plot_node_coverage=False,
        )

        plot_delta_qualityRel_by_edges_compare(
            synthetic_file,
            real_file,
            plot_size_qualRel,
            filter_small=False,
            plot_node_coverage=False,
        )

        plot_delta_qualityAbs_by_edges_compare(
            synthetic_file,
            real_file,
            plot_size_qualAbs,
            filter_small=False,
            plot_node_coverage=False,
        )

        plot_delta_qualityAbsPerc_by_edges_compare(
            synthetic_file,
            real_file,
            plot_size_qualAbsPercentage,
            filter_small=False,
            plot_node_coverage=False,
        )