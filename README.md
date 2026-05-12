# Weaving (Bio)fabric: A Benchmark for Scalability through Progressive Sampling Methods

## Abstract
Network data is widely used to represent complex systems across domains, enabling the discovery of structural patterns and relationships. 
However, as graphs grow in size, visualizing them effectively becomes increasingly challenging. 
BioFabric offers a compact representation in which nodes are drawn as horizontal lines and edges as vertical lines, eliminating edge crossings by construction and supporting the identification of meaningful patterns such as staircases. 
Despite these advantages, the readability of BioFabric layouts depends critically on the ordering of nodes and edges, making both computation and visualization difficult to scale.

To address these challenges, we explore progressive visualization, a paradigm that allows users to inspect partial results while data processing is still ongoing. 
Applying progressive visualization to BioFabric introduces a key difficulty: intermediate layouts may contain correct subsets of the data yet remain visually misleading if their ordering diverges significantly from the final layout.
We frame this problem as one of ordering convergence to investigate how different sampling strategies affect the evolution of the layout. 
Specifically, we evaluate how quickly intermediate visualizations approximate the final BioFabric ordering using measures such as Kendall-$\tau$, and analyze the impact of progressive computation on the emergence of recognizable patterns, such as staircases.
Our results provide a first characterization of how graph topology and progressive data chunking strategies influence convergence and layout accuracy. 
Based on these findings, we offer guidance for designing progressive BioFabric systems that become informative and readable well before the full graph is available.

---

## System Overview

ProgressiveBio is typically structured into the following components:

- **Data Loader** — put your graph dataset in the ```data``` folder
- **progressive_utils** — executes computations incrementally
- **biofabric** — plug-in components for biofabric-specific tasks
- **Benchmark results** — updates results with ```plot_stats_cmp``` (comapares different datasets) ```plot_stats_single``` (shows results for one single dataset) ```analytics``` (analyzes trade-off and thresholds)
- **Interface** — enables integration with scripts and static visualization in the ```visualization``` folder

---

## Installation

Clone the repository:

```bash
git clone https://github.com/XAIber-lab/progressivebio.git
cd progressivebio
```

Adjust the graph dataset you want to benchmark in the ```data``` folder

Run the benchmark:

```bash
python main.py
```

Plot results and analytics:
```bash
python plot_stats_cmp.py
python analytics.py
```

View progressive partial results of selected graphs in the ```visualization``` frontend.
