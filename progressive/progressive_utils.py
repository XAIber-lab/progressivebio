import math, os, json, random
import numpy as np
import networkx as nx
from scipy.stats import kendalltau
from collections import Counter, defaultdict
from biofabric import assessQualityOfStairs

def compute_batch(nodes, edges, sample_n, method="degree"):
    format_edges=[]
    for e in edges:
        format_edges.append([e['source'],e['target']])
    G=nx.DiGraph(format_edges)
    
# Compute a scalar score per node for each method
    if method == "closeness":
        meth_cent = nx.closeness_centrality(G)
    elif method == "betweeness":
        meth_cent = nx.betweenness_centrality(G)
    elif method == "degree":
        meth_cent = nx.degree_centrality(G)
    elif method == "rmc":
        # RCM returns an ordering; use the inverse index as a score (later RCM → lower score)
        ug = G.to_undirected()
        rcm_order = list(nx.utils.reverse_cuthill_mckee_ordering(ug))  # RCM order [web:1][web:4]
        # Earlier in RCM list → higher score
        meth_cent = {n: len(rcm_order) - i for i, n in enumerate(rcm_order)}
    elif method == "random":
        # Random permutation as “scores”
        node_list = list(G.nodes())
        random.shuffle(node_list)
        meth_cent = {n: i for i, n in enumerate(node_list)}  # higher index = higher score
    elif method == "spectral":
        # Use spectral layout; score by first coordinate (higher x → higher score) [web:6][web:14]
        pos = nx.spectral_layout(G.to_undirected())
        meth_cent = {n: pos[n][0] for n in pos}
    else:
        # Fallback: degree
        meth_cent = nx.degree_centrality(G)

    sorted_n = dict(sorted(meth_cent.items(), key=lambda item: item[1], reverse=True))
    # sampled_nodes = dict(list(sorted_n.items())[:sample_n])
    
    considered_n=[]
    considered_e=[]
    for n in list(sorted_n.keys()):
        for e in edges:
            if (e["source"]==n or e["target"]==n) and (n not in considered_n):
                for b_e in list(nx.bfs_edges(G,n)):
                    if b_e not in considered_e:
                        considered_e.append(b_e)
        considered_n.append(n)
        
    batched_e = []
    for edge in considered_e:
        for e in edges:
            if e["source"]==edge[0] and e["target"]==edge[1]:
                batched_e.append(e)
    batched_e = batched_e[:sample_n]

    batched_n=[]
    for e2 in batched_e:
        for n in nodes:
            if (n["id"]==e2["source"] or n["id"]==e2["target"]) and (n not in batched_n):
                batched_n.append(n)
                
    return batched_n,batched_e

def kendall_tau_from_dicts(rank_a, rank_b):
    """
    Kendall's tau between two rankings when rank_b may be a subset of rank_a.
    Dict format: {node_id: position}
    """

    # Nodes present in BOTH rankings
    common_nodes = rank_a.keys() & rank_b.keys()

    if len(common_nodes) < 2:
        print("Need at least two common nodes to compute Kendall's tau.")
        return 0

    # Same order of items for both vectors
    common_nodes = sorted(common_nodes)

    a_positions = [rank_a[n] for n in common_nodes]
    b_positions = [rank_b[n] for n in common_nodes]

    tau, _ = kendalltau(a_positions, b_positions)
    return tau

def define_samples(n_edges, n_iterations):
    if n_edges < 0:
        raise ValueError("n_edges must be >= 0")
    if n_iterations <= 0:
        raise ValueError("n_iterations must be > 0")
    if n_edges == 0:
        return []

    k = min(n_iterations, n_edges)  # cannot have more strictly-increasing samples than edges
    # Evenly spaced cumulative sample sizes, rounded up with math.ceil (ceiling) [page:0]
    samples = [math.ceil((i + 1) * n_edges / k) for i in range(k)]
    if samples[len(samples)-1] == n_edges: return samples
    else: return samples+[n_edges]

# def generalized_stair_kendall_tau(rank_gt, stairs_gt, rank_cmp, stairs_cmp=None, min_common_nodes=2):
#     """
#     Generalized Kendall tau focusing on GT stairs.

