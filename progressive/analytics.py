import math
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns


# ============================================================
# GLOBAL STYLE / PLOT CONFIG
# ============================================================
FONT_FAMILY = "DejaVu Sans"
FONT_SIZE = 14
FONT_SIZE_SMALL = 12
FONT_SIZE_TITLE = 16
FONT_SIZE_SUPTITLE = 18
ANNOTATION_SIZE = 12
LEGEND_SIZE = 12
LEGEND_TITLE_SIZE = 13

FIG_DPI = 300
BAR_DPI = 220
HEATMAP_DPI = 220

PARETO_POINT_SIZE = 90
PARETO_EDGEWIDTH = 0.9
PARETO_ALPHA = 0.90

SIZE_ORDER = ["small", "medium", "large"]
SIZE_COLORS = {
    "small": "#4C78A8",
    "medium": "#F58518",
    "large": "#54A24B",
}

THRESHOLD_LABEL_COLORS = {
    "coverage_KT_gen_90": "#4C78A8",
    "elbow_coverage_for_KT_gen": "#72A7D4",
    "quality_gap_20": "#F58518",
    "elbow_coverage_for_quality_gap": "#FFB267",
}

RANKING_PALETTE = "tab10"

METHOD_ORDER = [
    "random",
    "degree",
    "betweenness",
    "closeness",
    "eigenvector",
    "pagerank",
    "pakerank",
]

METHOD_COLORS = {
    "random": "#4C78A8",
    "degree": "#F58518",
    "betweeness": "#54A24B",
    "closeness": "#E45756",
    "rmc": "#B279A2",
    "spectral": "#361E45",
    "pagerank": "#72B7B2",
    "pakerank": "#72B7B2",   # same color if typo exists in data
}

def get_method_order(df, method_col="method"):
    present = df[method_col].dropna().astype(str).unique().tolist()

    ordered = [m for m in METHOD_ORDER if m in present]
    remaining = sorted([m for m in present if m not in METHOD_ORDER])

    return ordered + remaining


def get_method_palette(df, method_col="method"):
    methods = get_method_order(df, method_col=method_col)
    palette = {}

    extra_colors = sns.color_palette("tab20", n_colors=max(20, len(methods)))
    extra_idx = 0

    for m in methods:
        if m in METHOD_COLORS:
            palette[m] = METHOD_COLORS[m]
        else:
            palette[m] = extra_colors[extra_idx]
            extra_idx += 1

    return palette

plt.rcParams.update({
    "font.family": FONT_FAMILY,
    "font.size": FONT_SIZE,
    "axes.titlesize": FONT_SIZE_TITLE,
    "axes.labelsize": FONT_SIZE,
    "xtick.labelsize": FONT_SIZE_SMALL,
    "ytick.labelsize": FONT_SIZE_SMALL,
    "legend.fontsize": LEGEND_SIZE,
    "figure.titlesize": FONT_SIZE_SUPTITLE,
})


# ============================================================
# HELPERS
# ============================================================
def edge_bin_setup(df):
    edges_quantiles = df["num_edges"].quantile([0.33, 0.66])

    if edges_quantiles.isna().any():
        cols = ["all_edges"]
        edge_bins = {"all_edges": pd.Series([True] * len(df), index=df.index)}
    else:
        low_edges = df["num_edges"] <= edges_quantiles.loc[0.33]
        med_edges = (df["num_edges"] > edges_quantiles.loc[0.33]) & (df["num_edges"] <= edges_quantiles.loc[0.66])
        high_edges = df["num_edges"] > edges_quantiles.loc[0.66]

        edge_bins = {
            "small": low_edges,
            "medium": med_edges,
            "large": high_edges,
        }
        cols = ["small", "medium", "large"]

    return cols, edge_bins


