import json
import os
import networkx as nx

root = os.path.dirname(__file__)
path = os.path.join(root, '')

for file in os.listdir(os.fsencode(path)):
    filename = os.fsdecode(file)
    if filename.endswith('.graphml'):
        print(filename)
        g = nx.read_graphml(filename)
        json.dump(nx.json_graph.node_link_data(g), open(os.path.join(path, filename[:-8] + '.json'), 'w'), indent=4)