#     Inputs
#     - rank_gt, rank_cmp: dict {node_id: position} (BioFabric node order)
#     - stairs_gt: list of stairs; each stair is a list of edges dicts with keys 'source','target'
#     - stairs_cmp: same format (optional). If provided, each GT stair is matched to the best CMP stair
#       with the same anchor node; scoring uses only the overlapping neighbor nodes.
#     - min_common_nodes: need at least 2 nodes to form pairs

#     Returns
#     - overall_tau: weighted mean across stairs (weights = #pairs in that stair), or None
#     - details: list of per-stair dicts
#     """

#     def anchor_and_neighbors(stair_edges):
#         # Robust anchor: node that appears most often among endpoints in the stair
#         c = Counter()
#         for e in stair_edges:
#             c[e["source"]] += 1
#             c[e["target"]] += 1
#         anchor = c.most_common(1)[0][0]

#         # Neighbor list in encounter order (unique, preserve order)
#         seen = set()
#         neigh = []
#         for e in stair_edges:
#             if e["source"] == anchor:
#                 other = e["target"]
#             elif e["target"] == anchor:
#                 other = e["source"]
#             else:
#                 continue
#             if other not in seen:
#                 neigh.append(other)
#                 seen.add(other)

#         return anchor, neigh

#     def tau_from_gt_order(gt_pos, cmp_pos, nodes_in_gt_order):
#         # keep only nodes that exist in both rankings
#         nodes = [u for u in nodes_in_gt_order if u in gt_pos and u in cmp_pos]
#         if len(nodes) < min_common_nodes:
#             return None, 0, 0

#         # nodes are already in GT stair order; measure inversions in candidate positions
#         seq = [cmp_pos[u] for u in nodes]
#         n = len(seq)
#         total_pairs = n * (n - 1) // 2
#         if total_pairs == 0:
#             return None, n, 0

#         inv = 0
#         for i in range(n):
#             for j in range(i + 1, n):
#                 if seq[i] > seq[j]:
#                     inv += 1

#         # tie-free tau-a: tau = 1 - 2 * (#discordant pairs) / C(n,2) [web:37]
#         tau = 1.0 - 2.0 * inv / total_pairs
#         return tau, n, total_pairs

#     # Index candidate stairs by anchor
#     cmp_index = {}
#     if stairs_cmp is not None:
#         for st in stairs_cmp:
#             a, neigh = anchor_and_neighbors(st)
#             cmp_index.setdefault(a, []).append(set(neigh))

#     details = []
#     weighted_sum = 0.0
#     weight_total = 0

#     for i, st_gt in enumerate(stairs_gt):
#         anchor, gt_neighbors = anchor_and_neighbors(st_gt)
#         gt_set = set(gt_neighbors)

#         matched = False
#         overlap_nodes = gt_neighbors

#         if stairs_cmp is not None:
#             cands = cmp_index.get(anchor, [])
#             if cands:
#                 # pick best by max overlap (tie-break: smaller union)
#                 best = None
#                 best_overlap = -1
#                 best_union = 10**18
#                 for s in cands:
#                     ov = len(gt_set & s)
#                     un = len(gt_set | s)
#                     if ov > best_overlap or (ov == best_overlap and un < best_union):
#                         best, best_overlap, best_union = s, ov, un

#                 matched = True
#                 overlap_set = gt_set & best
#                 overlap_nodes = [u for u in gt_neighbors if u in overlap_set]  # preserve GT stair order

#         tau, n_nodes, n_pairs = tau_from_gt_order(rank_gt, rank_cmp, overlap_nodes)

#         details.append({
#             "stair_index": i,
#             "anchor": anchor,
#             "gt_size": len(gt_set),
#             "cmp_matched": matched,
#             "overlap_size": len(overlap_nodes),
#             "scored_nodes": n_nodes,
#             "scored_pairs": n_pairs,
#             "tau": tau,
#         })

#         if tau is not None and n_pairs > 0:
#             weighted_sum += tau * n_pairs
#             weight_total += n_pairs