def prepare_data(csv_path, quality_col="s_qualityAbs", epsilon=1e-8):
    df = pd.read_csv(csv_path).copy()

    if "topology" not in df.columns:
        df["topology"] = (
            df["file"]
            .astype(str)
            .str.replace("progressive/synthetic_graphs/", "", regex=False)
            .str.replace("progressive\\\\synthetic_graphs\\\\", "", regex=False)
            .str.split("_")
            .str[0]
        )

    required = [
        "file", "sample", "iteration", "method",
        "KT_gen", "s_qualityGT", quality_col,
        "node_coverage", "num_edges"
    ]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    df["quality_error"] = (
        np.abs(df[quality_col] - df["s_qualityGT"]) /
        (np.abs(df["s_qualityGT"]) + epsilon)
    )
    df["quality_gap"] = (df["s_qualityGT"] - df[quality_col]).abs()

    for c in ["KT_gen", "node_coverage", "num_edges", "quality_error", "quality_gap"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    return df


def add_graph_size(df):
    df = df.copy()
    cols, bins = edge_bin_setup(df)
    df["graph_size"] = "unknown"
    for c in cols:
        df.loc[bins[c], "graph_size"] = c
    df["graph_size"] = pd.Categorical(df["graph_size"], categories=SIZE_ORDER, ordered=True)
    return df


def ensure_pagerank_present(df):
    methods = set(df["method"].astype(str).str.lower().unique())
    if "pagerank" not in methods:
        print("Warning: pagerank is not present in the input data.")


# ============================================================
# RANKINGS
# ============================================================
def rank_by_size(df, file_col="file", method_col="method"):
    benefit_cols = ["KT_gen", "node_coverage"]
    cost_cols = ["s_qualityError"]
    criteria = benefit_cols + cost_cols

    weights = {
        "KT_gen": 0.45,
        "node_coverage": 0.10,
        "s_qualityError": 0.45,
    }

    required = [file_col, method_col, "KT_gen", "s_qualityGT", "s_qualityAbs", "node_coverage", "num_edges"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    df = add_graph_size(df.copy())
    df["GT_quality"] = df["s_qualityGT"]
    df["s_qualityError"] = (df["GT_quality"] - df["s_qualityAbs"]).abs()

    for c in ["KT_gen", "node_coverage", "s_qualityError"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    agg = df.groupby(["graph_size", method_col], as_index=False)[criteria].mean()

    for c in cost_cols:
        agg[c] = -agg[c]

    w = np.array([weights[c] for c in criteria], dtype=float)
    w = w / w.sum()

    out = []
    for size, g in agg.groupby("graph_size", sort=False):
        X = g[criteria].to_numpy(dtype=float)
        denom = np.sqrt((X ** 2).sum(axis=0))
        denom[denom == 0] = 1.0
        Xn = X / denom
        Xw = Xn * w

        ideal_best = np.max(Xw, axis=0)
        ideal_worst = np.min(Xw, axis=0)

        d_best = np.sqrt(((Xw - ideal_best) ** 2).sum(axis=1))
        d_worst = np.sqrt(((Xw - ideal_worst) ** 2).sum(axis=1))

        score = d_worst / (d_best + d_worst + 1e-12)
        rnk = pd.Series(-score).rank(method="min", ascending=True).astype(int).to_numpy()

        tmp = g[["graph_size", method_col]].copy()
        tmp["topsis_score"] = score
        tmp["topsis_rank"] = rnk
        out.append(tmp)

    ranked = pd.concat(out, ignore_index=True) if out else pd.DataFrame(columns=["graph_size", method_col, "topsis_score", "topsis_rank"])
    ranked = ranked.sort_values(["graph_size", "topsis_rank", "topsis_score"], ascending=[True, True, False]).reset_index(drop=True)

    best = (
        ranked.groupby("graph_size", as_index=False)
        .first()
        .rename(columns={method_col: "best_method"})
    ) if not ranked.empty else pd.DataFrame(columns=["graph_size", "best_method"])

    return ranked, best


def rank_by_topology(df, file_col="file", method_col="method"):
    benefit_cols = ["KT_gen", "node_coverage"]
    cost_cols = ["s_qualityError"]
    criteria = benefit_cols + cost_cols

    weights = {
        "KT_gen": 0.45,
        "node_coverage": 0.10,
        "s_qualityError": 0.45,
    }

    required = [file_col, method_col, "KT_gen", "s_qualityGT", "s_qualityAbs", "node_coverage"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    df = df.copy()
    df = df[~df["topology"].astype(str).str.contains("hybrid", case=False, na=False)].copy()
    
    df["GT_quality"] = df["s_qualityGT"]
    df["s_qualityError"] = (df["GT_quality"] - df["s_qualityAbs"]).abs()

    for c in ["KT_gen", "node_coverage", "s_qualityError"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    agg = df.groupby(["topology", method_col], as_index=False)[criteria].mean()

    for c in cost_cols:
        agg[c] = -agg[c]

    w = np.array([weights[c] for c in criteria], dtype=float)
    w = w / w.sum()

    out = []
    for topo, g in agg.groupby("topology", sort=False):
        X = g[criteria].to_numpy(dtype=float)
        denom = np.sqrt((X ** 2).sum(axis=0))
        denom[denom == 0] = 1.0
        Xn = X / denom
        Xw = Xn * w

        ideal_best = np.max(Xw, axis=0)
        ideal_worst = np.min(Xw, axis=0)

        d_best = np.sqrt(((Xw - ideal_best) ** 2).sum(axis=1))
        d_worst = np.sqrt(((Xw - ideal_worst) ** 2).sum(axis=1))

        score = d_worst / (d_best + d_worst + 1e-12)
        rnk = pd.Series(-score).rank(method="min", ascending=True).astype(int).to_numpy()

        tmp = g[["topology", method_col]].copy()
        tmp["topsis_score"] = score
        tmp["topsis_rank"] = rnk
        out.append(tmp)

    ranked = pd.concat(out, ignore_index=True) if out else pd.DataFrame(columns=["topology", method_col, "topsis_score", "topsis_rank"])
    ranked = ranked.sort_values(["topology", "topsis_rank", "topsis_score"], ascending=[True, True, False]).reset_index(drop=True)

    best = (
        ranked.groupby("topology", as_index=False)
        .first()
        .rename(columns={method_col: "best_method"})
    ) if not ranked.empty else pd.DataFrame(columns=["topology", "best_method"])

    return ranked, best


# ============================================================
# RANKING PLOTS
# ============================================================
def plot_rank_counts(df, outFile, group_col, method_col="best_method", title=None, xlabel=None):
    ctab = pd.crosstab(df[group_col], df[method_col])

    fig, ax = plt.subplots(figsize=(11, 6))
    ctab.plot(kind="bar", ax=ax, colormap=RANKING_PALETTE, width=0.82)

    ax.set_title(title if title else f"Best method by {group_col}")
    ax.set_xlabel(xlabel if xlabel else group_col)
    ax.set_ylabel("Count")
    if "size" in group_col: ax.tick_params(axis="x")
    else: ax.tick_params(axis="x", rotation=90)
    ax.grid(True, axis="y", alpha=0.25)

    leg = ax.legend(title="Method", frameon=False)
    if leg is not None:
        leg.set_title("Method", prop={"size": LEGEND_TITLE_SIZE})

    fig.tight_layout()
    fig.savefig(outFile, dpi=BAR_DPI, bbox_inches="tight")
    plt.close(fig)
    return fig, ax


def plot_rank_scores(ranked, outFile, group_col, method_col="method", title=None, xlabel=None):
    ranked = ranked.copy()
    ranked[group_col] = ranked[group_col].astype(str)
    ranked[method_col] = ranked[method_col].astype(str)

    hue_order = get_method_order(ranked, method_col=method_col)
    palette = get_method_palette(ranked, method_col=method_col)

    fig, ax = plt.subplots(figsize=(13, 6), constrained_layout=True)

    sns.barplot(
        data=ranked,
        x=group_col,
        y="topsis_score",
        hue=method_col,
        hue_order=hue_order,
        palette=palette,
        ax=ax
    )

    ax.set_title(title if title else f"TOPSIS score by {group_col}")
    ax.set_xlabel(xlabel if xlabel else group_col)
    ax.set_ylabel("TOPSIS score")
    if "size" in group_col: ax.tick_params(axis="x")
    else: ax.tick_params(axis="x", rotation=90)
    ax.grid(True, axis="y", alpha=0.25)

    # Place legend outside so it never overlaps the chart
    leg = ax.legend(
        title="Method",
        frameon=False,
        loc="upper left",
        bbox_to_anchor=(1.02, 1.0),
        borderaxespad=0.0
    )
    if leg is not None:
        leg.set_title("Method", prop={"size": LEGEND_TITLE_SIZE})

    fig.savefig(outFile, dpi=BAR_DPI, bbox_inches="tight")
    plt.close(fig)
    return fig, ax

# ============================================================
# PARETO MATRIX
# ============================================================
def compute_method_pareto_summary(df):
    df = add_graph_size(df.copy())

    # Avoid pandas categorical groupby bug
    df["graph_size"] = df["graph_size"].astype(str)

    summary = (
        df.groupby(["topology", "graph_size", "method"], observed=True)
        .agg(
            KT_gen=("KT_gen", "median"),
            quality_error=("quality_error", "median"),
            num_edges=("num_edges", "median"),
            node_coverage=("node_coverage", "median"),
        )
        .reset_index()
    )

    # keep desired order in plots
    df_order = {k: i for i, k in enumerate(SIZE_ORDER)}
    summary["graph_size_order"] = summary["graph_size"].map(df_order)
    summary = summary.sort_values(["topology", "graph_size_order", "method"]).drop(columns="graph_size_order")

    return summary

def identify_pareto_front(x, y, maximize_x=True, minimize_y=True):
    pts = np.column_stack([x, y]).astype(float)
    n = len(pts)
    is_pareto = np.ones(n, dtype=bool)

    for i in range(n):
        for j in range(n):
            if i == j:
                continue

            better_or_equal_x = pts[j, 0] >= pts[i, 0] if maximize_x else pts[j, 0] <= pts[i, 0]
            better_or_equal_y = pts[j, 1] <= pts[i, 1] if minimize_y else pts[j, 1] >= pts[i, 1]

            strictly_better_x = pts[j, 0] > pts[i, 0] if maximize_x else pts[j, 0] < pts[i, 0]
            strictly_better_y = pts[j, 1] < pts[i, 1] if minimize_y else pts[j, 1] > pts[i, 1]

            if better_or_equal_x and better_or_equal_y and (strictly_better_x or strictly_better_y):
                is_pareto[i] = False
                break

    return is_pareto


def plot_matrix_pareto(df, save_path="progressive/plot/pareto_matrix.png"):
    summary = compute_method_pareto_summary(df)
    topologies = sorted(summary["topology"].dropna().unique())
    n = len(topologies)

    ncols = math.ceil(math.sqrt(n))
    nrows = math.ceil(n / ncols)

    fig, axes = plt.subplots(
        nrows, ncols,
        figsize=(6.2 * ncols, 5.6 * nrows),
        constrained_layout=True
    )
    axes = np.atleast_1d(axes).flatten()

    x = summary["KT_gen"].to_numpy(dtype=float)
    y = summary["quality_error"].to_numpy(dtype=float)
    x_min, x_max = np.nanmin(x), np.nanmax(x)
    y_min, y_max = np.nanmin(y), np.nanmax(y)
    x_pad = (x_max - x_min) * 0.08 if x_max > x_min else 0.05
    y_pad = (y_max - y_min) * 0.08 if y_max > y_min else 0.05

    for i, topo in enumerate(topologies):
        ax = axes[i]
        sub = summary[summary["topology"] == topo].copy()

        for size in SIZE_ORDER:
            pts = sub[sub["graph_size"] == size].copy()
            if pts.empty:
                continue

            ax.scatter(
                pts["KT_gen"],
                pts["quality_error"],
                s=PARETO_POINT_SIZE,
                color=SIZE_COLORS.get(size, "gray"),
                alpha=PARETO_ALPHA,
                edgecolor="white",
                linewidth=PARETO_EDGEWIDTH,
                label=size
            )

            pareto_mask = identify_pareto_front(
                pts["KT_gen"].to_numpy(dtype=float),
                pts["quality_error"].to_numpy(dtype=float),
                maximize_x=True,
                minimize_y=True
            )
            pareto_pts = pts.loc[pareto_mask].sort_values("KT_gen")
            if len(pareto_pts) >= 2:
                ax.plot(
                    pareto_pts["KT_gen"],
                    pareto_pts["quality_error"],
                    color=SIZE_COLORS.get(size, "gray"),
                    linewidth=2.0,
                    alpha=0.9
                )

            for _, row in pts.iterrows():
                ax.annotate(
                    str(row["method"]),
                    xy=(row["KT_gen"], row["quality_error"]),
                    xytext=(5, 5),
                    textcoords="offset points",
                    fontsize=ANNOTATION_SIZE
                )

        ax.set_title(f"{topo}")
        ax.set_xlabel("KT_gen ↑")
        ax.set_ylabel("Quality error ↓")
        ax.set_xlim(x_min - x_pad, x_max + x_pad)
        ax.set_ylim(y_min - y_pad, y_max + y_pad)
        ax.grid(True, alpha=0.25)

        handles, labels = ax.get_legend_handles_labels()
        uniq = dict(zip(labels, handles))
        leg = ax.legend(uniq.values(), uniq.keys(), title="Graph size", frameon=False)
        if leg is not None:
            leg.set_title("Graph size", prop={"size": LEGEND_TITLE_SIZE})

    for j in range(i + 1, len(axes)):
        fig.delaxes(axes[j])

    fig.suptitle("Pareto matrix by topology, one point per method", y=1.02)
    fig.savefig(save_path, dpi=FIG_DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved plot to: {save_path}")


# ============================================================
# THRESHOLDS
# ============================================================
def compute_thresholds(df: pd.DataFrame, groupby=("topology", "method")):
    required = {
        "file", "sample", "iteration", "method", "KT_gen",
        "s_qualityGT", "s_qualityAbs", "node_coverage", "topology"
    }
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    def cross2d(a, b):
        a = np.asarray(a)
        b = np.asarray(b)
        return a[..., 0] * b[..., 1] - a[..., 1] * b[..., 0]

    def elbow_threshold(data, x_col, y_col, direction="max"):
        tmp = data[[x_col, y_col]].dropna().sort_values(x_col)
        if len(tmp) < 3:
            return np.nan

        x = tmp[x_col].to_numpy(dtype=float)
        y = tmp[y_col].to_numpy(dtype=float)

        if direction == "min":
            y = -y

        x_norm = (x - x.min()) / (x.max() - x.min() + 1e-12)
        y_norm = (y - y.min()) / (y.max() - y.min() + 1e-12)

        p1 = np.array([x_norm[0], y_norm[0]])
        p2 = np.array([x_norm[-1], y_norm[-1]])
        pts = np.column_stack([x_norm, y_norm])

        line = p2 - p1
        norm = np.linalg.norm(line)
        if norm < 1e-12:
            return np.nan

        dist = np.abs(cross2d(line, pts - p1)) / norm
        return float(x[np.argmax(dist)])

    def first_coverage_to_hit(data, metric, op, target):
        tmp = data[["node_coverage", metric]].dropna().sort_values("node_coverage")
        if op == "ge":
            hit = tmp[tmp[metric] >= target]
        elif op == "le":
            hit = tmp[tmp[metric] <= target]
        else:
            raise ValueError("op must be 'ge' or 'le'")
        return np.nan if hit.empty else float(hit.iloc[0]["node_coverage"])

    work = df.copy()
    work["quality_gap"] = (work["s_qualityGT"] - work["s_qualityAbs"]).abs()

    summary = (
        work.groupby(list(groupby) + ["iteration"], dropna=False)
        .agg({
            "KT_gen": "median",
            "quality_gap": "median",
            "node_coverage": "median",
            "sample": "median",
        })
        .reset_index()
        .rename(columns={"sample": "sample_size"})
    )

    rows = []
    for topology, topo_df in summary.groupby("topology", dropna=False):
        gap20 = topo_df["quality_gap"].quantile(0.3)

        rows.extend([
            {
                "topology": topology,
                "threshold_type": "coverage_KT_gen_90",
                "value": first_coverage_to_hit(topo_df, "KT_gen", "ge", 0.7)
            },
            {
                "topology": topology,
                "threshold_type": "quality_gap_20",
                "value": float(gap20)
            },
            {
                "topology": topology,
                "threshold_type": "elbow_coverage_for_KT_gen",
                "value": elbow_threshold(topo_df, "node_coverage", "KT_gen", direction="max")
            },
            {
                "topology": topology,
                "threshold_type": "elbow_coverage_for_quality_gap",
                "value": elbow_threshold(topo_df, "node_coverage", "quality_gap", direction="min")
            },
        ])

    threshold_candidates = pd.DataFrame(rows)

    return {
        "summary_by_iteration": summary,
        "threshold_candidates": threshold_candidates,
    }


def plot_thresholds(results, output_path="progressive/plot/threshold.png"):
    thresholds = results["threshold_candidates"].copy()
    thresholds["topology"] = thresholds["topology"].astype(str)

    thresholds = thresholds[
        ~thresholds["topology"].str.contains("hybrid", case=False, na=False)
    ].copy()

    keep = [
        "coverage_KT_gen_90",
        "quality_gap_20",
        "elbow_coverage_for_KT_gen",
        "elbow_coverage_for_quality_gap",
    ]

    rename_map = {
        "coverage_KT_gen_90": "KT-90",
        "quality_gap_20": "DeltaQual20",
        "elbow_coverage_for_KT_gen": "elboKT",
        "elbow_coverage_for_quality_gap": "elbowQual",
    }

    t = thresholds[thresholds["threshold_type"].isin(keep)].copy()

    if t.empty:
        fig, ax = plt.subplots(figsize=(13, 6), constrained_layout=True)
        ax.text(0.5, 0.5, "No threshold candidates", ha="center", va="center")
        ax.set_axis_off()
        fig.savefig(output_path, dpi=HEATMAP_DPI, bbox_inches="tight")
        plt.close(fig)
        return fig

    pivot = (
        t.pivot_table(
            index="topology",
            columns="threshold_type",
            values="value",
            aggfunc="median"
        )
        .reindex(columns=keep)
        .rename(columns=rename_map)
        .sort_index()
    )

    fig_height = max(6, 0.45 * len(pivot) + 2)
    fig, ax = plt.subplots(figsize=(13, fig_height), constrained_layout=True)

    sns.heatmap(
        pivot,
        ax=ax,
        annot=True,
        fmt=".3f",
        cmap=sns.color_palette("crest", as_cmap=True),
        linewidths=0.6,
        linecolor="white",
        cbar_kws={"label": "Threshold value"},
        xticklabels=True,
        yticklabels=True
    )

    ax.set_title("Threshold candidates by topology")
    ax.set_xlabel("")
    ax.set_ylabel("Topology")

    ax.set_yticks(np.arange(len(pivot.index)) + 0.5, labels=pivot.index.tolist())
    ax.set_xticklabels(ax.get_xticklabels(), rotation=0)
    ax.set_yticklabels(pivot.index.tolist(), rotation=0, va="center")

    short_label_colors = {
        "KT-90": "#000000",
        "elboKT": "#000000",
        "DeltaQual20": "#000000",
        "elbowQual": "#000000",
    }

    for label in ax.get_xticklabels():
        txt = label.get_text()
        if txt in short_label_colors:
            label.set_color(short_label_colors[txt])

    fig.savefig(output_path, dpi=HEATMAP_DPI, bbox_inches="tight")
    plt.close(fig)
    return fig

# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    csv_path = "progressive/data1/results_synthetic.csv"

    df = prepare_data(csv_path)
    ensure_pagerank_present(df)

    # Pareto matrix: one point per method
    plot_matrix_pareto(df, "progressive/plot/pareto_matrix.png")

    # Ranking by size
    ranked_size, best_size = rank_by_size(df)
    ranked_size.to_csv("method_ranking_by_size.csv", index=False)
    best_size.to_csv("best_method_by_size.csv", index=False)

    plot_rank_counts(
        best_size,
        "progressive/plot/ranking_by_size_counts.png",
        group_col="graph_size",
        method_col="best_method",
        title="Best sampling method by graph size",
        xlabel="Graph size"
    )

    plot_rank_scores(
        ranked_size,
        "progressive/plot/ranking_by_size_scores.png",
        group_col="graph_size",
        method_col="method",
        title="TOPSIS score by graph size",
        xlabel="Graph size"
    )

    # Ranking by topology
    ranked_topo, best_topo = rank_by_topology(df)
    ranked_topo.to_csv("method_ranking_by_topology.csv", index=False)
    best_topo.to_csv("best_method_by_topology.csv", index=False)

    plot_rank_counts(
        best_topo,
        "progressive/plot/ranking_by_topology_counts.png",
        group_col="topology",
        method_col="best_method",
        title="Best sampling method by topology",
        xlabel="Topology"
    )

    plot_rank_scores(
        ranked_topo,
        "progressive/plot/ranking_by_topology_scores.png",
        group_col="topology",
        method_col="method",
        title="TOPSIS score by topology",
        xlabel="Topology"
    )

    # Thresholds
    res = compute_thresholds(df)
    plot_thresholds(res, "progressive/plot/threshold.png")