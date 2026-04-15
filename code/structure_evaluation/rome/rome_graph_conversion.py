import re
import networkx as nx
import json
import os
import glob


def extract_number_from_id(id_str):
    # Use regular expression to find numbers in the string
    match = re.search(r'\d+', id_str)
    return int(match.group(0)) if match else id_str


def convert_graphml_to_json(graphml_file, json_file):
    G = nx.read_graphml(graphml_file)
    graph_data = {'nodes': [], 'links': []}

    for node in G.nodes(data=True):
        node_id = extract_number_from_id(node[0])
        graph_data['nodes'].append({'id': node_id, **node[1]})

    for edge in G.edges(data=True):
        source_id = extract_number_from_id(edge[0])
        target_id = extract_number_from_id(edge[1])

        # Check if edge has an 'id' attribute
        if 'id' in edge[2]:
            edge_id = int(extract_number_from_id(edge[2]['id']))
        else:
            # Generate a combined numerical ID if it doesn't have one
            edge_id = int(f"{source_id}{target_id}")

        graph_data['links'].append({
            'id': edge_id,
            'source': source_id,
            'target': target_id,
        })

    with open(json_file, 'w') as f:
        json.dump(graph_data, f, indent=4)


def process_directory(input_dir, output_dir):
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    num = 0
    # Find all GraphML files in the input directory
    for graphml_file in glob.glob(os.path.join(input_dir, '*.graphml')):
        # Derive JSON file name and path
        json_filename = os.path.splitext(os.path.basename(graphml_file))[0] + '.json'
        json_file = os.path.join(output_dir, json_filename)

        convert_graphml_to_json(graphml_file, json_file)
        if num % 1000 == 0: print(num)
        #print(f"Converted to {json_filename}")
        num += 1
    print(num)


if __name__ == "__main__":
    # convert_graphml_to_json('./grafo113.28.graphml', '../grafo113.28.json')
    process_directory('./original', './preprocessed')