#     overall_tau = (weighted_sum / weight_total) if weight_total > 0 else None
#     return overall_tau, details

def generalized_stair_kendall_tau_clean(
    rank_gt, stairs_gt, rank_cmp, stairs_cmp,
    nodes_gt, edges_gt, nodes_cmp, edges_cmp,
    min_common_nodes=2,
):
    # --- your existing helper functions: anchor_and_neighbors, etc. ---
    def anchor_and_neighbors(stair_edges):
        c = Counter()
        for e in stair_edges:
            c[e["source"]] += 1
            c[e["target"]] += 1
        anchor = c.most_common(1)[0][0]
        seen = set()
        neigh = []
        for e in stair_edges:
            if e["source"] == anchor:
                other = e["target"]
            elif e["target"] == anchor:
                other = e["source"]
            else:
                continue
            if other not in seen:
                neigh.append(other)
                seen.add(other)
        return anchor, neigh

    def tau_from_gt_order(gt_pos, cmp_pos, nodes_in_gt_order):
        nodes = [u for u in nodes_in_gt_order if u in gt_pos and u in cmp_pos]
        if len(nodes) < min_common_nodes:
            return None, 0, 0
        seq = [cmp_pos[u] for u in nodes]
        n = len(seq)
        p = n * (n - 1) // 2
        if p == 0:
            return None, n, 0
        inv = sum(1 for i in range(n) for j in range(i + 1, n) if seq[i] > seq[j])
        return 1.0 - 2.0 * inv / p, n, p

    # --- your existing quality computation ---
    _, q_gt = assessQualityOfStairs(nodes_gt, edges_gt, stairs_gt)
    _, q_cmp = assessQualityOfStairs(nodes_cmp, edges_cmp, stairs_cmp)

    if len(stairs_gt) == 0 or len(stairs_cmp) == 0:
        return -0.5, [{"note": "Missing stairs"}]

    # GT stairs prep
    gt_stairs = []
    for i, (st, q_gt_i) in enumerate(zip(stairs_gt, q_gt)):
        anchor, neigh = anchor_and_neighbors(st)
        gt_stairs.append({"i": i, "anchor": anchor, "neigh": neigh, "q": q_gt_i})

    # CMP by anchor
    cmp_by_anchor = defaultdict(list)
    for j, (st, q_cmp_j) in enumerate(zip(stairs_cmp, q_cmp)):
        anchor, neigh = anchor_and_neighbors(st)
        cmp_by_anchor[anchor].append({"neigh": set(neigh), "q": q_cmp_j})

    # Aggregate
    details = []
    num = 0.0   # Weighted tau numerator
    den = 0.0   # Weighted pairs denominator

    for gs in gt_stairs:
        anchor = gs["anchor"]
        neigh_set = set(gs["neigh"])

        best_score = 0.0
        best_neigh = []
        for cm in cmp_by_anchor[anchor]:
            ov = len(neigh_set & cm["neigh"])
            score = cm["q"] * ov
            if score > best_score:
                best_score = score
                best_neigh = [u for u in gs["neigh"] if u in cm["neigh"]]

        q_factor = gs["q"] * best_score

        tau, n, pairs = tau_from_gt_order(rank_gt, rank_cmp, best_neigh)

        details.append({
            "gt_i": gs["i"], "anchor": anchor, "q_gt": gs["q"],
            "best_score_cmp": best_score, "q_factor": q_factor,
            "pairs": pairs, "tau": tau,
        })

        if tau is not None and pairs > 0:
            num += tau * q_factor * pairs
            den += q_factor * pairs

    # === Only this line changes: no stair_ratio / anchor_ratio penalties ===
    overall_tau = num / den if den > 0 else 0.0

    return overall_tau, details


def normalize_edge(edge):
    """Safe edge normalization."""
    try:
        src = edge['source']
        tgt = edge['target']
        return tuple(sorted([src, tgt]))
    except (KeyError, TypeError):
        return None  # Skip invalid

