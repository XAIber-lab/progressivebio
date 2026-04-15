import json, csv, os.path, sys, math
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from pathlib import Path
import numpy as np
import warnings
warnings.filterwarnings("ignore")
sys.path.append(os.path.join(os.path.dirname(os.path.realpath(__file__)), os.pardir))
from topology_analysis import get_topology

def pad_with_zero(x_index, *series_list):
    """
    Ensure curves start at iteration 0 with value 0.
    x_index: Index (or array) of iteration values (sorted).
    series_list: one or more pandas Series/arrays aligned with x_index.
    Returns: new_x, [new_series...]
    """
    # If iteration 0 is already present, just return as-is
    if 0 in x_index:
        return x_index, list(series_list)

    # Build new x and prepend zeros
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
        return np.array([], dtype=x.dtype), [np.array([], dtype=s.dtype) for s in series_list]
    x_trim = x[mask]
    s_trim = [np.asarray(s)[mask] for s in series_list]
    return x_trim, s_trim

def plot_kt_matrix(csv_path, output_path, filter_small=False, plot_node_coverage=True):
    """
    Create a matrix of KT / KT_gen / delta_quality_relative / delta_quality_absolute / jaccard [/node_coverage] trends per method and save to file.
    
    Args:
        csv_path: path to input CSV file
        output_path: path where to save the image (png, pdf, etc)
        filter_small: if True, skip files where sample at iteration 1 < 7
        plot_node_coverage: if True, add node_coverage column (must exist in CSV)
    """
    # Load
    df = pd.read_csv(csv_path)
    
    # Compute new metrics
    df['delta_quality_relative'] = df['s_qualityGT'] - df['s_qualityRel']
    df['delta_quality_absolute'] = df['s_qualityGT'] - df['s_qualityAbs']
    
    # Apply filter if requested
    if filter_small:
        df_filtered = df[df['sample'] < 7].groupby(['file', 'iteration', 'method']).first().reset_index()
        small_files = df_filtered['file'].unique()
        df = df[~df['file'].isin(small_files)]
        print(f"Filtered out {len(small_files)} small files")

    # Basic checks
    required = {"file", "iteration", "method", "KT", "KT_gen", "s_qualityGT", "s_qualityRel", "s_qualityAbs", "jaccard"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Check node_coverage availability if requested
    has_node_coverage = 'node_coverage' in df.columns
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' column missing. Skipping it.")
        plot_node_coverage = False

    # Ensure numeric iteration
    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")

    methods = ["degree", "closeness", "betweeness", "rmc", "random", "spectral"]
    metrics = ["KT", "KT_gen", "jaccard", "delta_quality_relative", "delta_quality_absolute"]
    if plot_node_coverage:
        metrics.append("node_coverage")

    print(f"Plotting {len(metrics)} metrics: {metrics}")

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(methods),
        ncols=len(metrics),
        figsize=(5*len(metrics), 4*len(methods)),
        sharex=True,
        sharey=False,  # Changed to False for independent y-scales
    )

    # Make sure axes is 2D
    if len(methods) == 1:
        axes = axes.reshape(1, -1)
    if len(metrics) == 1:
        axes = axes.reshape(-1, 1)

    # Define metrics that need fixed [-1,1] y-limits
    fixed_ylim_metrics = {"KT", "KT_gen", "jaccard"}

    # Single line: median across ALL files per iteration
    for i, method in enumerate(methods):
        df_m = df[df["method"] == method]

        for j, metric in enumerate(metrics):
            ax = axes[i, j]

            # Group ALL data for this method/metric by iteration only
            grouped = df_m.groupby("iteration")[metric]
            
            med = grouped.median().sort_index()
            q25 = grouped.quantile(0.25).sort_index()
            q75 = grouped.quantile(0.75).sort_index()
            vmin = grouped.min().sort_index()
            vmax = grouped.max().sort_index()

            x = med.index.values

            if "quality" not in metric:
                # Pad so that first point is (0, 0)
                x, (med_y, q25_y, q75_y, vmin_y, vmax_y) = pad_with_zero(
                    x, med.values, q25.values, q75.values, vmin.values, vmax.values
                )
            else:
                x, (med_y, q25_y, q75_y, vmin_y, vmax_y) = trim_zero_and_ensure_min_x(
                    x, med.values, q25.values, q75.values, vmin.values, vmax.values
                )
        

            # 25–75% band
            ax.fill_between(x, q25_y, q75_y, alpha=0.2, color="gray")
            
            # Blue line for node_coverage, black for others
            line_color = "blue" if metric == "node_coverage" else "black"
            ax.plot(x, med_y, color=line_color, linewidth=2)

            # Min / max markers
            ax.scatter(x, vmin_y, color="gray", marker="v", s=30, alpha=0.7)
            ax.scatter(x, vmax_y, color="gray", marker="^", s=30, alpha=0.7)

            # Set fixed y-limits for specified metrics
            if metric in fixed_ylim_metrics:
                ax.set_ylim(-1, 1.2)

    # Labels: method on left (Y-axis), metric on top, X only bottom row
    for i, method in enumerate(methods):
        axes[i, 0].set_ylabel(method, fontsize=12, fontweight="bold")
        if i == len(methods) - 1:  # Bottom row
            for j in range(len(metrics)):
                axes[i, j].set_xlabel("Iteration", fontsize=12, fontweight="bold")
    
    # Metric supertitles above columns
    for j, metric in enumerate(metrics):
        axes[0, j].text(
            0.5,
            1.05,
            metric,
            transform=axes[0, j].transAxes,
            ha="center",
            va="bottom",
            fontsize=12,
            fontweight="bold",
        )
    
    # Remove Y-label from first row, right columns
    for j in range(1, len(metrics)):
        axes[0, j].set_ylabel("")

    # Remove all titles
    for i in range(len(methods)):
        for j in range(len(metrics)):
            axes[i, j].set_title("")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Figure saved to {output_path}")

def plot_kt_by_edges(csv_path, output_path, filter_small=False, plot_node_coverage=False):
    """
    Create matrix of plots: rows=methods, cols=edges quantiles (low/medium/high)
    [with optional node_coverage overlay on same charts] and save to file.
    
    Args:
        csv_path: path to input CSV file
        output_path: path where to save the image (png, pdf, etc)
        filter_small: if True, skip files where sample at iteration 1 < 7
        plot_node_coverage: if True, overlay node_coverage line on each edge bin chart
    """
    # Load
    df = pd.read_csv(csv_path)
    
    # Apply filter if requested
    if filter_small:
        df_iter1 = df[df['iteration'] == 1]
        if not df_iter1.empty and 'sample' in df_iter1.columns:
            small_files = df_iter1[df_iter1['sample'] < 7]['file'].unique()
            df = df[~df['file'].isin(small_files)]
            print(f"Filtered out {len(small_files)} small files")
        else:
            print("Warning: Could not filter - missing iteration=1 or sample column")
    
    if df.empty:
        print(f"Warning: No data left after filtering. Skipping {output_path}")
        return

    # Basic checks
    required = {"file", "iteration", "method", "KT", "num_edges"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Check node_coverage availability if requested
    has_node_coverage = 'node_coverage' in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' column missing. Using KT only.")
        plot_node_coverage = False

    # Ensure numeric columns
    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
    df["num_edges"] = pd.to_numeric(df["num_edges"], errors="coerce")
    if has_node_coverage:
        df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")
    
    df = df.dropna(subset=['num_edges'])
    if df.empty:
        print(f"Warning: No valid num_edges data. Skipping {output_path}")
        return

    methods = ["degree", "closeness", "betweeness", "rmc", "random", "spectral"]
    
    # Edge quantiles (always 3 columns)
    edges_quantiles = df["num_edges"].quantile([0.33, 0.66])
    if edges_quantiles.isna().any():
        print(f"Warning: Insufficient data for edge quantiles. Using single column.")
        cols = ["all_edges"]
        edge_bins = {"all_edges": pd.Series([True] * len(df), index=df.index)}
    else:
        q33, q66 = int(edges_quantiles[0.33]), int(edges_quantiles[0.66])
        low_edges = df["num_edges"] <= edges_quantiles[0.33]
        med_edges = (df["num_edges"] > edges_quantiles[0.33]) & (df["num_edges"] <= edges_quantiles[0.66])
        high_edges = df["num_edges"] > edges_quantiles[0.66]
        
        edge_bins = {
            f"low (≤{q33})": low_edges, 
            f"medium ({q33}-{q66})": med_edges, 
            f"high (> {q66})": high_edges
        }
        cols = [
            "low (≤{})".format(q33),
            "medium ({}-{})".format(q33, q66),
            "high (> {})".format(q66),
        ]

    print(f"Plotting {len(cols)} edge bins with node_coverage overlay: {plot_node_coverage}")

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(methods),
        ncols=len(cols),  # Fixed 3 columns for edge bins
        figsize=(15,4*len(methods)),
        sharex=True,
        sharey=True,
    )

    # Make sure axes is 2D
    axes = np.atleast_2d(axes)

    # Plot for each method and edge bin
    for i, method in enumerate(methods):
        df_m = df[df["method"] == method]

        for j, col_name in enumerate(cols):
            ax = axes[i, j]

            # Filter for this edge bin (same file/iteration groups)
            if col_name == "all_edges":
                df_bin = df_m
            else:
                mask = edge_bins[col_name]
                df_bin = df_m[mask]
            
            if df_bin.empty:
                continue

            # KT line (black) - original
            grouped_kt = df_bin.groupby("iteration")["KT"]
            med_kt = grouped_kt.median().sort_index()
            q25_kt = grouped_kt.quantile(0.25).sort_index()
            q75_kt = grouped_kt.quantile(0.75).sort_index()
            vmin_kt = grouped_kt.min().sort_index()
            vmax_kt = grouped_kt.max().sort_index()

            x_kt = med_kt.index.values
            x_kt, (med_kt_y, q25_kt_y, q75_kt_y, vmin_kt_y, vmax_kt_y) = pad_with_zero(
                x_kt, med_kt.values, q25_kt.values, q75_kt.values, vmin_kt.values, vmax_kt.values
            )

            # KT 25–75% band
            ax.fill_between(x_kt, q25_kt_y, q75_kt_y, alpha=0.2, color="gray")
            ax.plot(x_kt, med_kt_y, color="black", linewidth=2, label="KT")
            
            # KT min/max markers
            ax.scatter(x_kt, vmin_kt_y, color="gray", marker="v", s=30, alpha=0.7)
            ax.scatter(x_kt, vmax_kt_y, color="gray", marker="^", s=30, alpha=0.7)

            # Node coverage overlay (blue) - same edge bin, same files
            if plot_node_coverage:
                grouped_nc = df_bin.groupby("iteration")["node_coverage"]
                med_nc = grouped_nc.median().sort_index()
                q25_nc = grouped_nc.quantile(0.25).sort_index()
                q75_nc = grouped_nc.quantile(0.75).sort_index()

                x_nc = med_nc.index.values
                x_nc, (med_nc_y, q25_nc_y, q75_nc_y, _, _) = pad_with_zero(
                    x_nc, med_nc.values, q25_nc.values, q75_nc.values, med_nc.values, med_nc.values
                )

                # Node coverage band (lighter blue)
                ax.fill_between(x_nc, q25_nc_y, q75_nc_y, alpha=0.15, color="blue")
                # Node coverage median line (blue)
                ax.plot(x_nc, med_nc_y, color="blue", linewidth=2, label="node_coverage")

    # Labels
    for i, method in enumerate(methods):
        axes[i, 0].set_ylabel(method, fontsize=12, fontweight="bold")
        if i == len(methods) - 1:
            for j in range(len(cols)):
                axes[i, j].set_xlabel("Iteration", fontsize=12, fontweight="bold")
    
    for j, col_name in enumerate(cols):
        axes[0, j].text(
            0.5, 1.08, col_name,
            transform=axes[0, j].transAxes,
            ha="center", va="bottom", fontsize=11, fontweight="bold"
        )

    # Legend if node_coverage plotted
    if plot_node_coverage:
        axes[-1, -1].legend(loc='upper right', fontsize=10)

    # Clean up
    for i in range(len(methods)):
        for j in range(1, len(cols)):
            axes[i, j].set_ylabel("")
        for j in range(len(cols)):
            axes[i, j].set_title("")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Figure saved to {output_path}")

