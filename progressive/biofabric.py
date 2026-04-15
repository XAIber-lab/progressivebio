import json
import networkx as nx
from copy import deepcopy

"""
Sorts `nodes` in-place by degree (descending), where degree is the number
of edges incident to the node.
nodes: list[dict]  with at least {"id": ...}
edges: list[dict]  with at least {"source": ..., "target": ...}
"""
def sort_by_degree(nodes, edges):
    # Compute degrees
    deg = {n["id"]: 0 for n in nodes}
    for e in edges:
        s, t = e["source"], e["target"]
        if s in deg:
            deg[s] += 1
        if t in deg:
            deg[t] += 1

    # Sort by degree descending (like the JS comparator)
    nodes.sort(key=lambda n: deg.get(n["id"], 0), reverse=True)
    return nodes


"""
Parameters
----------
nodes : list[dict]  # each dict has at least {"id": ...}
edges : list[dict]  # each dict has at least {"source": ..., "target": ...}
sort_by_degree : callable(sorted_nodes, edges) -> None
    A function that sorts `sorted_nodes` in-place by degree (your existing logic).

Notes
-----
This function sorts `edges` in-place, like the JS version.
"""
def sort_for_staircases(nodes, edges):
    # node ordering already applied at this step
    ordered = [n["id"] for n in nodes]
    ordered_pos = {node_id: i for i, node_id in enumerate(ordered)}

    # get ordering on degree
    sorted_nodes = deepcopy(nodes)
    sort_by_degree(sorted_nodes, edges)
    degrees = [n["id"] for n in sorted_nodes]
    degree_pos = {node_id: i for i, node_id in enumerate(degrees)}

    def edge_sort_key(e):
        s, t = e["source"], e["target"]

        # pick the endpoint that appears earlier in the degree ordering
        if degree_pos[s] < degree_pos[t]:
            node, other = s, t
        else:
            node, other = t, s

        degree_rank = degree_pos[node]
        length = ordered_pos[other] - ordered_pos[node]

        # primary: degree rank; secondary: edge length
        return (degree_rank, length)

    edges.sort(key=edge_sort_key)
    return edges

# -----------------------------
# BioFabric generation
# -----------------------------
def generate_biofabric(nodes, edges):
    """
    Returns:
      node_rows: {node_id -> row_index}
      edge_columns: {edge_id -> column_index}
      fabric_edges: list of (edge_id, source_row, target_row, column)
    """
    
    G = nx.DiGraph()
    G.add_nodes_from(
        (n["id"], {k: v for k, v in n.items() if k != "id"})
        for n in nodes
    )
    G.add_edges_from(
        (e["source"], e["target"],
        {k: v for k, v in e.items() if k not in ("source", "target")})
        for e in edges
    )

    # Node → horizontal row assignment (by degree)
    degrees = dict(G.degree())
    nodes.sort(key=lambda node: (-degrees[node["id"]], str(node["id"])))
    node_rows = {n["id"]: i for i, n in enumerate(nodes)}

    # Edge → vertical column assignment
    ordered_edges = sort_for_staircases(nodes, deepcopy(edges))
    edge_columns = {e["id"]: i for i, e in enumerate(ordered_edges)}

    # BioFabric edge geometry
    fabric_edges = []
    for e in ordered_edges:
        fabric_edges.append(
            {
                "edge_id": e["id"],
                "column": edge_columns[e["id"]],
                "source_row": node_rows[e["source"]],
                "target_row": node_rows[e["target"]],
            }
        )

    return node_rows, edge_columns, fabric_edges

def print_biofabric(nodes, fabric_edges):
    n_rows = len(nodes)
    n_cols = max(e["column"] for e in fabric_edges) + 1

    canvas = [["─" for _ in range(n_cols)] for _ in range(n_rows)]

    for e in fabric_edges:
        c = e["column"]
        r1, r2 = sorted([e["source_row"], e["target_row"]])

        for r in range(r1, r2 + 1):
            canvas[r][c] = "│"

        canvas[r1][c] = "┼"
        canvas[r2][c] = "┼"

    print("     ", end="")
    for c in range(n_cols):
        print(f"{c:2}", end=" ")
    print("\n     " + "───" * n_cols)

    for r, node in enumerate(nodes):
        print(f"{node['id']:>3} │", end=" ")
        for c in range(n_cols):
            print(canvas[r][c], end="  ")
        print()
    
def format_biofabric_for_detect_staircases(node_rows, fabric_edges):
    """
    Runs generate_biofabric(...) and returns (nodes_out, edges_out) ready for detect_staircases.

    Output format:
      nodes_out: [{"id": node_id}, ...] ordered by BioFabric row index
      edges_out: [{"id": edge_id, "source": node_id, "target": node_id}, ...] ordered by BioFabric column index
    """
    # node_rows, edge_columns, fabric_edges = generate_biofabric(nodes, edges)

    # 1) Nodes: sorted by row index
    nodes_out = [{"id": node_id} for node_id, row in sorted(node_rows.items(), key=lambda kv: kv[1])]  # sort by value [web:50]

    # 2) Edges: sorted by column index, convert source_row/target_row back to node ids
    row_to_node = {row: node_id for node_id, row in node_rows.items()}

    edges_out = []
    for fe in sorted(fabric_edges, key=lambda d: d["column"]):
        edges_out.append({
            "id": fe["edge_id"],
            "source": row_to_node[fe["source_row"]],
            "target": row_to_node[fe["target_row"]],
        })

    return nodes_out, edges_out

