import glob
import json
import os
import time
from collections import deque

import networkx as nx
import numpy as np


def update_file(json_file, output_file, gansner=False, force_dir=False, barycenter=False, cuthill_mckee=False,
                netx_force_2d=False):
    with open(json_file, 'r') as file:
        data = json.load(file)

        if gansner:
            calculate_gansner(data)
        if force_dir:
            calculate_force_directed(data)
        if barycenter:
            calculate_barycenter(data)
        if cuthill_mckee:
            calculate_cuthill_mckee(data)
        if netx_force_2d:
            get_netX_force_ordering(data)

        # print(data['nodes'][0])

        with open(output_file, 'w') as f:
            json.dump(data, f, indent=4)


def calculate_gansner(data):
    import pygraphviz as pgv

    ids = [n['id'] for n in data['nodes']]
    dot = "graph {\n"
    for link in data['links']:
        dot += "{} -- {};\n".format(link['source'], link['target'])

    # same rank (for output as sequence)
    rank = "{rank = same; " + "; ".join(map(str, ids)) + "};"
    dot1 = dot + rank + "}"

    g1 = pgv.AGraph(dot1)
    g1.layout(prog="dot")

    positions1 = {}
    for n in g1.nodes():
        positions1[n] = float(n.attr['pos'].split(',')[0])

    # Extract positions
    order = sorted(positions1, key=lambda k: positions1[k])

    # Add to node as position index
    for node in data['nodes']:
        node['gansner_pos'] = order.index(str(node['id']))


# Function to calculate repulsive force
def calculate_repulsive_force(distance, force_const):
    return force_const / distance if distance != 0 else 0


# Function to calculate attractive force
def calculate_attractive_force(distance, force_const):
    return distance * force_const


def calculate_force_directed(data):
    nodes = [n['id'] for n in data['nodes']]
    edges = [[n['source'], n['target']] for n in data['links']]

    np.random.seed(42)
    positions = np.random.rand(len(nodes))

    # Parameters for the simulation
    repulsive_force_constant = 0.005
    attractive_force_constant = 0.0001
    num_iterations = 100

    # print(nodes)
    # print(edges)

    # Main loop for the simulation
    for _ in range(num_iterations):
        forces = np.zeros(len(nodes))

        # Apply repulsive forces to all pairwise node combinations
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                distance = positions[j] - positions[i]
                force = calculate_repulsive_force(abs(distance), repulsive_force_constant)
                if positions[i] < positions[j]:  # since its 1D we only need to know left or right
                    forces[i] -= force
                    forces[j] += force
                else:
                    forces[i] += force
                    forces[j] -= force

        # Apply attractive forces for nodes connected by edges
        for edge in edges:
            node1, node2 = edge
            distance = positions[node2] - positions[node1]
            force = calculate_attractive_force(distance, attractive_force_constant)
            if positions[node1] < positions[node2]:
                forces[node1] += force
                forces[node2] -= force
            else:
                forces[node1] -= force
                forces[node2] += force

        # Update positions based on net force
        positions += forces  # Still easier than using vectors :D

    # print(positions)
    # Determine the final ordering of nodes based on their positions
    ordering = np.argsort(positions)

    # print("Final ordering of nodes:", ordering)

    # Add to node as position index
    for index, node in enumerate(data['nodes']):
        node['force_direct_pos'] = int(ordering[index])
        # int() cast since numpys int64 is not Json serializable


def get_adjacency_list(data):
    # Construct the adjacency list from the edges
    edges = [[n['source'], n['target']] for n in data['links']]

    graph = {}
    for edge in edges:
        source, target = edge[0], edge[1]
        if source not in graph:
            graph[source] = []
        if target not in graph:
            graph[target] = []
        graph[source].append(target)
        graph[target].append(source)  # Assuming an undirected graph for simplicity

    return graph


def calculate_barycenter(data, min_spacing=0.01):
    graph = get_adjacency_list(data)

    # Initialize node positions randomly along the x-axis
    np.random.seed(42)
    positions = {node: np.random.rand() for node in graph}

    # Number of iterations for the layout algorithm to converge
    num_iterations = 100

    for _ in range(num_iterations):
        new_positions = {}
        for node, neighbors in graph.items():
            # Calculate the barycenter (mean position of neighbors)
            if neighbors:  # Avoid division by zero for isolated nodes
                new_positions[node] = np.mean([positions[neighbor] for neighbor in neighbors])
            else:
                new_positions[node] = positions[node]

                # Apply a minimum spacing between nodes
        ordered_nodes = sorted(new_positions, key=new_positions.get)
        for i, node in enumerate(ordered_nodes[1:], start=1):
            if new_positions[ordered_nodes[i]] - new_positions[ordered_nodes[i - 1]] < min_spacing:
                new_positions[ordered_nodes[i]] = new_positions[ordered_nodes[i - 1]] + min_spacing

        # Update positions
        positions = new_positions

    # The final positions represent a 1D barycenter layout
    # print("Final positions:", positions)

    # Ordering of nodes based on their final positions
    ordering = sorted(positions, key=positions.get)

    # Find missing indices by comparing all node indices to the keys in 'positions'
    missing_indices = set(range(len(data['nodes']))) - set(positions.keys())

    # Extend the ordering with missing indices
    # Convert 'missing_indices' to a list and sort if you need a specific order for these
    ordering.extend(sorted(list(missing_indices)))

    # print(len(ordering))

    for index, node in enumerate(data['nodes']):
        node['barycenter_pos'] = ordering[index]


