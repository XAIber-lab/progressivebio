import os.path, sys, re, warnings
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from pathlib import Path
import numpy as np

warnings.filterwarnings("ignore")
sys.path.append(os.path.join(os.path.dirname(os.path.realpath(__file__)), os.pardir))
from topology_analysis import get_topology


# =========================
# Global style
# =========================
MAIN_COLOR = "blue"
BAND_COLOR = "blue"
MARKER_COLOR = "blue"

LABEL_FONTSIZE = 24
TITLE_FONTSIZE = 24
TICK_FONTSIZE = 14
LEGEND_FONTSIZE = 20
LINEWIDTH = 2
MARKER_SIZE = 20
BAND_ALPHA = 0.18
MARKER_ALPHA = 0.8

METHODS = ["degree", "closeness", "betweeness", "rmc", "random", "spectral", "pagerank"]

plt.rcParams.update({
    "font.size": TICK_FONTSIZE,
    "axes.labelsize": LABEL_FONTSIZE,
    "axes.titlesize": TITLE_FONTSIZE,
    "xtick.labelsize": TICK_FONTSIZE,
    "ytick.labelsize": TICK_FONTSIZE,
    "legend.fontsize": LEGEND_FONTSIZE,
})


# =========================
# Generic helpers
# =========================
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


def style_axis(ax):
    ax.tick_params(axis="both", labelsize=TICK_FONTSIZE)


def plot_series_with_band(ax, x, med_y, q25_y, q75_y, vmin_y=None, vmax_y=None, label=None):
    ax.fill_between(x, q25_y, q75_y, alpha=BAND_ALPHA, color=BAND_COLOR)
    ax.plot(x, med_y, color=MAIN_COLOR, linewidth=LINEWIDTH, label=label)
    if vmin_y is not None:
        ax.scatter(x, vmin_y, color=MARKER_COLOR, marker="v", s=MARKER_SIZE, alpha=MARKER_ALPHA)
    if vmax_y is not None:
        ax.scatter(x, vmax_y, color=MARKER_COLOR, marker="^", s=MARKER_SIZE, alpha=MARKER_ALPHA)
    style_axis(ax)


def grouped_stats(df, metric):
    grouped = df.groupby("iteration")[metric]
    med = grouped.median().sort_index()
    q25 = grouped.quantile(0.25).sort_index()
    q75 = grouped.quantile(0.75).sort_index()
    vmin = grouped.min().sort_index()
    vmax = grouped.max().sort_index()
    return med, q25, q75, vmin, vmax


def prepare_series_from_group(df, metric, trim_quality=False):
    med, q25, q75, vmin, vmax = grouped_stats(df, metric)
    x = med.index.values

    x, (med_y, q25_y, q75_y, vmin_y, vmax_y) = pad_with_zero(
        x, med.values, q25.values, q75.values, vmin.values, vmax.values
    )

    if trim_quality:
        x, (med_y, q25_y, q75_y, vmin_y, vmax_y) = trim_zero_and_ensure_min_x(
            x, med_y, q25_y, q75_y, vmin_y, vmax_y
        )

    return x, med_y, q25_y, q75_y, vmin_y, vmax_y


def edge_bin_setup(df):
    edges_quantiles = df["num_edges"].quantile([0.33, 0.66])

    if edges_quantiles.isna().any():
        cols = ["all_edges"]
        edge_bins = {"all_edges": pd.Series([True] * len(df), index=df.index)}
    else:
        q33, q66 = int(edges_quantiles[0.33]), int(edges_quantiles[0.66])
        low_edges = df["num_edges"] <= edges_quantiles[0.33]
        med_edges = (df["num_edges"] > edges_quantiles[0.33]) & (df["num_edges"] <= edges_quantiles[0.66])
        high_edges = df["num_edges"] > edges_quantiles[0.66]

        edge_bins = {
            f"small": low_edges,
            f"medium": med_edges,
            f"large": high_edges,
        }
        cols = [
            f"small",
            f"medium",
            f"large",
        ]

    return cols, edge_bins