def plot_ktgen_by_edges(csv_path, output_path, filter_small=False, plot_node_coverage=False):
    """
    KT_gen by edge quantiles with optional node_coverage overlay on same charts.
    
    Args:
        csv_path: path to input CSV file
        output_path: path where to save the image (png, pdf, etc)
        filter_small: if True, skip files where sample at iteration 1 < 7
        plot_node_coverage: if True, overlay node_coverage line on each edge bin chart
    """
    # Load
    df = pd.read_csv(csv_path)
    
    # Apply filter if requested
    if filter_small:
        df_iter1 = df[df['iteration'] == 1]
        if not df_iter1.empty and 'sample' in df_iter1.columns:
            small_files = df_iter1[df_iter1['sample'] < 7]['file'].unique()
            df = df[~df['file'].isin(small_files)]
            print(f"Filtered out {len(small_files)} small files")
        else:
            print("Warning: Could not filter - missing iteration=1 or sample column")
    
    if df.empty:
        print(f"Warning: No data left after filtering. Skipping {output_path}")
        return

    # Basic checks
    required = {"file", "iteration", "method", "KT_gen", "num_edges"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Check node_coverage availability if requested
    has_node_coverage = 'node_coverage' in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' column missing. Using KT_gen only.")
        plot_node_coverage = False

    # Ensure numeric columns
    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
    df["num_edges"] = pd.to_numeric(df["num_edges"], errors="coerce")
    if has_node_coverage:
        df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")
    
    df = df.dropna(subset=['num_edges'])
    if df.empty:
        print(f"Warning: No valid num_edges data. Skipping {output_path}")
        return

    methods = ["degree", "closeness", "betweeness", "rmc", "random", "spectral"]
    
    # Edge quantiles (always 3 columns)
    edges_quantiles = df["num_edges"].quantile([0.33, 0.66])
    if edges_quantiles.isna().any():
        print(f"Warning: Insufficient data for edge quantiles. Using single column.")
        cols = ["all_edges"]
        edge_bins = {"all_edges": pd.Series([True] * len(df), index=df.index)}
    else:
        q33, q66 = int(edges_quantiles[0.33]), int(edges_quantiles[0.66])
        low_edges = df["num_edges"] <= edges_quantiles[0.33]
        med_edges = (df["num_edges"] > edges_quantiles[0.33]) & (df["num_edges"] <= edges_quantiles[0.66])
        high_edges = df["num_edges"] > edges_quantiles[0.66]
        
        edge_bins = {
            f"low (≤{q33})": low_edges, 
            f"medium ({q33}-{q66})": med_edges, 
            f"high (> {q66})": high_edges
        }
        cols = [
            "low (≤{})".format(q33),
            "medium ({}-{})".format(q33, q66),
            "high (> {})".format(q66),
        ]

    print(f"Plotting KT_gen {len(cols)} edge bins with node_coverage overlay: {plot_node_coverage}")

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(methods),
        ncols=len(cols),  # Fixed 3 columns for edge bins
        figsize=(15, 4*len(methods)),
        sharex=True,
        sharey=True,
    )

    # Make sure axes is 2D
    axes = np.atleast_2d(axes)

    # Plot for each method and edge bin
    for i, method in enumerate(methods):
        df_m = df[df["method"] == method]

        for j, col_name in enumerate(cols):
            ax = axes[i, j]

            # Filter for this edge bin (same file/iteration groups)
            if col_name == "all_edges":
                df_bin = df_m
            else:
                mask = edge_bins[col_name]
                df_bin = df_m[mask]
            
            if df_bin.empty:
                continue

            # KT_gen line (black) - original
            grouped_ktgen = df_bin.groupby("iteration")["KT_gen"]
            med_ktgen = grouped_ktgen.median().sort_index()
            q25_ktgen = grouped_ktgen.quantile(0.25).sort_index()
            q75_ktgen = grouped_ktgen.quantile(0.75).sort_index()
            vmin_ktgen = grouped_ktgen.min().sort_index()
            vmax_ktgen = grouped_ktgen.max().sort_index()

            x_ktgen = med_ktgen.index.values
            x_ktgen, (med_ktgen_y, q25_ktgen_y, q75_ktgen_y, vmin_ktgen_y, vmax_ktgen_y) = pad_with_zero(
                x_ktgen, med_ktgen.values, q25_ktgen.values, q75_ktgen.values, 
                vmin_ktgen.values, vmax_ktgen.values
            )

            # KT_gen 25–75% band
            ax.fill_between(x_ktgen, q25_ktgen_y, q75_ktgen_y, alpha=0.2, color="gray")
            ax.plot(x_ktgen, med_ktgen_y, color="black", linewidth=2, label="KT_gen")
            
            # KT_gen min/max markers
            ax.scatter(x_ktgen, vmin_ktgen_y, color="gray", marker="v", s=30, alpha=0.7)
            ax.scatter(x_ktgen, vmax_ktgen_y, color="gray", marker="^", s=30, alpha=0.7)

            # Node coverage overlay (blue) - same edge bin, same files
            if plot_node_coverage:
                grouped_nc = df_bin.groupby("iteration")["node_coverage"]
                med_nc = grouped_nc.median().sort_index()
                q25_nc = grouped_nc.quantile(0.25).sort_index()
                q75_nc = grouped_nc.quantile(0.75).sort_index()

                x_nc = med_nc.index.values
                x_nc, (med_nc_y, q25_nc_y, q75_nc_y, _, _) = pad_with_zero(
                    x_nc, med_nc.values, q25_nc.values, q75_nc.values, med_nc.values, med_nc.values
                )

                # Node coverage band (lighter blue)
                ax.fill_between(x_nc, q25_nc_y, q75_nc_y, alpha=0.15, color="blue")
                # Node coverage median line (blue)
                ax.plot(x_nc, med_nc_y, color="blue", linewidth=2, label="node_coverage")

    # Labels
    for i, method in enumerate(methods):
        axes[i, 0].set_ylabel(method, fontsize=12, fontweight="bold")
        if i == len(methods) - 1:
            for j in range(len(cols)):
                axes[i, j].set_xlabel("Iteration", fontsize=12, fontweight="bold")
    
    for j, col_name in enumerate(cols):
        axes[0, j].text(
            0.5, 1.08, col_name,
            transform=axes[0, j].transAxes,
            ha="center", va="bottom", fontsize=11, fontweight="bold"
        )

    # Legend if node_coverage plotted
    if plot_node_coverage:
        axes[-1, -1].legend(loc='upper right', fontsize=10)

    # Clean up
    for i in range(len(methods)):
        for j in range(1, len(cols)):
            axes[i, j].set_ylabel("")
        for j in range(len(cols)):
            axes[i, j].set_title("")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Figure saved to {output_path}")

def plot_jaccard_by_edges(csv_path, output_path, filter_small=False, plot_node_coverage=False):
    """
    Create matrix of plots: rows=methods, cols=edges quantiles (low/medium/high)
    [with optional node_coverage overlay on same charts] and save to file.
    
    Args:
        csv_path: path to input CSV file
        output_path: path where to save the image (png, pdf, etc)
        filter_small: if True, skip files where sample at iteration 1 < 7
        plot_node_coverage: if True, overlay node_coverage line on each edge bin chart
    """
    # Load
    df = pd.read_csv(csv_path)
    
    # Apply filter if requested
    if filter_small:
        df_iter1 = df[df['iteration'] == 1]
        if not df_iter1.empty and 'sample' in df_iter1.columns:
            small_files = df_iter1[df_iter1['sample'] < 7]['file'].unique()
            df = df[~df['file'].isin(small_files)]
            print(f"Filtered out {len(small_files)} small files")
        else:
            print("Warning: Could not filter - missing iteration=1 or sample column")
    
    if df.empty:
        print(f"Warning: No data left after filtering. Skipping {output_path}")
        return

    # Basic checks
    required = {"file", "iteration", "method", "jaccard", "num_edges"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Check node_coverage availability if requested
    has_node_coverage = 'node_coverage' in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' column missing. Using jaccard only.")
        plot_node_coverage = False

    # Ensure numeric columns
    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
    df["num_edges"] = pd.to_numeric(df["num_edges"], errors="coerce")
    if has_node_coverage:
        df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")
    
    df = df.dropna(subset=['num_edges'])
    if df.empty:
        print(f"Warning: No valid num_edges data. Skipping {output_path}")
        return

    methods = ["degree", "closeness", "betweeness", "rmc", "random", "spectral"]
    
    # Edge quantiles (always 3 columns)
    edges_quantiles = df["num_edges"].quantile([0.33, 0.66])
    if edges_quantiles.isna().any():
        print(f"Warning: Insufficient data for edge quantiles. Using single column.")
        cols = ["all_edges"]
        edge_bins = {"all_edges": pd.Series([True] * len(df), index=df.index)}
    else:
        q33, q66 = int(edges_quantiles[0.33]), int(edges_quantiles[0.66])
        low_edges = df["num_edges"] <= edges_quantiles[0.33]
        med_edges = (df["num_edges"] > edges_quantiles[0.33]) & (df["num_edges"] <= edges_quantiles[0.66])
        high_edges = df["num_edges"] > edges_quantiles[0.66]
        
        edge_bins = {
            f"low (≤{q33})": low_edges, 
            f"medium ({q33}-{q66})": med_edges, 
            f"high (> {q66})": high_edges
        }
        cols = [
            "low (≤{})".format(q33),
            "medium ({}-{})".format(q33, q66),
            "high (> {})".format(q66),
        ]

    print(f"Plotting {len(cols)} edge bins with node_coverage overlay: {plot_node_coverage}")

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(methods),
        ncols=len(cols),  # Fixed 3 columns for edge bins
        figsize=(15, 4*len(methods)),
        sharex=True,
        sharey=True,
    )

    # Make sure axes is 2D
    axes = np.atleast_2d(axes)

    # Plot for each method and edge bin
    for i, method in enumerate(methods):
        df_m = df[df["method"] == method]

        for j, col_name in enumerate(cols):
            ax = axes[i, j]

            # Filter for this edge bin (same file/iteration groups)
            if col_name == "all_edges":
                df_bin = df_m
            else:
                mask = edge_bins[col_name]
                df_bin = df_m[mask]
            
            if df_bin.empty:
                continue

            # jaccard line (black) - original
            grouped_jaccard = df_bin.groupby("iteration")["jaccard"]
            med_jaccard = grouped_jaccard.median().sort_index()
            q25_jaccard = grouped_jaccard.quantile(0.25).sort_index()
            q75_jaccard = grouped_jaccard.quantile(0.75).sort_index()
            vmin_jaccard = grouped_jaccard.min().sort_index()
            vmax_jaccard = grouped_jaccard.max().sort_index()

            x_jaccard = med_jaccard.index.values
            x_jaccard, (med_jaccard_y, q25_jaccard_y, q75_jaccard_y, vmin_jaccard_y, vmax_jaccard_y) = pad_with_zero(
                x_jaccard, med_jaccard.values, q25_jaccard.values, q75_jaccard.values, vmin_jaccard.values, vmax_jaccard.values
            )

            # jaccard 25–75% band
            ax.fill_between(x_jaccard, q25_jaccard_y, q75_jaccard_y, alpha=0.2, color="gray")
            ax.plot(x_jaccard, med_jaccard_y, color="black", linewidth=2, label="jaccard")
            
            # jaccard min/max markers
            ax.scatter(x_jaccard, vmin_jaccard_y, color="gray", marker="v", s=30, alpha=0.7)
            ax.scatter(x_jaccard, vmax_jaccard_y, color="gray", marker="^", s=30, alpha=0.7)

            # Node coverage overlay (blue) - same edge bin, same files
            if plot_node_coverage:
                grouped_nc = df_bin.groupby("iteration")["node_coverage"]
                med_nc = grouped_nc.median().sort_index()
                q25_nc = grouped_nc.quantile(0.25).sort_index()
                q75_nc = grouped_nc.quantile(0.75).sort_index()

                x_nc = med_nc.index.values
                x_nc, (med_nc_y, q25_nc_y, q75_nc_y, _, _) = pad_with_zero(
                    x_nc, med_nc.values, q25_nc.values, q75_nc.values, med_nc.values, med_nc.values
                )

                # Node coverage band (lighter blue)
                ax.fill_between(x_nc, q25_nc_y, q75_nc_y, alpha=0.15, color="blue")
                # Node coverage median line (blue)
                ax.plot(x_nc, med_nc_y, color="blue", linewidth=2, label="node_coverage")

    # Labels
    for i, method in enumerate(methods):
        axes[i, 0].set_ylabel(method, fontsize=12, fontweight="bold")
        if i == len(methods) - 1:
            for j in range(len(cols)):
                axes[i, j].set_xlabel("Iteration", fontsize=12, fontweight="bold")
    
    for j, col_name in enumerate(cols):
        axes[0, j].text(
            0.5, 1.08, col_name,
            transform=axes[0, j].transAxes,
            ha="center", va="bottom", fontsize=11, fontweight="bold"
        )

    # Legend if node_coverage plotted
    if plot_node_coverage:
        axes[-1, -1].legend(loc='upper right', fontsize=10)

    # Clean up
    for i in range(len(methods)):
        for j in range(1, len(cols)):
            axes[i, j].set_ylabel("")
        for j in range(len(cols)):
            axes[i, j].set_title("")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Figure saved to {output_path}")

