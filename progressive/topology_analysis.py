import json
import networkx as nx
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt
from collections import Counter

def load_graph_from_json(json_file):
    """Load undirected simple graph from JSON file."""
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    G = nx.Graph()
    G.add_nodes_from(node['id'] for node in data['nodes'])
    G.add_edges_from((link['source'], link['target']) for link in data['links'])
    
    return G

def compute_graph_features(G):
    """Compute key topological features."""
    n = len(G)
    m = G.number_of_edges()
    avg_deg = 2 * m / n if n > 0 else 0
    
    degrees = [d for _, d in G.degree()]
    deg_dist = np.array(degrees) / avg_deg if avg_deg > 0 else degrees
    cc = nx.average_clustering(G)
    pl = nx.average_shortest_path_length(G) if nx.is_connected(G) else float('inf')
    
    max_cc = nx.average_clustering(nx.star_graph(n-1)) if n > 1 else 0
    min_pl = nx.average_shortest_path_length(nx.complete_graph(n)) if n > 1 else 0
    
    return {
        'n': n,
        'avg_degree': avg_deg,
        'cc': cc / max_cc if max_cc > 0 else 0,  # Normalized clustering
        'pl': pl / n if pl < float('inf') else 1.0,  # Normalized path length
        'deg_cc': np.corrcoef(degrees, [nx.clustering(G, n) for n in G.nodes()])[0,1] if len(set(degrees)) > 1 else 0,
        'deg_dist_ks_poisson': stats.kstest(degrees, 'poisson', args=(avg_deg,)).statistic if avg_deg > 0 else 1.0,
        'deg_dist_var': np.var(degrees) / (avg_deg**2) if avg_deg > 0 else 0,
        'is_regular': len(set(degrees)) == 1,
        'max_deg_ratio': max(degrees) / avg_deg if avg_deg > 0 else 0,
        'diameter': nx.diameter(G) if nx.is_connected(G) else float('inf')
    }

MODEL_SIGNATURES = {
    'erdos_renyi': {'cc': 0.0, 'pl': 0.1, 'deg_var': 1.0, 'max_deg': 1.5, 'ks_poisson': 0.05},
    'barabasi_albert': {'cc': 0.0, 'pl': 0.2, 'deg_var': 5.0, 'max_deg': 10.0, 'ks_poisson': 0.8},
    'watts_strogatz': {'cc': 0.8, 'pl': 0.1, 'deg_var': 0.1, 'max_deg': 1.2, 'ks_poisson': 0.9},
    'random_regular': {'cc': 0.0, 'pl': 0.3, 'deg_var': 0.0, 'max_deg': 1.0, 'ks_poisson': 1.0},
    'powerlaw_cluster': {'cc': 0.5, 'pl': 0.4, 'deg_var': 4.0, 'max_deg': 8.0, 'ks_poisson': 0.7},
    'geometric': {'cc': 0.3, 'pl': 0.4, 'deg_var': 0.5, 'max_deg': 2.0, 'ks_poisson': 0.3},
    'path': {'cc': 0.0, 'pl': 0.8, 'deg_var': 0.3, 'max_deg': 2.0, 'ks_poisson': 0.6},
    'ring': {'cc': 0.0, 'pl': 0.5, 'deg_var': 0.0, 'max_deg': 1.0, 'ks_poisson': 1.0},
    'star': {'cc': 0.0, 'pl': 0.0, 'deg_var': 10.0, 'max_deg': 50.0, 'ks_poisson': 1.0},
    'mesh': {'cc': 0.4, 'pl': 0.6, 'deg_var': 0.2, 'max_deg': 1.5, 'ks_poisson': 0.4},
    'complete': {'cc': 1.0, 'pl': 0.0, 'deg_var': 0.0, 'max_deg': 1.0, 'ks_poisson': 1.0},
    'balanced_tree': {'cc': 0.0, 'pl': 0.7, 'deg_var': 2.0, 'max_deg': 3.0, 'ks_poisson': 0.5},
    'stochastic_block': {'cc': 0.3, 'pl': 0.3, 'deg_var': 1.5, 'max_deg': 3.0, 'ks_poisson': 0.2}
}

def classify_topology(G):
    """Classify graph topology using multiple features."""
    features = compute_graph_features(G)
    
    scores = {}
    for model, sig in MODEL_SIGNATURES.items():
        score = 0.0
        
        # Clustering coefficient match
        score += 1.0 - abs(features['cc'] - sig['cc'])
        
        # Path length match  
        score += 1.0 - abs(features['pl'] - sig['pl'])
        
        # Degree variance match
        score += 1.0 - abs(np.log1p(features['deg_dist_var']) - np.log1p(sig['deg_var'])) / 3
        
        # Max degree ratio
        score += 1.0 - abs(np.log1p(features['max_deg_ratio']) - np.log1p(sig['max_deg'])) / 3
        
        # KS to Poisson (lower better for ER)
        score += 1.0 - features['deg_dist_ks_poisson'] * 2 if model == 'erdos_renyi' else features['deg_dist_ks_poisson']
        
        # Regularity bonus
        if features['is_regular'] and model in ['random_regular', 'ring', 'complete']:
            score += 0.5
        
        # High star bonus
        if features['max_deg_ratio'] > 10:
            score += 0.8 if model == 'star' else -0.3
        
        scores[model] = score / 7.0  # Normalize
    
    best_model = max(scores, key=scores.get)
    similarity = scores[best_model]
    
    return best_model, similarity, scores

def get_topology(json_file):
    G = load_graph_from_json(json_file)
    model, sim, all_scores = classify_topology(G)
    
    # print(f"Most similar distribution: **{model}**")
    # print(f"Similarity measure: {sim:.3f} (higher = better, max=1.0)")
    # print("\nAll scores:")
    # for m, s in sorted(all_scores.items(), key=lambda x: x[1], reverse=True):
    #     print(f"  {m}: {s:.3f}")
    # print(f"Graph classified as {model} (sim={sim:.2f})")
    return model, sim


if __name__ == "__main__":
    get_topology("progressive/synthetic_graphs/complete_N50_E1225.json")