def postprocess_matrix_axes(axes, row_labels, col_labels, xlabel="Iteration", legend=False):
    for i, label in enumerate(row_labels):
        axes[i, 0].set_ylabel(label, fontsize=LABEL_FONTSIZE, fontweight="bold")
        if i == len(row_labels) - 1:
            for j in range(len(col_labels)):
                axes[i, j].set_xlabel(xlabel, fontsize=LABEL_FONTSIZE, fontweight="bold")

    for j, label in enumerate(col_labels):
        axes[0, j].text(
            0.5, 1.08, label,
            transform=axes[0, j].transAxes,
            ha="center", va="bottom",
            fontsize=TITLE_FONTSIZE, fontweight="bold", wrap=True
        )

    for i in range(len(row_labels)):
        for j in range(len(col_labels)):
            axes[i, j].set_title("")
            style_axis(axes[i, j])

    if legend:
        axes[-1, -1].legend(loc="upper right", fontsize=LEGEND_FONTSIZE)


# =========================
# Main matrix plot
# =========================
def plot_kt_matrix(csv_path, output_path, filter_small=False, plot_node_coverage=True):
    """
    Create a matrix of KT / KT_gen / delta_quality_relative / delta_quality_absolute / jaccard [/node_coverage]
    trends per method and save to file.
    """
    df = pd.read_csv(csv_path)

    df["delta_quality_relative"] = abs(df["s_qualityGT"] - df["s_qualityRel"])
    df["delta_quality_absolute"] = abs(df["s_qualityGT"] - df["s_qualityAbs"])

    if filter_small:
        df_filtered = df[df["sample"] < 7].groupby(["file", "iteration", "method"]).first().reset_index()
        small_files = df_filtered["file"].unique()
        df = df[~df["file"].isin(small_files)]
        print(f"Filtered out {len(small_files)} small files")

    required = {"file", "iteration", "method", "KT", "KT_gen", "s_qualityGT", "s_qualityRel", "s_qualityAbs", "jaccard"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    has_node_coverage = "node_coverage" in df.columns
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' column missing. Skipping it.")
        plot_node_coverage = False

    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")

    metrics = ["KT", "KT_gen", "jaccard"]#, "delta_quality_relative", "delta_quality_absolute"]
    if plot_node_coverage:
        metrics.append("node_coverage")

    fixed_ylim_metrics = {"KT", "KT_gen", "jaccard"}

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(METHODS),
        ncols=len(metrics),
        figsize=(5 * len(metrics), 4 * len(METHODS)),
        sharex=True,
        sharey="col",
    )

    axes = np.atleast_2d(axes)

    for i, method in enumerate(METHODS):
        df_m = df[df["method"] == method]

        for j, metric in enumerate(metrics):
            ax = axes[i, j]
            trim_quality = "quality" in metric
            x, med_y, q25_y, q75_y, vmin_y, vmax_y = prepare_series_from_group(df_m, metric, trim_quality=trim_quality)
            plot_series_with_band(ax, x, med_y, q25_y, q75_y, vmin_y, vmax_y)

            if metric in fixed_ylim_metrics:
                ax.set_ylim(-1, 1.2)

    for j, metric in enumerate(metrics):
        axes[0, j].text(
            0.5, 1.05, metric,
            transform=axes[0, j].transAxes,
            ha="center", va="bottom",
            fontsize=TITLE_FONTSIZE, fontweight="bold"
        )

    for i, method in enumerate(METHODS):
        axes[i, 0].set_ylabel(method, fontsize=LABEL_FONTSIZE, fontweight="bold")
        if i == len(METHODS) - 1:
            for j in range(len(metrics)):
                axes[i, j].set_xlabel("Iteration", fontsize=LABEL_FONTSIZE, fontweight="bold")

    for i in range(len(METHODS)):
        for j in range(len(metrics)):
            axes[i, j].set_title("")
            style_axis(axes[i, j])

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Figure saved to {output_path}")