def detect_stairs(nodes, edges):
    # Expects globals (as in your JS): shortestStair, distanceStairs
    what_is_a_stair = 3
    delta = 10

    order = {}
    for i, d in enumerate(nodes):
        order[d["id"]] = i

    fixed = None
    direction = None
    end = False

    previous = None

    stairs = []
    current = []

    for d in edges:
        if fixed is not None:  # check further stair
            if fixed == d["source"]:
                diff = order[d["target"]] - order[previous["target"]]
                cross = order[d["target"]] - order[previous["source"]]

                if direction == "increasing" and diff > 0 and diff <= delta:  # same upper node, increasing
                    current.append(d)
                elif direction == "decreasing" and diff < 0 and abs(diff) <= delta:  # same upper node, decreasing
                    current.append(d)
                elif fixed == previous["target"] and direction == "decreasing" and cross > 0 and cross <= delta:  # switch
                    direction = "increasing"
                    current.append(d)
                elif len(current) >= what_is_a_stair:  # end of stair
                    stairs.append(current)
                    current = []
                    fixed = None
                else:  # no stair
                    current = []
                    fixed = None

            elif fixed == d["target"]:
                diff = order[d["source"]] - order[previous["source"]]
                cross = order[d["source"]] - order[previous["target"]]

                if direction == "increasing" and diff < 0 and abs(diff) <= delta:  # same lower node, increasing
                    current.append(d)
                elif direction == "decreasing" and diff > 0 and diff <= delta:  # same lower node, decreasing
                    current.append(d)
                elif fixed == previous["source"] and direction == "decreasing" and cross < 0 and abs(cross) <= delta:  # switch
                    direction = "increasing"
                    current.append(d)
                elif len(current) >= what_is_a_stair:  # end of stair
                    stairs.append(current)
                    current = []
                    fixed = None
                else:  # no stair
                    current = []
                    fixed = None

            elif len(current) >= what_is_a_stair:  # end of stair
                stairs.append(current)
                current = []
                fixed = None
                end = True
            else:  # no stair
                current = []
                fixed = None

        if fixed is None and previous is not None and not end:  # new stair possible
            current.append(previous)

            if previous["source"] == d["source"]:
                fixed = previous["source"]
                diff = order[d["target"]] - order[previous["target"]]

                if diff > 0 and diff <= delta:  # same upper node, increasing
                    direction = "increasing"
                    current.append(d)
                elif diff < 0 and abs(diff) <= delta:  # same upper node, decreasing
                    direction = "decreasing"
                    current.append(d)
                else:  # no stair
                    current = []
                    fixed = None

            elif previous["target"] == d["target"]:
                fixed = previous["target"]
                diff = order[d["source"]] - order[previous["source"]]

                if diff < 0 and abs(diff) <= delta:  # same lower node, increasing
                    direction = "increasing"
                    current.append(d)
                elif diff > 0 and diff <= delta:  # same lower node, decreasing
                    direction = "decreasing"
                    current.append(d)
                else:  # no stair
                    current = []
                    fixed = None

            elif previous["source"] == d["target"]:
                fixed = previous["source"]
                cross = order[d["source"]] - order[previous["target"]]

                if cross < 0 and abs(cross) <= delta:  # switch
                    direction = "increasing"
                    current.append(d)
                else:  # no stair
                    current = []
                    fixed = None

            elif previous["target"] == d["source"]:
                fixed = previous["target"]
                cross = order[d["target"]] - order[previous["source"]]

                if cross > 0 and cross <= delta:  # switch
                    direction = "increasing"
                    current.append(d)
                else:  # no stair
                    current = []
                    fixed = None
            else:
                current = []

        end = False
        previous = d

    if len(current) >= what_is_a_stair:  # end of stair
        stairs.append(current)

    return stairs

def assessQualityOfStairs(nodes, edges, stairs):
    if len(stairs) == 0:
        return [0, ""]

    # --- equivalent of getDegrees(nodes, edges) ---
    degrees = {n["id"]: 0 for n in nodes}
    for e in edges:
        degrees[e["source"]] += 1
        degrees[e["target"]] += 1
    # ----------------------------------------------

    total_sum = 0
    centers = []
    individual = []

    for stair in stairs:
        # get involved nodes
        involved = []
        for link in stair:
            involved.extend([link["source"], link["target"]])

        # sort by frequency (ascending like JS)
        involved.sort(key=lambda x: involved.count(x))

        center = involved.pop()
        centers.append(center)

        # coverage ratio
        total_sum += len(stair) / degrees[center]

        # missed adjacent edges for this center
        missed_individual = [
            d for d in edges
            if (center == d["source"] or center == d["target"])
            and not any(
                item["source"] == d["source"] and item["target"] == d["target"]
                for item in stair
            )
        ]

        individual.append(
            len(stair) / degrees[center] / (1 + len(missed_individual))
        )

    # get all steps flattened
    all_steps = [item for stair in stairs for item in stair]

    # global missed edges
    missed = [
        d for d in edges
        if not any(
            item["source"] == d["source"] and item["target"] == d["target"]
            for item in all_steps
        )
        and any(x == d["source"] or x == d["target"] for x in centers)
    ]

    return [total_sum / len(stairs) / (1 + len(missed)), individual]



if __name__ == "__main__":
    # filename = "prototype\data\grafo2700.25.json"
    filename = "progressive\\rome_benchmark\\grafo113.28.json"
    with open(filename, "r") as f:
        data = json.load(f)
    nodes = data["nodes"]
    edges = data["links"]
    for i, e in enumerate(edges):
        e["id"] = i
    
    node_rows, edge_columns, fabric_edges = generate_biofabric(nodes, edges)
    node_srt, edges_srt = format_biofabric_for_detect_staircases(node_rows, fabric_edges)
    print_biofabric(node_srt,fabric_edges)
    
    stairs = detect_stairs(node_srt,edges_srt)
    print(stairs)
    quality = assessQualityOfStairs(nodes,edges,stairs)
    print(quality[0])