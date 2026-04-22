import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import math

def compute_rankings_per_topology(
    csv_path,
    quality_col="s_qualityAbs",
    weight_speed=0.5,
    weight_quality=0.5,
    epsilon=1e-8
):
    df = pd.read_csv(csv_path)

    # --- Extract topology ---
    df["topology"] = df["file"].str.split("_").str[0]

    # Sort
    df = df.sort_values(["topology", "sample", "method", "iteration"])

    # --- Quality error ---
    df["quality_error"] = (
        np.abs(df[quality_col] - df["s_qualityGT"]) /
        (np.abs(df["s_qualityGT"]) + epsilon)
    )

    # --- AUC computation ---
    def compute_auc(group):
        t = group["iteration"].values
        kt = group["KT_gen"].values
        err = group["quality_error"].values

        return pd.Series({
            "SpeedAUC": np.trapz(kt, t),
            "QualityAUC": np.trapz(err, t)
        })

    auc_df = (
        df.groupby(["topology", "sample", "method"])
        .apply(compute_auc)
        .reset_index()
    )

    # --- Normalize per (topology, sample) ---
    def normalize(group):
        for col in ["SpeedAUC", "QualityAUC"]:
            min_val = group[col].min()
            max_val = group[col].max()

            if max_val - min_val < 1e-12:
                group[col + "_norm"] = 1.0
            else:
                group[col + "_norm"] = 1 - (group[col] - min_val) / (max_val - min_val)

        return group

    auc_df = (
        auc_df.groupby(["topology", "sample"])
        .apply(normalize)
        .reset_index(drop=True)
    )

    # --- Final score ---
    auc_df["FinalScore"] = (
        weight_speed * auc_df["SpeedAUC_norm"] +
        weight_quality * auc_df["QualityAUC_norm"]
    )

    # --- Rank per (topology, sample) ---
    auc_df["Rank"] = (
        auc_df.groupby(["topology", "sample"])["FinalScore"]
        .rank(ascending=False, method="min")
    )

    # --- Aggregate per topology (final goal) ---
    topology_summary = (
        auc_df.groupby(["topology", "method"])
        .agg({
            "SpeedAUC": "mean",
            "QualityAUC": "mean",
            "FinalScore": "mean",
            "Rank": "mean"
        })
        .reset_index()
        .sort_values(["topology", "FinalScore"], ascending=[True, False])
    )

    return auc_df, topology_summary

def plot_matrix_pareto(
    topology_summary,
    save_path="progressive/plot/pareto_matrix.png",
    use_log=False,
    add_jitter=False
):
    topologies = sorted(topology_summary["topology"].unique())
    n = len(topologies)

    ncols = math.ceil(math.sqrt(n))
    nrows = math.ceil(n / ncols)

    fig, axes = plt.subplots(nrows, ncols, figsize=(5 * ncols, 5 * nrows))
    axes = axes.flatten()

    # --- Global limits (important for comparability) ---
    x = topology_summary["SpeedAUC"].values
    y = topology_summary["QualityAUC"].values

    eps = 1e-8
    x = np.clip(x, eps, None)
    y = np.clip(y, eps, None)

    x_min, x_max = x.min(), x.max()
    y_min, y_max = y.min(), y.max()

    x_pad = (x_max - x_min) * 0.1
    y_pad = (y_max - y_min) * 0.1

    for i, topo in enumerate(topologies):
        ax = axes[i]
        subset = topology_summary[topology_summary["topology"] == topo]

        xs = subset["SpeedAUC"].values
        ys = subset["QualityAUC"].values

        xs = np.clip(xs, eps, None)
        ys = np.clip(ys, eps, None)

        if add_jitter:
            jitter_scale_x = (x_max - x_min) * 0.01
            jitter_scale_y = (y_max - y_min) * 0.01
            xs = xs + np.random.uniform(-jitter_scale_x, jitter_scale_x, size=len(xs))
            ys = ys + np.random.uniform(-jitter_scale_y, jitter_scale_y, size=len(ys))

        # Grey points, slightly bigger
        ax.scatter(xs, ys, s=45, color="gray")

        # Offsets to reduce text overlap
        offsets = [(6, 6), (6, -6), (-6, 6), (-6, -6), (8, 0), (0, 8)]

        for j, (_, row) in enumerate(subset.iterrows()):
            dx, dy = offsets[j % len(offsets)]
            ax.annotate(
                row["method"],
                xy=(max(row["SpeedAUC"], eps), max(row["QualityAUC"], eps)),
                xytext=(dx, dy),
                textcoords="offset points",
                fontsize=11,
                color="black"
            )

        ax.set_title(topo)

        if use_log:
            ax.set_xscale("log")
            ax.set_yscale("log")

        ax.set_xlim(x_min - x_pad, x_max + x_pad)
        ax.set_ylim(y_min - y_pad, y_max + y_pad)

        ax.set_xlabel("SpeedAUC")
        ax.set_ylabel("QualityAUC")

    for j in range(i + 1, len(axes)):
        fig.delaxes(axes[j])

    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches="tight")
    plt.close(fig)

    print(f"Saved plot to: {save_path}")

if __name__ == "__main__":
    auc_df, topo_summary = compute_rankings_per_topology("progressive/data/results_synthetic.csv")

    print(topo_summary)
    plot_matrix_pareto(topo_summary, "progressive/plot/pareto_matrix.png")