# =========================
# Edge-based plots
# =========================
def plot_single_metric_by_edges(csv_path, output_path, metric, filter_small=False, plot_node_coverage=False, trim_quality=False):
    df = pd.read_csv(csv_path)

    if metric == "delta_quality_relative":
        if "s_qualityGT" in df.columns and "s_qualityRel" in df.columns:
            df["delta_quality_relative"] = abs(df["s_qualityGT"] - df["s_qualityRel"])
        else:
            raise ValueError("Missing required columns for delta_quality_relative: s_qualityGT or s_qualityRel")

    if metric == "delta_quality_absolute":
        if "s_qualityGT" in df.columns and "s_qualityAbs" in df.columns:
            df["delta_quality_absolute"] = abs(df["s_qualityGT"] - df["s_qualityAbs"])
        else:
            raise ValueError("Missing required columns for delta_quality_absolute: s_qualityGT or s_qualityAbs")

    if metric == "delta_quality_absolute_perc":
        if "s_qualityGT" in df.columns and "s_qualityAbs" in df.columns:
            df["delta_quality_absolute_perc"] = abs(df["s_qualityGT"] - df["s_qualityAbs"]) / df["s_qualityGT"]
            metric = "delta_quality_absolute_perc"
        else:
            raise ValueError("Missing required columns for delta_quality_absolute_perc: s_qualityGT or s_qualityAbs")

    if filter_small:
        df_iter1 = df[df["iteration"] == 1]
        if not df_iter1.empty and "sample" in df_iter1.columns:
            small_files = df_iter1[df_iter1["sample"] < 7]["file"].unique()
            df = df[~df["file"].isin(small_files)]
            print(f"Filtered out {len(small_files)} small files")
        else:
            print("Warning: Could not filter - missing iteration=1 or sample column")

    if df.empty:
        print(f"Warning: No data left after filtering. Skipping {output_path}")
        return

    required = {"file", "iteration", "method", "num_edges", metric}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    has_node_coverage = "node_coverage" in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' column missing. Using single metric only.")
        plot_node_coverage = False

    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
    df["num_edges"] = pd.to_numeric(df["num_edges"], errors="coerce")
    df[metric] = pd.to_numeric(df[metric], errors="coerce")
    if has_node_coverage:
        df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")

    df = df.dropna(subset=["num_edges", metric])
    if df.empty:
        print(f"Warning: No valid data. Skipping {output_path}")
        return

    cols, edge_bins = edge_bin_setup(df)

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(METHODS),
        ncols=len(cols),
        figsize=(15, 4 * len(METHODS)),
        sharex=True,
        sharey="col",
    )
    axes = np.atleast_2d(axes)

    for i, method in enumerate(METHODS):
        df_m = df[df["method"] == method]

        for j, col_name in enumerate(cols):
            ax = axes[i, j]

            if col_name == "all_edges":
                df_bin = df_m
            else:
                mask = edge_bins[col_name]
                df_bin = df_m[mask]

            if df_bin.empty:
                continue

            x, med_y, q25_y, q75_y, vmin_y, vmax_y = prepare_series_from_group(df_bin, metric, trim_quality=trim_quality)
            plot_series_with_band(ax, x, med_y, q25_y, q75_y, vmin_y, vmax_y, label=metric)

            if plot_node_coverage:
                x_nc, med_nc_y, q25_nc_y, q75_nc_y, _, _ = prepare_series_from_group(df_bin, "node_coverage", trim_quality=False)
                plot_series_with_band(ax, x_nc, med_nc_y, q25_nc_y, q75_nc_y, None, None, label="node_coverage")

    postprocess_matrix_axes(axes, METHODS, cols, legend=plot_node_coverage)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Figure saved to {output_path}")


def plot_kt_by_edges(csv_path, output_path, filter_small=False, plot_node_coverage=False):
    plot_single_metric_by_edges(csv_path, output_path, "KT", filter_small, plot_node_coverage, trim_quality=False)


def plot_ktgen_by_edges(csv_path, output_path, filter_small=False, plot_node_coverage=False):
    plot_single_metric_by_edges(csv_path, output_path, "KT_gen", filter_small, plot_node_coverage, trim_quality=False)