def stairs_to_edge_sets(stairs_list):
    """Bulletproof conversion."""
    if not stairs_list:
        return {}
    
    stairs_edges = {}
    for stair_id, stair_edges_list in enumerate(stairs_list):
        if not stair_edges_list:
            continue  # Skip empty lists
            
        edge_set = set()
        for edge in stair_edges_list:
            try:
                norm_edge = normalize_edge(edge)
                edge_set.add(norm_edge)
            except (KeyError, TypeError, AttributeError):
                continue  # Skip malformed edges
        
        if edge_set:  # Only store non-empty
            stairs_edges[stair_id] = edge_set
    
    return stairs_edges

def jaccard_edge_sets(setA, setB):
    """Jaccard between two edge sets."""
    intersection = len(setA & setB)
    union = len(setA | setB)
    return intersection / union if union > 0 else 0.0

def evaluate_stair_sets(gt_stairs_edges, det_stairs_edges):
    """100% robust evaluation - handles ALL empty cases."""
    
    num_gt_stairs = len(gt_stairs_edges)
    num_det_stairs = len(det_stairs_edges)
    
    # Early returns for empty cases
    if num_gt_stairs == 0:
        return {
            'mean_jaccard': 1.0 if num_det_stairs == 0 else 0.0,
            'gt_edge_coverage': 1.0,
            'edge_precision': 1.0 if num_det_stairs == 0 else 0.0,
            'edge_recall': 1.0,
            'edge_f1': 1.0,
            'per_stair_scores': {},
            'num_gt_stairs': 0,
            'num_det_stairs': num_det_stairs,
            'total_gt_edges': 0,
            'total_det_edges': sum(len(edges) for edges in det_stairs_edges.values()),
            'total_tp_edges': 0,
            'status': 'no_gt_stairs'
        }
    
    if num_det_stairs == 0:
        total_gt_edges = sum(len(edges) for edges in gt_stairs_edges.values() if edges)
        return {
            'mean_jaccard': 0.0,
            'gt_edge_coverage': 0.0,
            'edge_precision': 0.0,
            'edge_recall': 0.0,
            'edge_f1': 0.0,
            'per_stair_scores': {gt_id: 0.0 for gt_id in gt_stairs_edges},
            'num_gt_stairs': num_gt_stairs,
            'num_det_stairs': 0,
            'total_gt_edges': total_gt_edges,
            'total_det_edges': 0,
            'total_tp_edges': 0,
            'status': 'no_det_stairs'
        }
    
    # Normal case - both have stairs
    scores = {}
    total_tp_edges = 0
    total_gt_edges = 0
    
    for gt_id, gt_edges in gt_stairs_edges.items():
        if not gt_edges:  # Empty GT stair
            scores[gt_id] = 1.0
            continue
            
        total_gt_edges += len(gt_edges)
        
        # SAFE max with default
        det_edges_list = list(det_stairs_edges.values())
        if not det_edges_list:
            scores[gt_id] = 0.0
            continue
            
        best_det_edges = max(det_edges_list, 
                           key=lambda x: jaccard_edge_sets(gt_edges, x))
        jacc = jaccard_edge_sets(gt_edges, best_det_edges)
        scores[gt_id] = jacc
        total_tp_edges += len(gt_edges & best_det_edges)
    
    total_det_edges = sum(len(edges) for edges in det_stairs_edges.values())
    
    mean_jaccard = np.mean(list(scores.values()))
    gt_coverage = total_tp_edges / total_gt_edges if total_gt_edges > 0 else 0.0
    
    edge_precision = total_tp_edges / total_det_edges if total_det_edges > 0 else 0.0
    edge_recall = total_tp_edges / total_gt_edges if total_gt_edges > 0 else 0.0
    edge_f1 = (2 * edge_precision * edge_recall / (edge_precision + edge_recall) 
              if (edge_precision + edge_recall) > 0 else 0.0)
    
    return {
        'mean_jaccard': mean_jaccard,
        'gt_edge_coverage': gt_coverage,
        'edge_precision': edge_precision,
        'edge_recall': edge_recall,
        'edge_f1': edge_f1,
        'per_stair_scores': scores,
        'num_gt_stairs': num_gt_stairs,
        'num_det_stairs': num_det_stairs,
        'total_gt_edges': total_gt_edges,
        'total_det_edges': total_det_edges,
        'total_tp_edges': total_tp_edges,
        'status': 'normal'
    }