def plot_delta_qualityRel_by_edges(csv_path, output_path, filter_small=False, plot_node_coverage=False):
    """
    Create matrix of plots: rows=methods, cols=edges quantiles (low/medium/high)
    [with optional node_coverage overlay on same charts] and save to file.
    
    Args:
        csv_path: path to input CSV file
        output_path: path where to save the image (png, pdf, etc)
        filter_small: if True, skip files where sample at iteration 1 < 7
        plot_node_coverage: if True, overlay node_coverage line on each edge bin chart
    """
    # Load
    df = pd.read_csv(csv_path)
    
    # Compute delta_quality_relative
    if 's_qualityGT' in df.columns and 's_qualityRel' in df.columns:
        df['delta_quality_relative'] = df['s_qualityGT'] - df['s_qualityRel']
    else:
        raise ValueError("Missing required columns for delta_quality_relative: s_qualityGT or s_qualityRel")
    
    # Apply filter if requested
    if filter_small:
        df_iter1 = df[df['iteration'] == 1]
        if not df_iter1.empty and 'sample' in df_iter1.columns:
            small_files = df_iter1[df_iter1['sample'] < 7]['file'].unique()
            df = df[~df['file'].isin(small_files)]
            print(f"Filtered out {len(small_files)} small files")
        else:
            print("Warning: Could not filter - missing iteration=1 or sample column")
    
    if df.empty:
        print(f"Warning: No data left after filtering. Skipping {output_path}")
        return

    # Basic checks
    required = {"file", "iteration", "method", "num_edges"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Check node_coverage availability if requested
    has_node_coverage = 'node_coverage' in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' column missing. Using delta_quality_relative only.")
        plot_node_coverage = False

    # Ensure numeric columns
    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
    df["num_edges"] = pd.to_numeric(df["num_edges"], errors="coerce")
    df["delta_quality_relative"] = pd.to_numeric(df["delta_quality_relative"], errors="coerce")
    if has_node_coverage:
        df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")
    
    df = df.dropna(subset=['num_edges', 'delta_quality_relative'])
    if df.empty:
        print(f"Warning: No valid data. Skipping {output_path}")
        return

    methods = ["degree", "closeness", "betweeness", "rmc", "random", "spectral"]
    
    # Edge quantiles (always 3 columns)
    edges_quantiles = df["num_edges"].quantile([0.33, 0.66])
    if edges_quantiles.isna().any():
        print(f"Warning: Insufficient data for edge quantiles. Using single column.")
        cols = ["all_edges"]
        edge_bins = {"all_edges": pd.Series([True] * len(df), index=df.index)}
    else:
        q33, q66 = int(edges_quantiles[0.33]), int(edges_quantiles[0.66])
        low_edges = df["num_edges"] <= edges_quantiles[0.33]
        med_edges = (df["num_edges"] > edges_quantiles[0.33]) & (df["num_edges"] <= edges_quantiles[0.66])
        high_edges = df["num_edges"] > edges_quantiles[0.66]
        
        edge_bins = {
            f"low (≤{q33})": low_edges, 
            f"medium ({q33}-{q66})": med_edges, 
            f"high (> {q66})": high_edges
        }
        cols = [
            "low (≤{})".format(q33),
            "medium ({}-{})".format(q33, q66),
            "high (> {})".format(q66),
        ]

    print(f"Plotting {len(cols)} edge bins with node_coverage overlay: {plot_node_coverage}")

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(methods),
        ncols=len(cols),  # Fixed 3 columns for edge bins
        figsize=(15, 4*len(methods)),
        sharex=True,
        sharey=False,  # Independent y-scales
    )

    # Make sure axes is 2D
    axes = np.atleast_2d(axes)

    # Plot for each method and edge bin
    for i, method in enumerate(methods):
        df_m = df[df["method"] == method]

        for j, col_name in enumerate(cols):
            ax = axes[i, j]

            # Filter for this edge bin (same file/iteration groups)
            if col_name == "all_edges":
                df_bin = df_m
            else:
                mask = edge_bins[col_name]
                df_bin = df_m[mask]
            
            if df_bin.empty:
                continue

            # delta_quality_relative line (black) - main metric
            grouped_delta = df_bin.groupby("iteration")["delta_quality_relative"]
            med_delta = grouped_delta.median().sort_index()
            q25_delta = grouped_delta.quantile(0.25).sort_index()
            q75_delta = grouped_delta.quantile(0.75).sort_index()
            vmin_delta = grouped_delta.min().sort_index()
            vmax_delta = grouped_delta.max().sort_index()

            x_delta = med_delta.index.values
            x_delta, (med_delta_y, q25_delta_y, q75_delta_y, vmin_delta_y, vmax_delta_y) = pad_with_zero(
                x_delta, med_delta.values, q25_delta.values, q75_delta.values, vmin_delta.values, vmax_delta.values
            )
            
            # Remove x=0 and keep x >= 1
            x_delta, (med_delta_y, q25_delta_y, q75_delta_y, vmin_delta_y, vmax_delta_y) = trim_zero_and_ensure_min_x(
                x_delta, med_delta_y, q25_delta_y, q75_delta_y, vmin_delta_y, vmax_delta_y
            )

            # delta_quality_relative 25–75% band
            ax.fill_between(x_delta, q25_delta_y, q75_delta_y, alpha=0.2, color="gray")
            ax.plot(x_delta, med_delta_y, color="black", linewidth=2, label="delta_quality_relative")
            
            # delta_quality_relative min/max markers
            ax.scatter(x_delta, vmin_delta_y, color="gray", marker="v", s=30, alpha=0.7)
            ax.scatter(x_delta, vmax_delta_y, color="gray", marker="^", s=30, alpha=0.7)

            # Node coverage overlay (blue) - same edge bin, same files
            if plot_node_coverage:
                grouped_nc = df_bin.groupby("iteration")["node_coverage"]
                med_nc = grouped_nc.median().sort_index()
                q25_nc = grouped_nc.quantile(0.25).sort_index()
                q75_nc = grouped_nc.quantile(0.75).sort_index()

                x_nc = med_nc.index.values
                x_nc, (med_nc_y, q25_nc_y, q75_nc_y, _, _) = pad_with_zero(
                    x_nc, med_nc.values, q25_nc.values, q75_nc.values, med_nc.values, med_nc.values
                )

                # Node coverage band (lighter blue)
                ax.fill_between(x_nc, q25_nc_y, q75_nc_y, alpha=0.15, color="blue")
                # Node coverage median line (blue)
                ax.plot(x_nc, med_nc_y, color="blue", linewidth=2, label="node_coverage")

    # Labels
    for i, method in enumerate(methods):
        axes[i, 0].set_ylabel(method, fontsize=12, fontweight="bold")
        if i == len(methods) - 1:
            for j in range(len(cols)):
                axes[i, j].set_xlabel("Iteration", fontsize=12, fontweight="bold")
    
    for j, col_name in enumerate(cols):
        axes[0, j].text(
            0.5, 1.08, col_name,
            transform=axes[0, j].transAxes,
            ha="center", va="bottom", fontsize=11, fontweight="bold"
        )

    # Legend if node_coverage plotted
    if plot_node_coverage:
        axes[-1, -1].legend(loc='upper right', fontsize=10)

    # Clean up
    for i in range(len(methods)):
        for j in range(1, len(cols)):
            axes[i, j].set_ylabel("")
        for j in range(len(cols)):
            axes[i, j].set_title("")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Figure saved to {output_path}")
    