def plot_jaccard_by_edges(csv_path, output_path, filter_small=False, plot_node_coverage=False):
    plot_single_metric_by_edges(csv_path, output_path, "jaccard", filter_small, plot_node_coverage, trim_quality=False)


def plot_delta_qualityRel_by_edges(csv_path, output_path, filter_small=False, plot_node_coverage=False):
    plot_single_metric_by_edges(csv_path, output_path, "delta_quality_relative", filter_small, plot_node_coverage, trim_quality=True)


def plot_delta_qualityAbs_by_edges(csv_path, output_path, filter_small=False, plot_node_coverage=False):
    plot_single_metric_by_edges(csv_path, output_path, "delta_quality_absolute", filter_small, plot_node_coverage, trim_quality=True)


def plot_delta_qualityAbsPerc_by_edges(csv_path, output_path, filter_small=False, plot_node_coverage=False):
    plot_single_metric_by_edges(csv_path, output_path, "delta_quality_absolute_perc", filter_small, plot_node_coverage, trim_quality=True)


# =========================
# Topology helpers
# =========================
def plot_single_metric_by_topology(df, output_path, metric, topologies=None, filter_small=False, plot_node_coverage=False, trim_quality=False):
    df = df.copy()

    if metric == "delta_quality_relative":
        if "s_qualityGT" in df.columns and "s_qualityRel" in df.columns:
            df["delta_quality_relative"] = abs(df["s_qualityGT"] - df["s_qualityRel"])
        elif "delta_quality_relative" not in df.columns:
            raise ValueError("Missing columns to compute delta_quality_relative: need s_qualityGT and s_qualityRel")
    
    if metric == "delta_quality_absolute":
        if "s_qualityGT" in df.columns and "s_qualityAbs" in df.columns:
            df["delta_quality_absolute"] = abs(df["s_qualityGT"] - df["s_qualityAbs"])
        elif "delta_quality_absolute" not in df.columns:
            raise ValueError("Missing columns to compute delta_quality_absolute: need s_qualityGT and s_qualityRel")

    if metric == "delta_quality_absolute_perc":
        if "s_qualityGT" in df.columns and "s_qualityAbs" in df.columns:
            df["delta_quality_absolute_perc"] = abs(df["s_qualityGT"] - df["s_qualityAbs"]) / df["s_qualityGT"]
        elif "delta_quality_absolute_perc" not in df.columns:
            raise ValueError("Missing columns to compute delta_quality_absolute_perc: need s_qualityGT and s_qualityAbs")

    if filter_small:
        df_filtered = df[(df["iteration"] == 1) & (df["sample"] < 7)].groupby("file").first().reset_index()
        small_files = df_filtered["file"].unique()
        df = df[~df["file"].isin(small_files)].copy()
        print(f"Filtered out {len(small_files)} small files")

    required = {"iteration", "method", metric, "topology"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    has_node_coverage = "node_coverage" in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' column missing. Using single metric only.")
        plot_node_coverage = False

    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
    df[metric] = pd.to_numeric(df[metric], errors="coerce")
    if has_node_coverage:
        df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")

    all_topologies = sorted(df["topology"].dropna().unique())

    if topologies is None:
        selected_topologies = all_topologies
    else:
        selected_topologies = [t for t in topologies if t in all_topologies]
        if len(selected_topologies) != len(topologies):
            missing_t = set(topologies) - set(selected_topologies)
            print(f"WARNING: Topologies not found: {missing_t}")

    if len(selected_topologies) == 0:
        raise ValueError("No valid topologies to plot")

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(selected_topologies),   # topologies as rows
        ncols=len(METHODS),               # methods as columns
        figsize=(4 * len(METHODS), 4 * len(selected_topologies)),
        sharex=True,
        sharey="row",
    )
    axes = np.atleast_2d(axes)

    for i, topo in enumerate(selected_topologies):
        df_topo_all = df[df["topology"] == topo]

        for j, method in enumerate(METHODS):
            ax = axes[i][j]
            df_topo = df_topo_all[df_topo_all["method"] == method]

            if df_topo.empty:
                continue

            x, med_y, q25_y, q75_y, vmin_y, vmax_y = prepare_series_from_group(
                df_topo, metric, trim_quality=trim_quality
            )
            plot_series_with_band(ax, x, med_y, q25_y, q75_y, vmin_y, vmax_y, label=metric)

            if plot_node_coverage:
                x_nc, med_nc_y, q25_nc_y, q75_nc_y, _, _ = prepare_series_from_group(
                    df_topo, "node_coverage", trim_quality=False
                )
                plot_series_with_band(
                    ax, x_nc, med_nc_y, q25_nc_y, q75_nc_y, None, None, label="node_coverage"
                )

    postprocess_matrix_axes(axes, selected_topologies, METHODS, legend=plot_node_coverage)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Figure saved to {output_path}")

