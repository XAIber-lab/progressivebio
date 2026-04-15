# This file generates random data and saves it to a .json file.

import networkx as nx
from names import get_first_name
from random import choice
import json


def generate_data(filename, num_nodes, density):
    """
    This function generates random network data base on the given properties and writes it to the given file.
    The network data is returned.
    :param filename: file to write
    :param num_nodes: number of nodes
    :param density: density of the network
    :return: network data
    """

    num_edges = int(num_nodes * (num_nodes - 1) * density)
    g = nx.gnm_random_graph(num_nodes, num_edges)

    names = []
    for n in g:
        name = get_first_name()
        while name in names or len(name) > 7:
            name = get_first_name()
        names.append(name)

        g.nodes[n]['name'] = name
        g.nodes[n]['attributes'] = {}

    weights = [round(i * 0.2, 1) for i in range(6)]
    for u, v in g.edges:
        g[u][v]['attributes'] = {'Years of Friendship': choice(weights), 'Distance': choice(weights),
                                 'Interactions per Week': choice(weights), 'Common Hobbies': choice(weights)}

    # write json formatted data
    data = nx.json_graph.node_link_data(g)
    data['rcm'] = list(nx.utils.reverse_cuthill_mckee_ordering(g))
    json.dump(data, open(filename, 'w'), indent=4)

    return {'nodes': data['nodes'], 'links': data['links']}


generate_data('example.json', 10, 0.1)