def plot_delta_qualityAbs_by_edges(csv_path, output_path, filter_small=False, plot_node_coverage=False):
    """
    Create matrix of plots: rows=methods, cols=edges quantiles (low/medium/high)
    [with optional node_coverage overlay on same charts] and save to file.
    
    Args:
        csv_path: path to input CSV file
        output_path: path where to save the image (png, pdf, etc)
        filter_small: if True, skip files where sample at iteration 1 < 7
        plot_node_coverage: if True, overlay node_coverage line on each edge bin chart
    """
    # Load
    df = pd.read_csv(csv_path)
    
    # Compute delta_quality_relative
    if 's_qualityGT' in df.columns and 's_qualityAbs' in df.columns:
        df['delta_quality_relative'] = df['s_qualityGT'] - df['s_qualityAbs']
    else:
        raise ValueError("Missing required columns for delta_quality_relative: s_qualityGT or s_qualityAbs")
    
    # Apply filter if requested
    if filter_small:
        df_iter1 = df[df['iteration'] == 1]
        if not df_iter1.empty and 'sample' in df_iter1.columns:
            small_files = df_iter1[df_iter1['sample'] < 7]['file'].unique()
            df = df[~df['file'].isin(small_files)]
            print(f"Filtered out {len(small_files)} small files")
        else:
            print("Warning: Could not filter - missing iteration=1 or sample column")
    
    if df.empty:
        print(f"Warning: No data left after filtering. Skipping {output_path}")
        return

    # Basic checks
    required = {"file", "iteration", "method", "num_edges"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Check node_coverage availability if requested
    has_node_coverage = 'node_coverage' in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' column missing. Using delta_quality_relative only.")
        plot_node_coverage = False

    # Ensure numeric columns
    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
    df["num_edges"] = pd.to_numeric(df["num_edges"], errors="coerce")
    df["delta_quality_relative"] = pd.to_numeric(df["delta_quality_relative"], errors="coerce")
    if has_node_coverage:
        df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")
    
    df = df.dropna(subset=['num_edges', 'delta_quality_relative'])
    if df.empty:
        print(f"Warning: No valid data. Skipping {output_path}")
        return

    methods = ["degree", "closeness", "betweeness", "rmc", "random", "spectral"]
    
    # Edge quantiles (always 3 columns)
    edges_quantiles = df["num_edges"].quantile([0.33, 0.66])
    if edges_quantiles.isna().any():
        print(f"Warning: Insufficient data for edge quantiles. Using single column.")
        cols = ["all_edges"]
        edge_bins = {"all_edges": pd.Series([True] * len(df), index=df.index)}
    else:
        q33, q66 = int(edges_quantiles[0.33]), int(edges_quantiles[0.66])
        low_edges = df["num_edges"] <= edges_quantiles[0.33]
        med_edges = (df["num_edges"] > edges_quantiles[0.33]) & (df["num_edges"] <= edges_quantiles[0.66])
        high_edges = df["num_edges"] > edges_quantiles[0.66]
        
        edge_bins = {
            f"low (≤{q33})": low_edges, 
            f"medium ({q33}-{q66})": med_edges, 
            f"high (> {q66})": high_edges
        }
        cols = [
            "low (≤{})".format(q33),
            "medium ({}-{})".format(q33, q66),
            "high (> {})".format(q66),
        ]

    print(f"Plotting {len(cols)} edge bins with node_coverage overlay: {plot_node_coverage}")

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(methods),
        ncols=len(cols),  # Fixed 3 columns for edge bins
        figsize=(15, 4*len(methods)),
        sharex=True,
        sharey=False,  # Independent y-scales
    )

    # Make sure axes is 2D
    axes = np.atleast_2d(axes)

    # Plot for each method and edge bin
    for i, method in enumerate(methods):
        df_m = df[df["method"] == method]

        for j, col_name in enumerate(cols):
            ax = axes[i, j]

            # Filter for this edge bin (same file/iteration groups)
            if col_name == "all_edges":
                df_bin = df_m
            else:
                mask = edge_bins[col_name]
                df_bin = df_m[mask]
            
            if df_bin.empty:
                continue

            # delta_quality_relative line (black) - main metric
            grouped_delta = df_bin.groupby("iteration")["delta_quality_relative"]
            med_delta = grouped_delta.median().sort_index()
            q25_delta = grouped_delta.quantile(0.25).sort_index()
            q75_delta = grouped_delta.quantile(0.75).sort_index()
            vmin_delta = grouped_delta.min().sort_index()
            vmax_delta = grouped_delta.max().sort_index()

            x_delta = med_delta.index.values
            x_delta, (med_delta_y, q25_delta_y, q75_delta_y, vmin_delta_y, vmax_delta_y) = pad_with_zero(
                x_delta, med_delta.values, q25_delta.values, q75_delta.values, vmin_delta.values, vmax_delta.values
            )
            
            # Remove x=0 and keep x >= 1
            x_delta, (med_delta_y, q25_delta_y, q75_delta_y, vmin_delta_y, vmax_delta_y) = trim_zero_and_ensure_min_x(
                x_delta, med_delta_y, q25_delta_y, q75_delta_y, vmin_delta_y, vmax_delta_y
            )

            # delta_quality_relative 25–75% band
            ax.fill_between(x_delta, q25_delta_y, q75_delta_y, alpha=0.2, color="gray")
            ax.plot(x_delta, med_delta_y, color="black", linewidth=2, label="delta_quality_relative")
            
            # delta_quality_relative min/max markers
            ax.scatter(x_delta, vmin_delta_y, color="gray", marker="v", s=30, alpha=0.7)
            ax.scatter(x_delta, vmax_delta_y, color="gray", marker="^", s=30, alpha=0.7)

            # Node coverage overlay (blue) - same edge bin, same files
            if plot_node_coverage:
                grouped_nc = df_bin.groupby("iteration")["node_coverage"]
                med_nc = grouped_nc.median().sort_index()
                q25_nc = grouped_nc.quantile(0.25).sort_index()
                q75_nc = grouped_nc.quantile(0.75).sort_index()

                x_nc = med_nc.index.values
                x_nc, (med_nc_y, q25_nc_y, q75_nc_y, _, _) = pad_with_zero(
                    x_nc, med_nc.values, q25_nc.values, q75_nc.values, med_nc.values, med_nc.values
                )

                # Node coverage band (lighter blue)
                ax.fill_between(x_nc, q25_nc_y, q75_nc_y, alpha=0.15, color="blue")
                # Node coverage median line (blue)
                ax.plot(x_nc, med_nc_y, color="blue", linewidth=2, label="node_coverage")

    # Labels
    for i, method in enumerate(methods):
        axes[i, 0].set_ylabel(method, fontsize=12, fontweight="bold")
        if i == len(methods) - 1:
            for j in range(len(cols)):
                axes[i, j].set_xlabel("Iteration", fontsize=12, fontweight="bold")
    
    for j, col_name in enumerate(cols):
        axes[0, j].text(
            0.5, 1.08, col_name,
            transform=axes[0, j].transAxes,
            ha="center", va="bottom", fontsize=11, fontweight="bold"
        )

    # Legend if node_coverage plotted
    if plot_node_coverage:
        axes[-1, -1].legend(loc='upper right', fontsize=10)

    # Clean up
    for i in range(len(methods)):
        for j in range(1, len(cols)):
            axes[i, j].set_ylabel("")
        for j in range(len(cols)):
            axes[i, j].set_title("")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Figure saved to {output_path}")

def plot_kt_by_topology(df, output_path, topologies=None, filter_small=False, plot_node_coverage=False):
    """
    KT by topology with optional node_coverage overlay on same charts.
    
    Args:
        df: DataFrame (from preprocess_topology)
        output_path: path where to save the image (png, pdf, etc)
        topologies: optional list of topology names to plot
        filter_small: if True, skip files where sample at iteration 1 < 7
        plot_node_coverage: if True, overlay node_coverage line on each topology chart
    """
    # Apply filter if requested
    if filter_small:
        df_filtered = df[(df['iteration'] == 1) & (df['sample'] < 7)].groupby('file').first().reset_index()
        small_files = df_filtered['file'].unique()
        df = df[~df['file'].isin(small_files)].copy()
        print(f"Filtered out {len(small_files)} small files")

    # Basic checks
    required = {"iteration", "method", "KT", "topology"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Check node_coverage availability if requested
    has_node_coverage = 'node_coverage' in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' column missing. Using KT only.")
        plot_node_coverage = False

    # Ensure numeric iteration
    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
    if has_node_coverage:
        df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")

    all_topologies = sorted(df["topology"].dropna().unique())
    
    # Filter topologies if specified
    if topologies is None:
        selected_topologies = all_topologies
    else:
        selected_topologies = [t for t in topologies if t in all_topologies]
        if len(selected_topologies) != len(topologies):
            missing_t = set(topologies) - set(selected_topologies)
            print(f"WARNING: Topologies not found: {missing_t}")
    
    print(f"DEBUG: Plotting topologies: {selected_topologies} with node_coverage overlay: {plot_node_coverage}")
    
    if len(selected_topologies) == 0:
        raise ValueError("No valid topologies to plot")
    
    methods = ["degree", "closeness", "betweeness", "rmc", "random", "spectral"]

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(methods),
        ncols=len(selected_topologies),
        figsize=(4 * len(selected_topologies), 4*len(methods)),
        sharex=True,
        sharey=True,
    )

    # Make sure axes is 2D
    axes = np.atleast_2d(axes)

    # Plot per method and topology
    for i, method in enumerate(methods):
        df_m = df[df["method"] == method]

        for j, topo in enumerate(selected_topologies):
            ax = axes[i][j]

            # Filter for this topology (same files)
            df_topo = df_m[df_m["topology"] == topo]
            
            if df_topo.empty:
                print(f"WARNING: No data for topology '{topo}' method '{method}'")
                continue

            # KT line (black) - original
            grouped_kt = df_topo.groupby("iteration")["KT"]
            med_kt = grouped_kt.median().sort_index()
            q25_kt = grouped_kt.quantile(0.25).sort_index()
            q75_kt = grouped_kt.quantile(0.75).sort_index()
            vmin_kt = grouped_kt.min().sort_index()
            vmax_kt = grouped_kt.max().sort_index()

            x_kt = med_kt.index.values
            x_kt, (med_kt_y, q25_kt_y, q75_kt_y, vmin_kt_y, vmax_kt_y) = pad_with_zero(
                x_kt, med_kt.values, q25_kt.values, q75_kt.values, vmin_kt.values, vmax_kt.values
            )

            # KT 25–75% band
            ax.fill_between(x_kt, q25_kt_y, q75_kt_y, alpha=0.2, color="gray")
            ax.plot(x_kt, med_kt_y, color="black", linewidth=2, label="KT")
            
            # KT min/max markers
            ax.scatter(x_kt, vmin_kt_y, color="gray", marker="v", s=30, alpha=0.7)
            ax.scatter(x_kt, vmax_kt_y, color="gray", marker="^", s=30, alpha=0.7)

            # Node coverage overlay (blue) - same topology, same files
            if plot_node_coverage:
                grouped_nc = df_topo.groupby("iteration")["node_coverage"]
                med_nc = grouped_nc.median().sort_index()
                q25_nc = grouped_nc.quantile(0.25).sort_index()
                q75_nc = grouped_nc.quantile(0.75).sort_index()

                x_nc = med_nc.index.values
                x_nc, (med_nc_y, q25_nc_y, q75_nc_y, _, _) = pad_with_zero(
                    x_nc, med_nc.values, q25_nc.values, q75_nc.values, med_nc.values, med_nc.values
                )

                # Node coverage band (lighter blue)
                ax.fill_between(x_nc, q25_nc_y, q75_nc_y, alpha=0.15, color="blue")
                # Node coverage median line (blue)
                ax.plot(x_nc, med_nc_y, color="blue", linewidth=2, label="node_coverage")

    # Labels
    for i, method in enumerate(methods):
        axes[i][0].set_ylabel(method, fontsize=12, fontweight="bold")
        if i == len(methods) - 1:
            for jj in range(len(selected_topologies)):
                axes[i][jj].set_xlabel("Iteration", fontsize=12, fontweight="bold")
    
    for j, topo in enumerate(selected_topologies):
        axes[0][j].text(
            0.5, 1.08, topo,
            transform=axes[0][j].transAxes,
            ha="center", va="bottom", fontsize=11, fontweight="bold", wrap=True,
        )

    # Legend if node_coverage plotted
    if plot_node_coverage:
        axes[-1, -1].legend(loc='upper right', fontsize=10)

    # Clean up
    for j in range(1, len(selected_topologies)):
        axes[0][j].set_ylabel("")

    for i in range(len(axes)):
        for j in range(len(axes[0])):
            axes[i][j].set_title("")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Figure saved to {output_path}")