def plot_kt_by_topology(df, output_path, topologies=None, filter_small=False, plot_node_coverage=False):
    plot_single_metric_by_topology(df, output_path, "KT", topologies, filter_small, plot_node_coverage, trim_quality=False)


def plot_ktgen_by_topology(df, output_path, topologies=None, filter_small=False, plot_node_coverage=False):
    plot_single_metric_by_topology(df, output_path, "KT_gen", topologies, filter_small, plot_node_coverage, trim_quality=False)


def plot_jaccard_by_topology(df, output_path, topologies=None, filter_small=False, plot_node_coverage=False):
    plot_single_metric_by_topology(df, output_path, "jaccard", topologies, filter_small, plot_node_coverage, trim_quality=False)


def plot_deltaRel_by_topology(df, output_path, topologies=None, filter_small=False, plot_node_coverage=False):
    plot_single_metric_by_topology(df, output_path, "delta_quality_relative", topologies, filter_small, plot_node_coverage, trim_quality=True)
    
def plot_deltAbs_by_topology(df, output_path, topologies=None, filter_small=False, plot_node_coverage=False):
    plot_single_metric_by_topology(df, output_path, "delta_quality_absolute", topologies, filter_small, plot_node_coverage, trim_quality=True)


def plot_deltaAbsPerc_by_topology(df, output_path, topologies=None, filter_small=False, plot_node_coverage=False):
    plot_single_metric_by_topology(df, output_path, "delta_quality_absolute_perc", topologies, filter_small, plot_node_coverage, trim_quality=True)