# -------------------------------------------------
# Utilities
# -------------------------------------------------
def _hybrid_union(G1, G2):
    G = nx.Graph()
    G.add_nodes_from(G1.nodes())
    G.add_edges_from(G1.edges())
    G.add_edges_from(G2.edges())
    return G


def _hybrid_bridge(G1, G2, bridges=5):
    G = nx.disjoint_union(G1, G2)
    n1 = len(G1)
    for _ in range(bridges):
        G.add_edge(random.randint(0, n1 - 1),
                   random.randint(n1, n1 + len(G2) - 1))
    return G

# -------------------------------------------------
# Topology Generator Per Size
# -------------------------------------------------

def generate_graphs_for_size(n):
    graphs = {}

    graphs["erdos_renyi"] = nx.erdos_renyi_graph(n, random.uniform(0.05, 0.2))
    graphs["barabasi_albert"] = nx.barabasi_albert_graph(
        n, random.randint(1, max(2, n // 20))
    )
    graphs["watts_strogatz"] = nx.watts_strogatz_graph(
        n, random.randint(2, min(10, n - 1)), random.uniform(0.1, 0.5)
    )
    graphs["random_regular"] = nx.random_regular_graph(
        random.randint(2, min(8, n - 1)), n
    )
    graphs["powerlaw_cluster"] = nx.powerlaw_cluster_graph(
        n, random.randint(1, 5), random.uniform(0.0, 0.5)
    )
    graphs["geometric"] = nx.random_geometric_graph(n, random.uniform(0.2, 0.4))

    graphs["path"] = nx.path_graph(n)                     # line
    graphs["ring"] = nx.cycle_graph(n)                    # ring
    if n >= 2:
        graphs["star"] = nx.star_graph(n - 1)             # n nodes total
    m = int(math.floor(math.sqrt(n)))
    k = max(1, n // max(1, m))
    graphs["mesh"] = nx.convert_node_labels_to_integers(
        nx.grid_2d_graph(m, k)
    )                                                     # 2D mesh
    graphs["complete"] = nx.complete_graph(n)
    if n > 1:
        r = random.randint(2, 4)
        h = max(1, int(math.log((n * (r - 1) + 1), r)) - 1)
        graphs["balanced_tree"] = nx.balanced_tree(r, h)

    blocks = random.randint(2, min(5, max(2, n // 5)))
    sizes = [n // blocks] * blocks
    for i in range(n - sum(sizes)):
        sizes[i] += 1
    probs = [[0.0] * blocks for _ in range(blocks)]
    for i in range(blocks):
        for j in range(i, blocks):
            p = random.uniform(0.01, 0.3)
            probs[i][j] = p
            probs[j][i] = p
    graphs["stochastic_block"] = nx.stochastic_block_model(sizes, probs)
    
    n1 = n // 2
    n2 = n - n1
    if n1 >= 1 and n2 >= 1:
        # 1. Random bipartite (bipartite ER)
        p_bipartite = random.uniform(0.05, 0.2)
        B = nx.bipartite.random_graph(n1, n2, p_bipartite)
        # re‑label to 0–(n-1) for consistency with other graphs
        mapping = dict(zip(B.nodes, range(n)))
        B = nx.relabel_nodes(B, mapping)
        graphs["bipartite_random"] = B

        # 2. Complete bipartite K_{n1,n2}
        K = nx.complete_bipartite_graph(n1, n2)
        mapping = dict(zip(K.nodes, range(n)))
        K = nx.relabel_nodes(K, mapping)
        graphs["bipartite_complete"] = K

    graphs["hybrid_union_ER_BA"] = _hybrid_union(
        graphs["erdos_renyi"], graphs["barabasi_albert"]
    )
    graphs["hybrid_union_WS_SBM"] = _hybrid_union(
        graphs["watts_strogatz"], graphs["stochastic_block"]
    )
    graphs["hybrid_bridge_BA_WS"] = _hybrid_bridge(
        graphs["barabasi_albert"], graphs["watts_strogatz"]
    )
    graphs["hybrid_spatial_SF"] = _hybrid_union(
        graphs["geometric"], graphs["barabasi_albert"]
    )

    if "star" in graphs and "ring" in graphs:
        graphs["hybrid_star_ring"] = _hybrid_union(
            graphs["star"], graphs["ring"]
        )

    graphs["hybrid_ring_mesh"] = _hybrid_union(
        graphs["ring"], graphs["mesh"]
    )

    if "star" in graphs:
        graphs["hybrid_star_mesh"] = _hybrid_union(
            graphs["star"], graphs["mesh"]
        )

    graphs["hybrid_path_ER"] = _hybrid_union(
        graphs["path"],
        nx.erdos_renyi_graph(n, random.uniform(0.05, 0.2))
    )

    graphs["hybrid_complete_noisy"] = _hybrid_union(
        graphs["complete"],
        nx.erdos_renyi_graph(n, random.uniform(0.01, 0.05))
    )

    if "star" in graphs:
        graphs["hybrid_WS_star"] = _hybrid_union(
            graphs["watts_strogatz"], graphs["star"]
        )

    graphs["hybrid_BA_ring"] = _hybrid_union(
        graphs["barabasi_albert"], graphs["ring"]
    )

    graphs["hybrid_SBM_mesh"] = _hybrid_union(
        graphs["stochastic_block"], graphs["mesh"]
    )

    return graphs

# -------------------------------------------------
# Node Ordering
# -------------------------------------------------

def order_from_layout(pos_dict):
    return {node: rank for rank, node in enumerate(sorted(pos_dict, key=lambda n: pos_dict[n][0]))}


def compute_node_orders(G):
    G = nx.convert_node_labels_to_integers(G)

    spectral = order_from_layout(nx.spectral_layout(G))
    spring = order_from_layout(nx.spring_layout(G, seed=42))

    bary = {}
    for n in G.nodes():
        neigh = list(G.neighbors(n))
        bary[n] = np.mean(neigh) if neigh else n
    bary = {n: i for i, n in enumerate(sorted(bary, key=bary.get))}

    rcm_order = list(nx.utils.reverse_cuthill_mckee_ordering(G))
    cuthill = {node: i for i, node in enumerate(rcm_order)}

    return spectral, spring, bary, cuthill


# -------------------------------------------------
# DATASET FACTORY
# -------------------------------------------------

def export_graph_dataset(folder_path, sizes=(10, 100, 200), seed=None):
    if seed is not None:
        random.seed(seed)
        np.random.seed(seed)

    os.makedirs(folder_path, exist_ok=True)

    for n in sizes:
        graphs = generate_graphs_for_size(n)

        for topo_name, G in graphs.items():
            G = nx.convert_node_labels_to_integers(G)
            spectral, spring, bary, cuthill = compute_node_orders(G)

            nodes_json = [{
                "id": int(node),
            } for node in G.nodes()]

            links_json = [{
                "id": int(i),
                "source": int(u),
                "target": int(v)
            } for i, (u, v) in enumerate(G.edges())]

            data = {"nodes": nodes_json, "links": links_json}

            filename = f"{topo_name}_N{G.number_of_nodes()}_E{G.number_of_edges()}.json"
            with open(os.path.join(folder_path, filename), "w") as f:
                json.dump(data, f, indent=2)

    print(f"Dataset generated in '{folder_path}'")
    
if __name__=="__main__":
    folder_graphs = "progressive/synthetic_graphs/"
    # os.makedirs(folder_graphs, exist_ok=True)
    # export_graph_dataset(folder_graphs, seed=42)

    with open(folder_graphs+"complete_N10_E45.json", "r") as f:
        data = json.load(f)

    nodes = data.get("nodes", [])
    edges = data.get("links", [])
    
    print(nodes)
    print("-----------")
    batch_nodes, batch_edges = compute_batch(nodes, edges, 15, "rmc")
    print(batch_nodes)