def plot_ktgen_by_topology(df, output_path, topologies=None, filter_small=False, plot_node_coverage=False):
    """
    KT_gen by topology with optional node_coverage overlay on same charts.
    
    Args:
        df: DataFrame (from preprocess_topology)
        output_path: path where to save the image (png, pdf, etc)
        topologies: optional list of topology names to plot
        filter_small: if True, skip files where sample at iteration 1 < 7
        plot_node_coverage: if True, overlay node_coverage line on each topology chart
    """
    # Apply filter if requested
    if filter_small:
        df_filtered = df[(df['iteration'] == 1) & (df['sample'] < 7)].groupby('file').first().reset_index()
        small_files = df_filtered['file'].unique()
        df = df[~df['file'].isin(small_files)].copy()
        print(f"Filtered out {len(small_files)} small files")

    # Basic checks
    required = {"iteration", "method", "KT_gen", "topology"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Check node_coverage availability if requested
    has_node_coverage = 'node_coverage' in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' column missing. Using KT_gen only.")
        plot_node_coverage = False

    df = df.copy()
    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
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
    
    print(f"DEBUG: Plotting topologies: {selected_topologies} with node_coverage overlay: {plot_node_coverage}")
    
    if len(selected_topologies) == 0:
        raise ValueError("No valid topologies to plot")
    
    methods = ["degree", "closeness", "betweeness", "rmc", "random", "spectral"]

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(methods),
        ncols=len(selected_topologies),
        figsize=(4 * len(selected_topologies), 4*len(methods)),
        sharex=True,
        sharey=True,
    )
    axes = np.atleast_2d(axes)

    # Plot per method and topology
    for i, method in enumerate(methods):
        df_m = df[df["method"] == method]

        for j, topo in enumerate(selected_topologies):
            ax = axes[i][j]
            df_topo = df_m[df_m["topology"] == topo]
            
            if df_topo.empty:
                continue

            # KT_gen line (black) - original
            grouped_ktgen = df_topo.groupby("iteration")["KT_gen"]
            med_ktgen = grouped_ktgen.median().sort_index()
            q25_ktgen = grouped_ktgen.quantile(0.25).sort_index()
            q75_ktgen = grouped_ktgen.quantile(0.75).sort_index()
            vmin_ktgen = grouped_ktgen.min().sort_index()
            vmax_ktgen = grouped_ktgen.max().sort_index()

            x_ktgen = med_ktgen.index.values
            x_ktgen, (med_ktgen_y, q25_ktgen_y, q75_ktgen_y, vmin_ktgen_y, vmax_ktgen_y) = pad_with_zero(
                x_ktgen, med_ktgen.values, q25_ktgen.values, q75_ktgen.values, 
                vmin_ktgen.values, vmax_ktgen.values
            )

            # KT_gen 25–75% band
            ax.fill_between(x_ktgen, q25_ktgen_y, q75_ktgen_y, alpha=0.2, color="gray")
            ax.plot(x_ktgen, med_ktgen_y, color="black", linewidth=2, label="KT_gen")
            
            # KT_gen min/max markers
            ax.scatter(x_ktgen, vmin_ktgen_y, color="gray", marker="v", s=30, alpha=0.7)
            ax.scatter(x_ktgen, vmax_ktgen_y, color="gray", marker="^", s=30, alpha=0.7)

            # Node coverage overlay (blue) - same topology, same files
            if plot_node_coverage:
                grouped_nc = df_topo.groupby("iteration")["node_coverage"]
                med_nc = grouped_nc.median().sort_index()
                q25_nc = grouped_nc.quantile(0.25).sort_index()
                q75_nc = grouped_nc.quantile(0.75).sort_index()

                x_nc = med_nc.index.values
                x_nc, (med_nc_y, q25_nc_y, q75_nc_y, _, _) = pad_with_zero(
                    x_nc, med_nc.values, q25_nc.values, q75_nc.values, med_nc.values, med_nc.values
                )

                # Node coverage band (lighter blue)
                ax.fill_between(x_nc, q25_nc_y, q75_nc_y, alpha=0.15, color="blue")
                # Node coverage median line (blue)
                ax.plot(x_nc, med_nc_y, color="blue", linewidth=2, label="node_coverage")

    # Labels
    for i, method in enumerate(methods):
        axes[i][0].set_ylabel(method, fontsize=12, fontweight="bold")
        if i == len(methods) - 1:
            for jj in range(len(selected_topologies)):
                axes[i][jj].set_xlabel("Iteration", fontsize=12, fontweight="bold")
    
    for j, topo in enumerate(selected_topologies):
        axes[0][j].text(
            0.5, 1.08, topo,
            transform=axes[0][j].transAxes,
            ha="center", va="bottom", fontsize=11, fontweight="bold", wrap=True,
        )

    # Legend if node_coverage plotted
    if plot_node_coverage:
        axes[-1, -1].legend(loc='upper right', fontsize=10)

    # Clean up
    for j in range(1, len(selected_topologies)):
        axes[0][j].set_ylabel("")

    for i in range(len(axes)):
        for j in range(len(axes[0])):
            axes[i][j].set_title("")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Figure saved to {output_path}")

def plot_jaccard_by_topology(df, output_path, topologies=None, filter_small=False, plot_node_coverage=False):
    """
    KT by topology with optional node_coverage overlay on same charts.
    
    Args:
        df: DataFrame (from preprocess_topology)
        output_path: path where to save the image (png, pdf, etc)
        topologies: optional list of topology names to plot
        filter_small: if True, skip files where sample at iteration 1 < 7
        plot_node_coverage: if True, overlay node_coverage line on each topology chart
    """
    # Apply filter if requested
    if filter_small:
        df_filtered = df[(df['iteration'] == 1) & (df['sample'] < 7)].groupby('file').first().reset_index()
        small_files = df_filtered['file'].unique()
        df = df[~df['file'].isin(small_files)].copy()
        print(f"Filtered out {len(small_files)} small files")

    # Basic checks
    required = {"iteration", "method", "jaccard", "topology"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Check node_coverage availability if requested
    has_node_coverage = 'node_coverage' in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' column missing. Using jaccard only.")
        plot_node_coverage = False

    # Ensure numeric iteration
    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
    if has_node_coverage:
        df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")

    all_topologies = sorted(df["topology"].dropna().unique())
    
    # Filter topologies if specified
    if topologies is None:
        selected_topologies = all_topologies
    else:
        selected_topologies = [t for t in topologies if t in all_topologies]
        if len(selected_topologies) != len(topologies):
            missing_t = set(topologies) - set(selected_topologies)
            print(f"WARNING: Topologies not found: {missing_t}")
    
    print(f"DEBUG: Plotting topologies: {selected_topologies} with node_coverage overlay: {plot_node_coverage}")
    
    if len(selected_topologies) == 0:
        raise ValueError("No valid topologies to plot")
    
    methods = ["degree", "closeness", "betweeness", "rmc", "random", "spectral"]

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(methods),
        ncols=len(selected_topologies),
        figsize=(4 * len(selected_topologies), 4*len(methods)),
        sharex=True,
        sharey=True,
    )

    # Make sure axes is 2D
    axes = np.atleast_2d(axes)

    # Plot per method and topology
    for i, method in enumerate(methods):
        df_m = df[df["method"] == method]

        for j, topo in enumerate(selected_topologies):
            ax = axes[i][j]

            # Filter for this topology (same files)
            df_topo = df_m[df_m["topology"] == topo]
            
            if df_topo.empty:
                print(f"WARNING: No data for topology '{topo}' method '{method}'")
                continue

            # jaccard line (black) - original
            grouped_jaccard = df_topo.groupby("iteration")["jaccard"]
            med_jaccard = grouped_jaccard.median().sort_index()
            q25_jaccard = grouped_jaccard.quantile(0.25).sort_index()
            q75_jaccard = grouped_jaccard.quantile(0.75).sort_index()
            vmin_jaccard = grouped_jaccard.min().sort_index()
            vmax_jaccard = grouped_jaccard.max().sort_index()

            x_jaccard = med_jaccard.index.values
            x_jaccard, (med_jaccard_y, q25_jaccard_y, q75_jaccard_y, vmin_jaccard_y, vmax_jaccard_y) = pad_with_zero(
                x_jaccard, med_jaccard.values, q25_jaccard.values, q75_jaccard.values, vmin_jaccard.values, vmax_jaccard.values
            )

            # jaccard 25–75% band
            ax.fill_between(x_jaccard, q25_jaccard_y, q75_jaccard_y, alpha=0.2, color="gray")
            ax.plot(x_jaccard, med_jaccard_y, color="black", linewidth=2, label="jaccard")
            
            # jaccard min/max markers
            ax.scatter(x_jaccard, vmin_jaccard_y, color="gray", marker="v", s=30, alpha=0.7)
            ax.scatter(x_jaccard, vmax_jaccard_y, color="gray", marker="^", s=30, alpha=0.7)

            # Node coverage overlay (blue) - same topology, same files
            if plot_node_coverage:
                grouped_nc = df_topo.groupby("iteration")["node_coverage"]
                med_nc = grouped_nc.median().sort_index()
                q25_nc = grouped_nc.quantile(0.25).sort_index()
                q75_nc = grouped_nc.quantile(0.75).sort_index()

                x_nc = med_nc.index.values
                x_nc, (med_nc_y, q25_nc_y, q75_nc_y, _, _) = pad_with_zero(
                    x_nc, med_nc.values, q25_nc.values, q75_nc.values, med_nc.values, med_nc.values
                )

                # Node coverage band (lighter blue)
                ax.fill_between(x_nc, q25_nc_y, q75_nc_y, alpha=0.15, color="blue")
                # Node coverage median line (blue)
                ax.plot(x_nc, med_nc_y, color="blue", linewidth=2, label="node_coverage")

    # Labels
    for i, method in enumerate(methods):
        axes[i][0].set_ylabel(method, fontsize=12, fontweight="bold")
        if i == len(methods) - 1:
            for jj in range(len(selected_topologies)):
                axes[i][jj].set_xlabel("Iteration", fontsize=12, fontweight="bold")
    
    for j, topo in enumerate(selected_topologies):
        axes[0][j].text(
            0.5, 1.08, topo,
            transform=axes[0][j].transAxes,
            ha="center", va="bottom", fontsize=11, fontweight="bold", wrap=True,
        )

    # Legend if node_coverage plotted
    if plot_node_coverage:
        axes[-1, -1].legend(loc='upper right', fontsize=10)

    # Clean up
    for j in range(1, len(selected_topologies)):
        axes[0][j].set_ylabel("")

    for i in range(len(axes)):
        for j in range(len(axes[0])):
            axes[i][j].set_title("")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Figure saved to {output_path}")

def plot_deltaRel_by_topology(df, output_path, topologies=None, filter_small=False, plot_node_coverage=False):
    """
    delta_quality_relative by topology with optional node_coverage overlay on same charts.
    
    Args:
        df: DataFrame (from preprocess_topology)
        output_path: path where to save the image (png, pdf, etc)
        topologies: optional list of topology names to plot
        filter_small: if True, skip files where sample at iteration 1 < 7
        plot_node_coverage: if True, overlay node_coverage line on each topology chart
    """
    # Compute delta_quality_relative if not present
    if 's_qualityGT' in df.columns and 's_qualityRel' in df.columns:
        df['delta_quality_relative'] = df['s_qualityGT'] - df['s_qualityRel']
    elif 'delta_quality_relative' not in df.columns:
        raise ValueError("Missing columns to compute delta_quality_relative: need s_qualityGT and s_qualityRel")
    
    # Apply filter if requested
    if filter_small:
        df_filtered = df[(df['iteration'] == 1) & (df['sample'] < 7)].groupby('file').first().reset_index()
        small_files = df_filtered['file'].unique()
        df = df[~df['file'].isin(small_files)].copy()
        print(f"Filtered out {len(small_files)} small files")

    # Basic checks
    required = {"iteration", "method", "delta_quality_relative", "topology"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Check node_coverage availability if requested
    has_node_coverage = 'node_coverage' in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' column missing. Using delta_quality_relative only.")
        plot_node_coverage = False

    # Ensure numeric iteration
    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
    df["delta_quality_relative"] = pd.to_numeric(df["delta_quality_relative"], errors="coerce")
    if has_node_coverage:
        df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")

    all_topologies = sorted(df["topology"].dropna().unique())
    
    # Filter topologies if specified
    if topologies is None:
        selected_topologies = all_topologies
    else:
        selected_topologies = [t for t in topologies if t in all_topologies]
        if len(selected_topologies) != len(topologies):
            missing_t = set(topologies) - set(selected_topologies)
            print(f"WARNING: Topologies not found: {missing_t}")
    
    print(f"DEBUG: Plotting topologies: {selected_topologies} with node_coverage overlay: {plot_node_coverage}")
    
    if len(selected_topologies) == 0:
        raise ValueError("No valid topologies to plot")
    
    methods = ["degree", "closeness", "betweeness", "rmc", "random", "spectral"]

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(methods),
        ncols=len(selected_topologies),
        figsize=(4 * len(selected_topologies), 4*len(methods)),
        sharex=True,
        sharey=False,  # Independent y-scales
    )

    # Make sure axes is 2D
    axes = np.atleast_2d(axes)

    # Plot per method and topology
    for i, method in enumerate(methods):
        df_m = df[df["method"] == method]

        for j, topo in enumerate(selected_topologies):
            ax = axes[i][j]

            # Filter for this topology (same files)
            df_topo = df_m[df_m["topology"] == topo]
            
            if df_topo.empty:
                print(f"WARNING: No data for topology '{topo}' method '{method}'")
                continue

            # delta_quality_relative line (black) - main metric
            grouped_delta = df_topo.groupby("iteration")["delta_quality_relative"]
            med_delta = grouped_delta.median().sort_index()
            q25_delta = grouped_delta.quantile(0.25).sort_index()
            q75_delta = grouped_delta.quantile(0.75).sort_index()
            vmin_delta = grouped_delta.min().sort_index()
            vmax_delta = grouped_delta.max().sort_index()

            x_delta = med_delta.index.values
            x_delta, (med_delta_y, q25_delta_y, q75_delta_y, vmin_delta_y, vmax_delta_y) = pad_with_zero(
                x_delta, med_delta.values, q25_delta.values, q75_delta.values, vmin_delta.values, vmax_delta.values
            )
            
            # Remove x=0 and keep x >= 1
            x_delta, (med_delta_y, q25_delta_y, q75_delta_y, vmin_delta_y, vmax_delta_y) = trim_zero_and_ensure_min_x(
                x_delta, med_delta_y, q25_delta_y, q75_delta_y, vmin_delta_y, vmax_delta_y
            )

            # delta_quality_relative 25–75% band
            ax.fill_between(x_delta, q25_delta_y, q75_delta_y, alpha=0.2, color="gray")
            ax.plot(x_delta, med_delta_y, color="black", linewidth=2, label="delta_quality_relative")
            
            # delta_quality_relative min/max markers
            ax.scatter(x_delta, vmin_delta_y, color="gray", marker="v", s=30, alpha=0.7)
            ax.scatter(x_delta, vmax_delta_y, color="gray", marker="^", s=30, alpha=0.7)

            # Node coverage overlay (blue) - same topology, same files
            if plot_node_coverage:
                grouped_nc = df_topo.groupby("iteration")["node_coverage"]
                med_nc = grouped_nc.median().sort_index()
                q25_nc = grouped_nc.quantile(0.25).sort_index()
                q75_nc = grouped_nc.quantile(0.75).sort_index()

                x_nc = med_nc.index.values
                x_nc, (med_nc_y, q25_nc_y, q75_nc_y, _, _) = pad_with_zero(
                    x_nc, med_nc.values, q25_nc.values, q75_nc.values, med_nc.values, med_nc.values
                )

                # Node coverage band (lighter blue)
                ax.fill_between(x_nc, q25_nc_y, q75_nc_y, alpha=0.15, color="blue")
                # Node coverage median line (blue)
                ax.plot(x_nc, med_nc_y, color="blue", linewidth=2, label="node_coverage")

    # Labels
    for i, method in enumerate(methods):
        axes[i][0].set_ylabel(method, fontsize=12, fontweight="bold")
        if i == len(methods) - 1:
            for jj in range(len(selected_topologies)):
                axes[i][jj].set_xlabel("Iteration", fontsize=12, fontweight="bold")
    
    for j, topo in enumerate(selected_topologies):
        axes[0][j].text(
            0.5, 1.08, topo,
            transform=axes[0][j].transAxes,
            ha="center", va="bottom", fontsize=11, fontweight="bold", wrap=True,
        )

    # Legend if node_coverage plotted
    if plot_node_coverage:
        axes[-1, -1].legend(loc='upper right', fontsize=10)

    # Clean up
    for j in range(1, len(selected_topologies)):
        axes[0][j].set_ylabel("")

    for i in range(len(axes)):
        for j in range(len(axes[0])):
            axes[i][j].set_title("")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Figure saved to {output_path}")