# =========================
# Disaggregated plots
# =========================
def plot_kt_disaggregated(df, output_base_path, topologies=None, filter_small=False, plot_node_coverage=False):
    """
    Create 1 plot per topology: rows=methods, cols=edges quantiles.
    Each subplot shows KT, KT_gen, jaccard median lines only,
    [node_coverage median line overlay].
    All lines are blue.
    """
    df = df.copy()

    if filter_small:
        df_filtered = df[(df["iteration"] == 1) & (df["sample"] < 7)].groupby("file").first().reset_index()
        small_files = df_filtered["file"].unique()
        df = df[~df["file"].isin(small_files)].copy()
        print(f"Filtered out {len(small_files)} small files")

    required = {"iteration", "method", "KT", "KT_gen", "jaccard", "num_edges", "topology"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    has_node_coverage = "node_coverage" in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' missing. Skipping overlay.")
        plot_node_coverage = False

    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
    df["num_edges"] = pd.to_numeric(df["num_edges"], errors="coerce")

    metrics_to_numeric = ["KT", "KT_gen", "jaccard"]
    if has_node_coverage:
        metrics_to_numeric.append("node_coverage")
        df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")
    df[metrics_to_numeric] = df[metrics_to_numeric].apply(pd.to_numeric, errors="coerce")

    all_topologies = sorted(df["topology"].dropna().unique())
    if topologies is None:
        selected_topologies = all_topologies
    else:
        selected_topologies = [t for t in topologies if t in all_topologies]
        if len(selected_topologies) != len(topologies):
            missing_t = set(topologies) - set(selected_topologies)
            print(f"WARNING: Topologies not found: {missing_t}")

    metric_names = ["KT", "KT_gen", "jaccard"]
    if plot_node_coverage:
        metric_names.append("node_coverage")

    sns.set_style("whitegrid")

    for topo in selected_topologies:
        df_topo = df[df["topology"] == topo]
        if df_topo.empty:
            print(f"Skipping empty topology: {topo}")
            continue

        cols, edge_bins = edge_bin_setup(df_topo)

        fig, axes = plt.subplots(
            nrows=len(METHODS),
            ncols=len(cols),
            figsize=(14, 4 * len(METHODS)),
            sharex=True,
            sharey="col",
        )
        axes = np.atleast_2d(axes)

        for i, method in enumerate(METHODS):
            df_m = df_topo[df_topo["method"] == method]

            for j, col_name in enumerate(cols):
                ax = axes[i][j]
                mask = edge_bins[col_name]
                df_bin = df_m[mask]

                if df_bin.empty:
                    continue

                for metric in metric_names:
                    grouped = df_bin.groupby("iteration")[metric]
                    med = grouped.median().sort_index()
                    x = med.index.values
                    x, (med_y,) = pad_with_zero(x, med.values)
                    ax.plot(x, med_y, color=MAIN_COLOR, linewidth=LINEWIDTH, label=metric)

                style_axis(ax)

        for i, method in enumerate(METHODS):
            axes[i][0].set_ylabel(method, fontsize=LABEL_FONTSIZE, fontweight="bold")
            if i == len(METHODS) - 1:
                for jj in range(len(cols)):
                    axes[i][jj].set_xlabel("Iteration", fontsize=LABEL_FONTSIZE, fontweight="bold")

        for j, col_name in enumerate(cols):
            axes[0][j].text(
                0.5, 1.05, col_name,
                transform=axes[0][j].transAxes,
                ha="center", va="bottom",
                fontsize=TITLE_FONTSIZE, fontweight="bold",
            )

        axes[0][0].legend(loc="upper right", fontsize=LEGEND_FONTSIZE)

        for i in range(len(axes)):
            for j in range(len(axes[0])):
                axes[i][j].set_title("")
                style_axis(axes[i][j])

        plt.tight_layout()
        output_file = f"{output_base_path}_{topo}.png"
        plt.savefig(output_file, dpi=300, bbox_inches="tight")
        plt.close(fig)
        print(f"Saved: {output_file}")


def plot_kt_disaggregated_quality(df, output_base_path, topologies=None, filter_small=False, plot_node_coverage=False):
    """
    Create 1 plot per topology: rows=methods, cols=edges quantiles.
    Each subplot shows quality median lines only,
    [node_coverage median line overlay].
    All lines are blue.
    """
    df = df.copy()

    if filter_small:
        df_filtered = df[(df["iteration"] == 1) & (df["sample"] < 7)].groupby("file").first().reset_index()
        small_files = df_filtered["file"].unique()
        df = df[~df["file"].isin(small_files)].copy()
        print(f"Filtered out {len(small_files)} small files")

    required = {"iteration", "method", "s_qualityGT", "s_qualityRel", "s_qualityAbs", "num_edges", "topology"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    has_node_coverage = "node_coverage" in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' missing. Skipping overlay.")
        plot_node_coverage = False

    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
    df["num_edges"] = pd.to_numeric(df["num_edges"], errors="coerce")
    df["delta_quality_relative"] = abs(df["s_qualityGT"] - df["s_qualityRel"])
    df["delta_quality_absolute"] = abs(df["s_qualityGT"] - df["s_qualityAbs"])

    metrics_to_numeric = ["delta_quality_relative", "delta_quality_absolute"]
    if has_node_coverage:
        metrics_to_numeric.append("node_coverage")
        df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")
    df[metrics_to_numeric] = df[metrics_to_numeric].apply(pd.to_numeric, errors="coerce")

    all_topologies = sorted(df["topology"].dropna().unique())
    if topologies is None:
        selected_topologies = all_topologies
    else:
        selected_topologies = [t for t in topologies if t in all_topologies]
        if len(selected_topologies) != len(topologies):
            missing_t = set(topologies) - set(selected_topologies)
            print(f"WARNING: Topologies not found: {missing_t}")

    metric_names = ["delta_quality_relative", "delta_quality_absolute"]
    if plot_node_coverage:
        metric_names.append("node_coverage")

    sns.set_style("whitegrid")

    for topo in selected_topologies:
        df_topo = df[df["topology"] == topo]
        if df_topo.empty:
            print(f"Skipping empty topology: {topo}")
            continue

        cols, edge_bins = edge_bin_setup(df_topo)

        fig, axes = plt.subplots(
            nrows=len(METHODS),
            ncols=len(cols),
            figsize=(14, 4 * len(METHODS)),
            sharex=True,
            sharey="col",
        )
        axes = np.atleast_2d(axes)

        for i, method in enumerate(METHODS):
            df_m = df_topo[df_topo["method"] == method]

            for j, col_name in enumerate(cols):
                ax = axes[i][j]
                mask = edge_bins[col_name]
                df_bin = df_m[mask]

                if df_bin.empty:
                    continue

                for metric in metric_names:
                    grouped = df_bin.groupby("iteration")[metric]
                    med = grouped.median().sort_index()

                    x = med.index.values
                    x, (med_y,) = pad_with_zero(x, med.values)

                    if "quality" in metric:
                        x, (med_y,) = trim_zero_and_ensure_min_x(x, med_y)

                    ax.plot(x, med_y, color=MAIN_COLOR, linewidth=LINEWIDTH, label=metric)

                style_axis(ax)

        for i, method in enumerate(METHODS):
            axes[i][0].set_ylabel(method, fontsize=LABEL_FONTSIZE, fontweight="bold")
            if i == len(METHODS) - 1:
                for jj in range(len(cols)):
                    axes[i][jj].set_xlabel("Iteration", fontsize=LABEL_FONTSIZE, fontweight="bold")

        for j, col_name in enumerate(cols):
            axes[0][j].text(
                0.5, 1.05, col_name,
                transform=axes[0][j].transAxes,
                ha="center", va="bottom",
                fontsize=TITLE_FONTSIZE, fontweight="bold",
            )

        axes[0][0].legend(loc="upper right", fontsize=LEGEND_FONTSIZE)

        for i in range(len(axes)):
            for j in range(len(axes[0])):
                axes[i][j].set_title("")
                style_axis(axes[i][j])

        plt.tight_layout()
        output_file = f"{output_base_path}_{topo}.png"
        plt.savefig(output_file, dpi=300, bbox_inches="tight")
        plt.close(fig)
        print(f"Saved: {output_file}")


# =========================
# Topology extraction utils
# =========================
def extract_topology(file_path):
    """Extract topology robustly (supports '-' and multi-underscore names)."""
    filename = file_path.rsplit("/", 1)[-1]
    filename = re.sub(r"_N\d+_E\d+.*$", "", filename)
    filename = re.sub(r"_N\d+.*$", "", filename)
    filename = re.sub(r"_E\d+.*$", "", filename)
    return filename


def add_topology_column(df, file_col="file"):
    df = df.copy()
    df["topology"] = df[file_col].apply(extract_topology)
    return df


def preprocess_topology(csv_path):
    df = pd.read_csv(csv_path)
    df = add_topology_column(df)
    return df


if __name__ == "__main__":
    
    for folder in ["data"]:
        for dat in ["synthetic","benchmark","twitter_benchmark"]:
            stats_file = "progressive/"+folder+"/results_" + dat + ".csv"
            
            plot_aggregate = "progressive/plot/"+folder+"/aggregate_" + dat + ".png"
            
            plot_size_std = "progressive/plot/"+folder+"/size_KT_" + dat + ".png"
            plot_size_gen = "progressive/plot/"+folder+"/size_KTgen_" + dat + ".png"
            plot_size_jac = "progressive/plot/"+folder+"/size_jaccard_" + dat + ".png"
            plot_size_qualRel = "progressive/plot/"+folder+"/size_qualityRel_" + dat + ".png"
            plot_size_qualAbs = "progressive/plot/"+folder+"/size_qualityAbs_" + dat + ".png"
            plot_size_qualAbsPercentage = "progressive/plot/"+folder+"/size_qualityAbsPerc_" + dat + ".png"
            
            plot_topology_std = "progressive/plot/"+folder+"/topology_KT_" + dat + ".png"
            plot_topology_gen = "progressive/plot/"+folder+"/topology_KTgen_" + dat + ".png"
            plot_topology_jac = "progressive/plot/"+folder+"/topology_jaccard_" + dat + ".png"
            plot_topology_qualRel = "progressive/plot/"+folder+"/topology_qualityRel_" + dat + ".png"
            plot_topology_qualAbs = "progressive/plot/"+folder+"/topology_qualityAbs_" + dat + ".png"
            plot_topology_qualAbsPercentage = "progressive/plot/"+folder+"/topology_qualityAbsPerc_" + dat + ".png"
            
            plot_disagg_gen = "progressive/plot/"+folder+"/disaggregated_" + dat + "/"
            Path(plot_aggregate).parent.mkdir(parents=True, exist_ok=True)
            
            # Example usage with filter_small=True
            plot_kt_matrix(stats_file, plot_aggregate, filter_small=False, plot_node_coverage=False)
            plot_kt_by_edges(stats_file, plot_size_std, filter_small=False, plot_node_coverage=False)
            plot_ktgen_by_edges(stats_file, plot_size_gen, filter_small=False, plot_node_coverage=False)
            plot_jaccard_by_edges(stats_file, plot_size_jac, filter_small=False, plot_node_coverage=False)
            plot_delta_qualityRel_by_edges(stats_file, plot_size_qualRel, filter_small=False, plot_node_coverage=False)
            plot_delta_qualityAbs_by_edges(stats_file, plot_size_qualAbs, filter_small=False, plot_node_coverage=False)
            plot_delta_qualityAbsPerc_by_edges(stats_file, plot_size_qualAbsPercentage, filter_small=False, plot_node_coverage=False)
            
            allTopos = []
            topos=[]
            for file_idx, file_path in enumerate([str(p) for p in Path("progressive/synthetic_graphs/").iterdir() if p.is_file()], start=1):
                topoName = file_path.replace("progressive\\synthetic_graphs\\","").split("_N")[0]
                if topoName not in allTopos: allTopos.append(topoName)
            for t in allTopos:
                if "hybrid" not in t: topos.append(t)
            print(topos)
            
            if dat == "synthetic":
                Path(plot_disagg_gen).mkdir(exist_ok=True)
                df_stats = preprocess_topology(stats_file)

                plot_kt_by_topology(df_stats, plot_topology_std, topologies=topos, filter_small=False, plot_node_coverage=False)
                plot_ktgen_by_topology(df_stats, plot_topology_gen, topologies=topos, filter_small=False, plot_node_coverage=False)
                plot_jaccard_by_topology(df_stats, plot_topology_jac, topologies=topos, filter_small=False, plot_node_coverage=False)
                plot_deltaRel_by_topology(df_stats, plot_topology_qualRel, topologies=topos, filter_small=False, plot_node_coverage=False)
                plot_deltAbs_by_topology(df_stats, plot_topology_qualAbs, topologies=topos, filter_small=False, plot_node_coverage=False)
                plot_deltaAbsPerc_by_topology(df_stats, plot_topology_qualAbsPercentage, topologies=topos, filter_small=False, plot_node_coverage=False)
                
                # plot_kt_disaggregated(df_stats, plot_disagg_gen, topologies=topos, filter_small=False, plot_node_coverage=False)
                # plot_kt_disaggregated_quality(df_stats, plot_disagg_gen, topologies=topos, filter_small=False, plot_node_coverage=False)