def calculate_cuthill_mckee(data):
    adjacency_list = get_adjacency_list(data)

    def bfs(start):
        ordered = []
        queue = deque([start])
        visited.add(start)
        while queue:
            node = queue.popleft()
            ordered.append(node)
            for neighbor in sorted(adjacency_list[node], key=lambda x: len(adjacency_list[x])):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        return ordered

    ordering = []
    visited = set()

    # Process each disconnected component
    while len(visited) < len(adjacency_list):
        # Find the next start node (unvisited node with the smallest degree)
        unvisited = [node for node in adjacency_list if node not in visited]
        start_node = min(unvisited, key=lambda x: len(adjacency_list[x]))
        # Apply BFS to the current component
        ordering.extend(bfs(start_node))

    # Find missing indices by comparing all node indices to the keys in 'positions'
    missing_indices = set(range(len(data['nodes']))) - set(ordering)

    # Extend the ordering with missing indices
    # Convert 'missing_indices' to a list and sort if you need a specific order for these
    ordering.extend(sorted(list(missing_indices)))

    # print("Final ordering of nodes:", ordering)
    for index, node in enumerate(data['nodes']):
        node['cuthill_pos'] = int(ordering[index])


def get_netX_force_ordering(data):
    # with open(json_file, 'r') as file:
    #    data = json.load(file)
    # Create an empty graph
    graph = nx.Graph()

    # Add nodes with their IDs
    nodes = [x['id'] for x in data['nodes']]
    # nodes = [1, 2, 3, 4, 5]
    graph.add_nodes_from(nodes)

    # Add edges with source and target node IDs
    edges = [(x['source'], x['target']) for x in data['links']]
    # edges = [(1, 2), (2, 3), (3, 4), (4, 5), (1, 5), (2, 4)]
    graph.add_edges_from(edges)

    # TODO: add inital layout with 2D where the coordiantes are symmetric

    # Generate positions for each node using the Fruchterman-Reingold force-directed algorithm
    pos = nx.spring_layout(graph, dim=2)  # if you still don't believe me just change this to one and see the

    # exception in the exception to the ValueError!

    # same applies to the barycenter method they provide on a given (sub-)graph, the lowest is always 2D!

    # Function to calculate the projection onto the new axis (y = x)
    def projection_on_diagonal(node_pos):
        x, y = node_pos
        return (x + y) / 2  # Average of x and y coordinates, basically we want the new x value for a new coordinate
        # system positioned diagonally from the original. The average works here since the new axis follows y=x,
        # so y and x component of the new position contribute equally, thus we can use their sum / 2.
        # Any other angle would need to be computed by x*cos(θ) + y*sin(θ) (the new unit vector for x and y).

    # Sort the nodes based on their projection onto the new diagonal axis
    ordering = sorted(pos.keys(), key=lambda n: projection_on_diagonal(pos[n]))

    # print("1D Node Ordering:", ordering)

    for index, node in enumerate(data['nodes']):
        node['NetXForceFrom2D'] = int(ordering[index])


# with open(output_file, 'w') as f:
#    json.dump(data, f, indent=4)


def format_duration(seconds):
    if seconds < 60:
        # For durations less than a minute, display just seconds
        return f"{seconds:.2f} seconds"
    else:
        # For durations of a minute or more, display minutes and seconds
        minutes = int(seconds // 60)
        remaining_seconds = seconds % 60
        return f"{minutes} minutes and {remaining_seconds:.2f} seconds"


def process_directory(input_dir, output_dir):
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    start_time = time.time()

    num = 0
    # Find all GraphML files in the input directory
    for json_file in glob.glob(os.path.join(input_dir, '*.json')):
        # Derive JSON file name and path
        json_filename = os.path.splitext(os.path.basename(json_file))[0] + '.json'
        output_file = os.path.join(output_dir, json_filename)

        update_file(json_file, output_file, cuthill_mckee=True, gansner=True, force_dir=True, barycenter=True,
                    netx_force_2d=True)  # gansner=True, force_dir=True, barycenter=True
        # only run gansner when graphViz is installed otherwise it will crash!
        num += 1

        if num % 100 == 0:
            print(num)
            print(f"Took {format_duration(time.time() - start_time)}.")
        # print(f"Converted to {json_filename}")

    print(num)


if __name__ == "__main__":
    process_directory('./data2', './test')
    # process_directory('./test2', './data2')