def plot_deltaAbs_by_topology(df, output_path, topologies=None, filter_small=False, plot_node_coverage=False):
    """
    delta_quality_relative by topology with optional node_coverage overlay on same charts.
    
    Args:
        df: DataFrame (from preprocess_topology)
        output_path: path where to save the image (png, pdf, etc)
        topologies: optional list of topology names to plot
        filter_small: if True, skip files where sample at iteration 1 < 7
        plot_node_coverage: if True, overlay node_coverage line on each topology chart
    """
    # Compute delta_quality_relative if not present
    if 's_qualityGT' in df.columns and 's_qualityAbs' in df.columns:
        df['delta_quality_relative'] = df['s_qualityGT'] - df['s_qualityAbs']
    elif 'delta_quality_relative' not in df.columns:
        raise ValueError("Missing columns to compute delta_quality_relative: need s_qualityGT and s_qualityAbs")
    
    # Apply filter if requested
    if filter_small:
        df_filtered = df[(df['iteration'] == 1) & (df['sample'] < 7)].groupby('file').first().reset_index()
        small_files = df_filtered['file'].unique()
        df = df[~df['file'].isin(small_files)].copy()
        print(f"Filtered out {len(small_files)} small files")

    # Basic checks
    required = {"iteration", "method", "delta_quality_relative", "topology"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Check node_coverage availability if requested
    has_node_coverage = 'node_coverage' in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' column missing. Using delta_quality_relative only.")
        plot_node_coverage = False

    # Ensure numeric iteration
    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
    df["delta_quality_relative"] = pd.to_numeric(df["delta_quality_relative"], errors="coerce")
    if has_node_coverage:
        df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")

    all_topologies = sorted(df["topology"].dropna().unique())
    
    # Filter topologies if specified
    if topologies is None:
        selected_topologies = all_topologies
    else:
        selected_topologies = [t for t in topologies if t in all_topologies]
        if len(selected_topologies) != len(topologies):
            missing_t = set(topologies) - set(selected_topologies)
            print(f"WARNING: Topologies not found: {missing_t}")
    
    print(f"DEBUG: Plotting topologies: {selected_topologies} with node_coverage overlay: {plot_node_coverage}")
    
    if len(selected_topologies) == 0:
        raise ValueError("No valid topologies to plot")
    
    methods = ["degree", "closeness", "betweeness", "rmc", "random", "spectral"]

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(
        nrows=len(methods),
        ncols=len(selected_topologies),
        figsize=(4 * len(selected_topologies), 4*len(methods)),
        sharex=True,
        sharey=False,  # Independent y-scales
    )

    # Make sure axes is 2D
    axes = np.atleast_2d(axes)

    # Plot per method and topology
    for i, method in enumerate(methods):
        df_m = df[df["method"] == method]

        for j, topo in enumerate(selected_topologies):
            ax = axes[i][j]

            # Filter for this topology (same files)
            df_topo = df_m[df_m["topology"] == topo]
            
            if df_topo.empty:
                print(f"WARNING: No data for topology '{topo}' method '{method}'")
                continue

            # delta_quality_relative line (black) - main metric
            grouped_delta = df_topo.groupby("iteration")["delta_quality_relative"]
            med_delta = grouped_delta.median().sort_index()
            q25_delta = grouped_delta.quantile(0.25).sort_index()
            q75_delta = grouped_delta.quantile(0.75).sort_index()
            vmin_delta = grouped_delta.min().sort_index()
            vmax_delta = grouped_delta.max().sort_index()

            x_delta = med_delta.index.values
            x_delta, (med_delta_y, q25_delta_y, q75_delta_y, vmin_delta_y, vmax_delta_y) = pad_with_zero(
                x_delta, med_delta.values, q25_delta.values, q75_delta.values, vmin_delta.values, vmax_delta.values
            )
            
            # Remove x=0 and keep x >= 1
            x_delta, (med_delta_y, q25_delta_y, q75_delta_y, vmin_delta_y, vmax_delta_y) = trim_zero_and_ensure_min_x(
                x_delta, med_delta_y, q25_delta_y, q75_delta_y, vmin_delta_y, vmax_delta_y
            )

            # delta_quality_relative 25–75% band
            ax.fill_between(x_delta, q25_delta_y, q75_delta_y, alpha=0.2, color="gray")
            ax.plot(x_delta, med_delta_y, color="black", linewidth=2, label="delta_quality_relative")
            
            # delta_quality_relative min/max markers
            ax.scatter(x_delta, vmin_delta_y, color="gray", marker="v", s=30, alpha=0.7)
            ax.scatter(x_delta, vmax_delta_y, color="gray", marker="^", s=30, alpha=0.7)

            # Node coverage overlay (blue) - same topology, same files
            if plot_node_coverage:
                grouped_nc = df_topo.groupby("iteration")["node_coverage"]
                med_nc = grouped_nc.median().sort_index()
                q25_nc = grouped_nc.quantile(0.25).sort_index()
                q75_nc = grouped_nc.quantile(0.75).sort_index()

                x_nc = med_nc.index.values
                x_nc, (med_nc_y, q25_nc_y, q75_nc_y, _, _) = pad_with_zero(
                    x_nc, med_nc.values, q25_nc.values, q75_nc.values, med_nc.values, med_nc.values
                )

                # Node coverage band (lighter blue)
                ax.fill_between(x_nc, q25_nc_y, q75_nc_y, alpha=0.15, color="blue")
                # Node coverage median line (blue)
                ax.plot(x_nc, med_nc_y, color="blue", linewidth=2, label="node_coverage")

    # Labels
    for i, method in enumerate(methods):
        axes[i][0].set_ylabel(method, fontsize=12, fontweight="bold")
        if i == len(methods) - 1:
            for jj in range(len(selected_topologies)):
                axes[i][jj].set_xlabel("Iteration", fontsize=12, fontweight="bold")
    
    for j, topo in enumerate(selected_topologies):
        axes[0][j].text(
            0.5, 1.08, topo,
            transform=axes[0][j].transAxes,
            ha="center", va="bottom", fontsize=11, fontweight="bold", wrap=True,
        )

    # Legend if node_coverage plotted
    if plot_node_coverage:
        axes[-1, -1].legend(loc='upper right', fontsize=10)

    # Clean up
    for j in range(1, len(selected_topologies)):
        axes[0][j].set_ylabel("")

    for i in range(len(axes)):
        for j in range(len(axes[0])):
            axes[i][j].set_title("")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Figure saved to {output_path}")


# def plot_kt_disaggregated(df, output_base_path, filter_small=False, plot_node_coverage=False):
#     """
#     Create 1 plot per topology: rows=methods, cols=edges quantiles.
#     Each subplot shows KT (black), KT_gen (blue), [node_coverage (orange) overlay].
#     """
#     # Apply filter if requested
#     if filter_small:
#         df_filtered = df[(df['iteration'] == 1) & (df['sample'] < 7)].groupby('file').first().reset_index()
#         small_files = df_filtered['file'].unique()
#         df = df[~df['file'].isin(small_files)].copy()
#         print(f"Filtered out {len(small_files)} small files")

#     required = {"iteration", "method", "KT", "KT_gen", "num_edges", "topology"}
#     missing = required - set(df.columns)
#     if missing:
#         raise ValueError(f"Missing required columns: {missing}")

#     # Check node_coverage availability
#     has_node_coverage = 'node_coverage' in df.columns and plot_node_coverage
#     if plot_node_coverage and not has_node_coverage:
#         print("WARNING: plot_node_coverage=True but 'node_coverage' missing. Skipping overlay.")
#         plot_node_coverage = False

#     df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
#     df["num_edges"] = pd.to_numeric(df["num_edges"], errors="coerce")
#     if has_node_coverage:
#         df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")

#     topologies = sorted(df["topology"].dropna().unique())
#     print(f"Detected topologies: {topologies} with node_coverage overlay: {plot_node_coverage}")
    
#     methods = ["degree", "closeness", "betweeness", "rmc", "random", "spectral"]
#     sns.set_style("whitegrid")
    
#     for topo in topologies:
#         df_topo = df[df["topology"] == topo]
#         if df_topo.empty:
#             print(f"Skipping empty topology: {topo}")
#             continue
            
#         edges_quantiles = df_topo["num_edges"].quantile([0.33, 0.66])
#         q33, q66 = int(edges_quantiles[0.33]), int(edges_quantiles[0.66])
        
#         low_edges = df_topo["num_edges"] <= edges_quantiles[0.33]
#         med_edges = (df_topo["num_edges"] > edges_quantiles[0.33]) & (df_topo["num_edges"] <= edges_quantiles[0.66])
#         high_edges = df_topo["num_edges"] > edges_quantiles[0.66]
        
#         edge_bins = {
#             f"low (≤{q33})": low_edges,
#             f"medium ({q33}-{q66})": med_edges,
#             f"high (> {q66})": high_edges,
#         }
#         cols = [
#             "low (≤{})".format(q33),
#             "medium ({}-{})".format(q33, q66),
#             "high (> {})".format(q66),
#         ]

#         fig, axes = plt.subplots(
#             nrows=len(methods),
#             ncols=len(cols),
#             figsize=(14, 9),
#             sharex=True,
#             sharey=True,
#         )
#         axes = np.atleast_2d(axes)

#         for i, method in enumerate(methods):
#             df_m = df_topo[df_topo["method"] == method]

#             for j, col_name in enumerate(cols):
#                 ax = axes[i][j]
#                 mask = edge_bins[col_name]
#                 df_bin = df_m[mask]
                
#                 if df_bin.empty:
#                     continue

#                 # KT (black)
#                 grouped_kt = df_bin.groupby("iteration")["KT"]
#                 med_kt = grouped_kt.median().sort_index()
#                 q25_kt = grouped_kt.quantile(0.25).sort_index()
#                 q75_kt = grouped_kt.quantile(0.75).sort_index()
#                 vmin_kt = grouped_kt.min().sort_index()
#                 vmax_kt = grouped_kt.max().sort_index()
                
#                 # KT_gen (blue)
#                 grouped_ktgen = df_bin.groupby("iteration")["KT_gen"]
#                 med_ktgen = grouped_ktgen.median().sort_index()
#                 q25_ktgen = grouped_ktgen.quantile(0.25).sort_index()
#                 q75_ktgen = grouped_ktgen.quantile(0.75).sort_index()
#                 vmin_ktgen = grouped_ktgen.min().sort_index()
#                 vmax_ktgen = grouped_ktgen.max().sort_index()

#                 # Node coverage (orange) if requested
#                 if plot_node_coverage:
#                     grouped_nc = df_bin.groupby("iteration")["node_coverage"]
#                     med_nc = grouped_nc.median().sort_index()
#                     q25_nc = grouped_nc.quantile(0.25).sort_index()
#                     q75_nc = grouped_nc.quantile(0.75).sort_index()
#                     vmin_nc = grouped_nc.min().sort_index()
#                     vmax_nc = grouped_nc.max().sort_index()
#                 else:
#                     med_nc = pd.Series(dtype=float)
#                     q25_nc = pd.Series(dtype=float)
#                     q75_nc = pd.Series(dtype=float)
#                     vmin_nc = pd.Series(dtype=float)
#                     vmax_nc = pd.Series(dtype=float)
                
#                 x = med_kt.index.values

#                 # Pad ALL metrics together (always 15 values)
#                 (
#                     x,
#                     (
#                         med_kt_y, q25_kt_y, q75_kt_y, vmin_kt_y, vmax_kt_y,
#                         med_ktgen_y, q25_ktgen_y, q75_ktgen_y, vmin_ktgen_y, vmax_ktgen_y,
#                         med_nc_y, q25_nc_y, q75_nc_y, vmin_nc_y, vmax_nc_y,
#                     ),
#                 ) = pad_with_zero(
#                     x,
#                     med_kt.values, q25_kt.values, q75_kt.values, vmin_kt.values, vmax_kt.values,
#                     med_ktgen.values, q25_ktgen.values, q75_ktgen.values, vmin_ktgen.values, vmax_ktgen.values,
#                     med_nc.values, q25_nc.values, q75_nc.values, vmin_nc.values, vmax_nc.values,
#                 )

#                 # KT (black)
#                 ax.fill_between(x, q25_kt_y, q75_kt_y, alpha=0.2, color="black")
#                 ax.plot(x, med_kt_y, color="black", linewidth=2, label="KT")
#                 ax.scatter(x, vmin_kt_y, color="black", marker="v", s=20, alpha=0.7)
#                 ax.scatter(x, vmax_kt_y, color="black", marker="^", s=20, alpha=0.7)

#                 # KT_gen (blue)
#                 ax.fill_between(x, q25_ktgen_y, q75_ktgen_y, alpha=0.2, color="blue")
#                 ax.plot(x, med_ktgen_y, color="blue", linewidth=2, label="KT_gen")
#                 ax.scatter(x, vmin_ktgen_y, color="blue", marker="v", s=20, alpha=0.7)
#                 ax.scatter(x, vmax_ktgen_y, color="blue", marker="^", s=20, alpha=0.7)

#                 # Node coverage (orange) - only if data exists
#                 if plot_node_coverage and len(med_nc_y) > 0:
#                     ax.fill_between(x, q25_nc_y, q75_nc_y, alpha=0.15, color="orange")
#                     ax.plot(x, med_nc_y, color="orange", linewidth=2, label="node_coverage")
#                     ax.scatter(x, vmin_nc_y, color="orange", marker="v", s=20, alpha=0.7)
#                     ax.scatter(x, vmax_nc_y, color="orange", marker="^", s=20, alpha=0.7)

#         # Labels
#         for i, method in enumerate(methods):
#             axes[i][0].set_ylabel(method, fontsize=12, fontweight="bold")
#             if i == len(methods) - 1:
#                 for jj in range(len(cols)):
#                     axes[i][jj].set_xlabel("Iteration", fontsize=12, fontweight="bold")
        
#         for j, col_name in enumerate(cols):
#             axes[0][j].text(
#                 0.5, 1.05, col_name,
#                 transform=axes[0][j].transAxes,
#                 ha="center", va="bottom", fontsize=11, fontweight="bold",
#             )

#         # Legend
#         axes[0][0].legend(loc="upper right", fontsize=9)

#         # Clean up
#         for j in range(1, len(cols)):
#             axes[0][j].set_ylabel("")

#         for i in range(len(axes)):
#             for j in range(len(axes[0])):
#                 axes[i][j].set_title("")

#         plt.tight_layout()
#         output_file = f"{output_base_path}_{topo}.png"
#         plt.savefig(output_file, dpi=300, bbox_inches="tight")
#         plt.close(fig)
#         print(f"Saved: {output_file}")
def plot_kt_disaggregated(df, output_base_path, topologies=None, filter_small=False, plot_node_coverage=False):
    """
    Create 1 plot per topology: rows=methods, cols=edges quantiles.
    Each subplot shows KT (black), KT_gen (blue), jaccard (purple) median lines only,
    [node_coverage (orange) median line overlay].
    """
    # Apply filter if requested
    if filter_small:
        df_filtered = df[(df['iteration'] == 1) & (df['sample'] < 7)].groupby('file').first().reset_index()
        small_files = df_filtered['file'].unique()
        df = df[~df['file'].isin(small_files)].copy()
        print(f"Filtered out {len(small_files)} small files")

    required = {"iteration", "method", "KT", "KT_gen", "jaccard", "num_edges", "topology"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Check node_coverage availability
    has_node_coverage = 'node_coverage' in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' missing. Skipping overlay.")
        plot_node_coverage = False

    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
    df["num_edges"] = pd.to_numeric(df["num_edges"], errors="coerce")
    metrics_to_numeric = ["KT", "KT_gen", "jaccard"]
    if has_node_coverage:
        metrics_to_numeric.append("node_coverage")
        df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")
    df[metrics_to_numeric] = df[metrics_to_numeric].apply(pd.to_numeric, errors='coerce')

    # topologies = sorted(df["topology"].dropna().unique())
    
    all_topologies = sorted(df["topology"].dropna().unique())
    
    # Filter topologies if specified
    if topologies is None:
        selected_topologies = all_topologies
    else:
        selected_topologies = [t for t in topologies if t in all_topologies]
        if len(selected_topologies) != len(topologies):
            missing_t = set(topologies) - set(selected_topologies)
            print(f"WARNING: Topologies not found: {missing_t}")
    
    print(f"Detected topologies: {selected_topologies} with node_coverage overlay: {plot_node_coverage}")
    
    methods = ["degree", "closeness", "betweeness", "rmc", "random", "spectral"]
    sns.set_style("whitegrid")
    
    metric_names = ["KT", "KT_gen", "jaccard"]
    colors = ["black", "blue", "purple"]
    if plot_node_coverage:
        metric_names.append("node_coverage")
        colors.append("orange")
    
    for topo in selected_topologies:
        df_topo = df[df["topology"] == topo]
        if df_topo.empty:
            print(f"Skipping empty topology: {topo}")
            continue
            
        edges_quantiles = df_topo["num_edges"].quantile([0.33, 0.66])
        q33, q66 = int(edges_quantiles[0.33]), int(edges_quantiles[0.66])
        
        low_edges = df_topo["num_edges"] <= edges_quantiles[0.33]
        med_edges = (df_topo["num_edges"] > edges_quantiles[0.33]) & (df_topo["num_edges"] <= edges_quantiles[0.66])
        high_edges = df_topo["num_edges"] > edges_quantiles[0.66]
        
        edge_bins = {
            f"low (≤{q33})": low_edges,
            f"medium ({q33}-{q66})": med_edges,
            f"high (> {q66})": high_edges,
        }
        cols = [
            "low (≤{})".format(q33),
            "medium ({}-{})".format(q33, q66),
            "high (> {})".format(q66),
        ]

        fig, axes = plt.subplots(
            nrows=len(methods),
            ncols=len(cols),
            figsize=(14, 4*len(methods)),
            sharex=True,
            sharey=False,
        )
        axes = np.atleast_2d(axes)

        for i, method in enumerate(methods):
            df_m = df_topo[df_topo["method"] == method]

            for j, col_name in enumerate(cols):
                ax = axes[i][j]
                mask = edge_bins[col_name]
                df_bin = df_m[mask]
                
                if df_bin.empty:
                    continue

                # Plot median lines only for each metric
                for k, metric in enumerate(metric_names):
                    grouped = df_bin.groupby("iteration")[metric]
                    med = grouped.median().sort_index()
                    
                    x = med.index.values
                    x, (med_y,) = pad_with_zero(x, med.values)
                    
                    color = colors[k]
                    linewidth = 3 if metric == "node_coverage" else 2
                    ax.plot(x, med_y, color=color, linewidth=linewidth, label=metric)

        # Labels
        for i, method in enumerate(methods):
            axes[i][0].set_ylabel(method, fontsize=12, fontweight="bold")
            if i == len(methods) - 1:
                for jj in range(len(cols)):
                    axes[i][jj].set_xlabel("Iteration", fontsize=12, fontweight="bold")
        
        for j, col_name in enumerate(cols):
            axes[0][j].text(
                0.5, 1.05, col_name,
                transform=axes[0][j].transAxes,
                ha="center", va="bottom", fontsize=11, fontweight="bold",
            )

        # Legend
        axes[0][0].legend(loc="upper right", fontsize=9)

        # Clean up
        for j in range(1, len(cols)):
            axes[0][j].set_ylabel("")

        for i in range(len(axes)):
            for j in range(len(axes[0])):
                axes[i][j].set_title("")

        plt.tight_layout()
        output_file = f"{output_base_path}_{topo}.png"
        plt.savefig(output_file, dpi=300, bbox_inches="tight")
        plt.close(fig)
        print(f"Saved: {output_file}")
        

def plot_kt_disaggregated_quality(df, output_base_path, topologies=None, filter_small=False, plot_node_coverage=False):
    """
    Create 1 plot per topology: rows=methods, cols=edges quantiles.
    Each subplot shows quality median lines only,
    [node_coverage (orange) median line overlay].
    """
    # Apply filter if requested
    if filter_small:
        df_filtered = df[(df['iteration'] == 1) & (df['sample'] < 7)].groupby('file').first().reset_index()
        small_files = df_filtered['file'].unique()
        df = df[~df['file'].isin(small_files)].copy()
        print(f"Filtered out {len(small_files)} small files")

    required = {"iteration", "method", "s_qualityGT","s_qualityRel","s_qualityAbs", "num_edges", "topology"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Check node_coverage availability
    has_node_coverage = 'node_coverage' in df.columns and plot_node_coverage
    if plot_node_coverage and not has_node_coverage:
        print("WARNING: plot_node_coverage=True but 'node_coverage' missing. Skipping overlay.")
        plot_node_coverage = False

    df["iteration"] = pd.to_numeric(df["iteration"], errors="coerce")
    df["num_edges"] = pd.to_numeric(df["num_edges"], errors="coerce")
    # Compute new metrics
    df['delta_quality_relative'] = df['s_qualityGT'] - df['s_qualityRel']
    df['delta_quality_absolute'] = df['s_qualityGT'] - df['s_qualityAbs']
    
    metrics_to_numeric = ["delta_quality_relative", "delta_quality_absolute"]
    if has_node_coverage:
        metrics_to_numeric.append("node_coverage")
        df["node_coverage"] = pd.to_numeric(df["node_coverage"], errors="coerce")
    df[metrics_to_numeric] = df[metrics_to_numeric].apply(pd.to_numeric, errors='coerce')

    # topologies = sorted(df["topology"].dropna().unique())
    
    all_topologies = sorted(df["topology"].dropna().unique())
    
    # Filter topologies if specified
    if topologies is None:
        selected_topologies = all_topologies
    else:
        selected_topologies = [t for t in topologies if t in all_topologies]
        if len(selected_topologies) != len(topologies):
            missing_t = set(topologies) - set(selected_topologies)
            print(f"WARNING: Topologies not found: {missing_t}")
    
    print(f"Detected topologies: {selected_topologies} with node_coverage overlay: {plot_node_coverage}")
    
    methods = ["degree", "closeness", "betweeness", "rmc", "random", "spectral"]
    sns.set_style("whitegrid")
    
    metric_names = ["delta_quality_relative", "delta_quality_absolute"]
    colors = ["black", "blue"]
    if plot_node_coverage:
        metric_names.append("node_coverage")
        colors.append("orange")
    
    for topo in selected_topologies:
        df_topo = df[df["topology"] == topo]
        if df_topo.empty:
            print(f"Skipping empty topology: {topo}")
            continue
            
        edges_quantiles = df_topo["num_edges"].quantile([0.33, 0.66])
        q33, q66 = int(edges_quantiles[0.33]), int(edges_quantiles[0.66])
        
        low_edges = df_topo["num_edges"] <= edges_quantiles[0.33]
        med_edges = (df_topo["num_edges"] > edges_quantiles[0.33]) & (df_topo["num_edges"] <= edges_quantiles[0.66])
        high_edges = df_topo["num_edges"] > edges_quantiles[0.66]
        
        edge_bins = {
            f"low (≤{q33})": low_edges,
            f"medium ({q33}-{q66})": med_edges,
            f"high (> {q66})": high_edges,
        }
        cols = [
            "low (≤{})".format(q33),
            "medium ({}-{})".format(q33, q66),
            "high (> {})".format(q66),
        ]

        fig, axes = plt.subplots(
            nrows=len(methods),
            ncols=len(cols),
            figsize=(14, 4*len(methods)),
            sharex=True,
            sharey=False,
        )
        axes = np.atleast_2d(axes)

        for i, method in enumerate(methods):
            df_m = df_topo[df_topo["method"] == method]

            for j, col_name in enumerate(cols):
                ax = axes[i][j]
                mask = edge_bins[col_name]
                df_bin = df_m[mask]
                
                if df_bin.empty:
                    continue

                # Plot median lines only for each metric
                for k, metric in enumerate(metric_names):
                    grouped = df_bin.groupby("iteration")[metric]
                    med = grouped.median().sort_index()
                    
                    x = med.index.values
                    # x, (med_y,) = pad_with_zero(x, med.values)
                    x, (med_y,) = trim_zero_and_ensure_min_x(x, med.values)
                    
                    color = colors[k]
                    linewidth = 3 if metric == "node_coverage" else 2
                    ax.plot(x, med_y, color=color, linewidth=linewidth, label=metric)

        # Labels
        for i, method in enumerate(methods):
            axes[i][0].set_ylabel(method, fontsize=12, fontweight="bold")
            if i == len(methods) - 1:
                for jj in range(len(cols)):
                    axes[i][jj].set_xlabel("Iteration", fontsize=12, fontweight="bold")
        
        for j, col_name in enumerate(cols):
            axes[0][j].text(
                0.5, 1.05, col_name,
                transform=axes[0][j].transAxes,
                ha="center", va="bottom", fontsize=11, fontweight="bold",
            )

        # Legend
        axes[0][0].legend(loc="upper right", fontsize=9)

        # Clean up
        for j in range(1, len(cols)):
            axes[0][j].set_ylabel("")

        for i in range(len(axes)):
            for j in range(len(axes[0])):
                axes[i][j].set_title("")

        plt.tight_layout()
        output_file = f"{output_base_path}_{topo}_quality.png"
        plt.savefig(output_file, dpi=300, bbox_inches="tight")
        plt.close(fig)
        print(f"Saved: {output_file}")



# The other functions (extract_topology, add_topology_column, preprocess_topology) remain unchanged
def extract_topology(file_path):
    """Extract topology from file path - SIMPLIFIED"""
    # For your data: extract part between last two '/' characters
    # e.g., "progressive/synthetic_graphs/hybrid_complete_noisy_N100_E4950" 
    # -> "hybrid_complete_noisy_N100_E4950" -> "hybrid_complete_noisy"
    parts = file_path.rsplit('/', 2)  # Split from right, get last 3 parts
    if len(parts) >= 2:
        filename_part = parts[-1]  # "hybrid_complete_noisy_N100_E4950"
        # Take everything before first '_N'
        if '_N' in filename_part:
            return filename_part.split('_N')[0]
        else:
            return filename_part.split('_')[0]
    return file_path.split('/')[-1].split('_')[0]

def add_topology_column(csv_path, json_dir=None):
    """
    Add 'topology' column to CSV by classifying each unique file's graph.
    
    Args:
        csv_path: path to CSV with 'file' column
        json_dir: directory containing JSON files (default: same dir as CSV)
    
    Returns: DataFrame with added 'topology' column
    """
    df = pd.read_csv(csv_path)
    
    if 'file' not in df.columns:
        raise ValueError("CSV must have 'file' column")
    
    # Use same dir as CSV if json_dir not specified
    if json_dir is None:
        json_dir = Path(csv_path).parent
    
    # Get unique files
    unique_files = df['file'].unique()
    topology_map = {}
    
    print(f"Classifying {len(unique_files)} unique graphs...")
    
    for file_path in unique_files:        
        json_path = file_path + ".json"  # Ensure .json extension
        
        try:
            model, sim = get_topology(str(json_path))
            topology_map[file_path] = model
        except Exception as e:
            print(f"Error processing {json_path}: {e}")
            topology_map[file_path] = 'error'
    
    # Map to dataframe
    df['topology'] = df['file'].map(topology_map)
    
    print("\nTopology distribution:")
    print(df['topology'].value_counts())
    
    return df

def preprocess_topology(stats_file):
    """
    Add 'topology' column to CSV:
    - synthetic: extract from filename using extract_topology()
    - benchmark: classify each graph using get_topology()
    
    Modifies the CSV file in-place and returns the DataFrame.
    """
    df = pd.read_csv(stats_file)
    
    # Determine data type from filename
    if 'synthetic' in stats_file:
        print("[SYNTHETIC] Extracting topology from filenames...")
        df['topology'] = df['file'].apply(extract_topology)
        
    elif 'benchmark' in stats_file:
        print("[BENCHMARK] Classifying graphs with get_topology()...")
        # Assume JSON files are in same directory structure
        json_base_dir = Path(stats_file).parent.parent / "rome_benchmark"  # Adjust path as needed
        df = add_topology_column(stats_file, json_dir=str(json_base_dir))
        
    else:
        print("Warning: Unknown dataset type, no topology added")
        return df
    
    # Save updated CSV
    df.to_csv(stats_file, index=False)
    print(f"Saved {stats_file} with topology column")
    print("Topology distribution:")
    print(df['topology'].value_counts().head())
    return df

if __name__ == "__main__":
    
    for dat in ["synthetic","benchmark"]:  # "synthetic","benchmark"
        stats_file = "progressive/data/results_" + dat + ".csv"
        
        plot_aggregate = "progressive/plot/aggregate_" + dat + ".png"
        
        plot_size_std = "progressive/plot/size_KT_" + dat + ".png"
        plot_size_gen = "progressive/plot/size_KTgen_" + dat + ".png"
        plot_size_jac = "progressive/plot/size_jaccard_" + dat + ".png"
        plot_size_qualRel = "progressive/plot/size_qualityRel_" + dat + ".png"
        plot_size_qualAbs = "progressive/plot/size_qualityAbs_" + dat + ".png"
        
        plot_topology_std = "progressive/plot/topology_KT_" + dat + ".png"
        plot_topology_gen = "progressive/plot/topology_KTgen_" + dat + ".png"
        plot_topology_jac = "progressive/plot/topology_jaccard_" + dat + ".png"
        plot_topology_qualRel = "progressive/plot/topology_qualityRel_" + dat + ".png"
        plot_topology_qualAbs = "progressive/plot/topology_qualityAbs_" + dat + ".png"
        
        plot_disagg_gen = "progressive/plot/disaggregated_" + dat + "/"
        Path(plot_aggregate).parent.mkdir(parents=True, exist_ok=True)
        
        # Example usage with filter_small=True
        plot_kt_matrix(stats_file, plot_aggregate, filter_small=True, plot_node_coverage=False)
        plot_kt_by_edges(stats_file, plot_size_std, filter_small=True, plot_node_coverage=False)
        plot_ktgen_by_edges(stats_file, plot_size_gen, filter_small=True, plot_node_coverage=False)
        plot_jaccard_by_edges(stats_file, plot_size_jac, filter_small=True, plot_node_coverage=False)
        plot_delta_qualityRel_by_edges(stats_file, plot_size_qualRel, filter_small=True, plot_node_coverage=False)
        plot_delta_qualityAbs_by_edges(stats_file, plot_size_qualAbs, filter_small=True, plot_node_coverage=False)
        
        topos = []
        for t in ['balanced_tree', 'barabasi_albert', 'complete', 'erdos_renyi', 'geometric', 
                  'hybrid_BA_ring', 'hybrid_SBM_mesh', 'hybrid_WS_star', 'hybrid_bridge_BA_WS', 
                  'hybrid_complete_noisy', 'hybrid_path_ER', 'hybrid_ring_mesh', 
                  'hybrid_spatial_SF', 'hybrid_star_mesh', 'hybrid_star_ring', 
                  'hybrid_union_ER_BA', 'hybrid_union_WS_SBM', 'mesh', 'path', 'powerlaw_cluster', 
                  'random_regular', 'ring', 'star', 'stochastic_block', 'watts_strogatz']:
            if "hybrid" not in t: topos.append(t)
            
        print(topos)
        
        if dat == "synthetic":
            Path(plot_disagg_gen).mkdir(exist_ok=True)
            df_stats = preprocess_topology(stats_file)
            
            # plot_kt_by_topology(df_stats, plot_topology_std, filter_small=True, plot_node_coverage=False)
            # plot_ktgen_by_topology(df_stats, plot_topology_gen, filter_small=True, plot_node_coverage=False)
            # plot_jaccard_by_topology(df_stats, plot_topology_jac, filter_small=True, plot_node_coverage=False)
            # plot_deltaRel_by_topology(df_stats, plot_topology_qualRel, filter_small=True, plot_node_coverage=False)
            # plot_deltaAbs_by_topology(df_stats, plot_topology_qualAbs, filter_small=True, plot_node_coverage=False)
            plot_kt_by_topology(df_stats, plot_topology_std, topologies=topos, filter_small=True, plot_node_coverage=False)
            plot_ktgen_by_topology(df_stats, plot_topology_gen, topologies=topos, filter_small=True, plot_node_coverage=False)
            plot_jaccard_by_topology(df_stats, plot_topology_jac, topologies=topos, filter_small=True, plot_node_coverage=False)
            plot_deltaRel_by_topology(df_stats, plot_topology_qualRel, topologies=topos, filter_small=True, plot_node_coverage=False)
            plot_deltaAbs_by_topology(df_stats, plot_topology_qualAbs, topologies=topos, filter_small=True, plot_node_coverage=False)
            
            plot_kt_disaggregated(df_stats, plot_disagg_gen, topologies=topos, filter_small=True, plot_node_coverage=False)
            plot_kt_disaggregated_quality(df_stats, plot_disagg_gen, topologies=topos, filter_small=True, plot_node_coverage=False)
