# This file generates random data and saves it to a .json file.

import itertools
from random import randint, choice, sample
import networkx as nx
import json
import string

node_names = list(string.ascii_uppercase) + [s + "'" for s in string.ascii_uppercase] \
            + [s + "''" for s in string.ascii_uppercase] + [s + "'''" for s in string.ascii_uppercase] \
            + [s + "''''" for s in string.ascii_uppercase]


def generate_data(filename, num_nodes, num_node_attr, all_node_attr, density, num_edge_attr, all_edge_attr):
    """
    This function generates random network data base on the given properties and writes it to the given file.
    The network data is returned.
    :param filename: file to write
    :param num_nodes: number of nodes
    :param num_node_attr: number of overall node attributes
    :param all_node_attr: boolean value whether each node contains all attributes
    :param density: density of the network
    :param num_edge_attr: number of overall edge attributes
    :param all_edge_attr:boolean value whether each edge contains all attributes
    :return: network data
    """

    num_edges = int(num_nodes * (num_nodes - 1) * density)
    g = nx.gnm_random_graph(num_nodes, num_edges)

    weights = [round(i * 0.2, 1) for i in range(6)]
    if num_nodes > len(node_names):
        names = list(range(0, 300))
    else:
        names = node_names

    for n in g:
        g.nodes[n]["name"] = names[n]

        attributes = {}
        for j in range(1, num_node_attr + 1):
            if all_node_attr or randint(0, 1) == 1:
                attributes['Attribute {}'.format(j)] = choice(weights)
        g.nodes[n]["attributes"] = attributes

    for u, v in g.edges:
        attributes = {}
        for j in range(1, num_edge_attr + 1):
            if all_edge_attr or randint(0, 1) == 1:
                attributes['Attribute {}'.format(j)] = choice(weights)
        g[u][v]["attributes"] = attributes

    # write json formatted data
    data = nx.json_graph.node_link_data(g)
    data['rcm'] = list(nx.utils.reverse_cuthill_mckee_ordering(g))
    json.dump(data, open(filename, "w"), indent=4)

    return {'nodes': data["nodes"], 'links': data["links"]}


def generate_layered_data(filename, num_nodes, num_node_attr, all_node_attr, density, num_edge_attr, all_edge_attr, num_layers):
    """
    This function generates layered random network data base on the given properties and writes it to the given file.
    The network data is returned.
    :param filename: file to write
    :param num_nodes: number of nodes
    :param num_node_attr: number of overall node attributes
    :param all_node_attr: boolean value whether each node contains all attributes
    :param density: density of the network
    :param num_edge_attr: number of overall edge attributes
    :param all_edge_attr:boolean value whether each edge contains all attributes
    :param num_layers: number of layers
    :return: network data
    """

    num_edges = int(num_nodes * (num_nodes - 1) * density)
    full, extra = divmod(num_nodes, num_layers)
    subset_sizes = [full + (i < extra) for i in range(num_layers)]

    def multilayered_graph(*subset_sizes):
        extents = nx.utils.pairwise(itertools.accumulate((0,) + subset_sizes))
        layers = [range(start, end) for start, end in extents]
        g = nx.Graph()
        for (i, layer) in enumerate(layers):
            g.add_nodes_from(layer, layer=i)
        for layer1, layer2 in nx.utils.pairwise(layers):
            g.add_edges_from(sample(list(itertools.product(layer1, layer2)), num_edges))
        return g

    g = multilayered_graph(*subset_sizes)
    for n in g:
        g.nodes[n]["name"] = node_names[n]

        attributes = {}
        for j in range(1, num_node_attr + 1):
            if all_node_attr or randint(0, 1) == 1:
                attributes['Attribute {}'.format(j)] = randint(1, 20)
        g.nodes[n]["attributes"] = attributes

    for u, v in g.edges:
        attributes = {}
        for j in range(1, num_edge_attr + 1):
            if all_edge_attr or randint(0, 1) == 1:
                attributes['Attribute {}'.format(j)] = randint(1, 20)
        g[u][v]["attributes"] = attributes

    # write json formatted data
    data = nx.json_graph.node_link_data(g)
    json.dump(data, open(filename, "w"))

    return {'nodes': data["nodes"], 'edges': data["links"]}


def generate_subnetworks_data(filename, num_nodes, num_node_attr, all_node_attr, densities, num_edge_attr, all_edge_attr):
    """
    This function generates random subnetwork data base on the given properties and writes it to the given file.
    The network data is returned.
    :param filename: file to write
    :param num_nodes: array of numbers of nodes
    :param num_node_attr: number of overall node attributes
    :param all_node_attr: boolean value whether each node contains all attributes
    :param densities: array of densities of the network
    :param num_edge_attr: number of overall edge attributes
    :param all_edge_attr:boolean value whether each edge contains all attributes
    :return: network data
    """

    num_edges = [int(n * (n - 1) * d) for (n, d) in zip(num_nodes, densities)]
    subset_sizes = num_nodes

    def subnetworks(*subset_sizes):
        extents = nx.utils.pairwise(itertools.accumulate((0,) + subset_sizes))
        subnetworks = [range(start, end) for start, end in extents]
        g = nx.Graph()
        g.add_nodes_from(range(0, sum(subset_sizes)))
        for (i, sub) in enumerate(subnetworks):
            g.add_edges_from(sample([(u, v) for (u, v) in itertools.product(sub, repeat=2) if u < v], num_edges[i]))
        return g

    g = subnetworks(*subset_sizes)

    for n in g:
        g.nodes[n]["name"] = node_names[n]

        attributes = {}
        for j in range(1, num_node_attr + 1):
            if all_node_attr or randint(0, 1) == 1:
                attributes['attr{}'.format(j)] = randint(1, 20)
        g.nodes[n]["attributes"] = attributes

    for u, v in g.edges:
        attributes = {}
        for j in range(1, num_edge_attr + 1):
            if all_edge_attr or randint(0, 1) == 1:
                attributes['attr{}'.format(j)] = randint(1, 20)
        g[u][v]["attributes"] = attributes


    # write json formatted data
    data = nx.json_graph.node_link_data(g)
    json.dump(data, open(filename, "w"), indent=4)

    return {'nodes': data["nodes"], 'edges': data["links"]}


# generate network file :
generate_data('248nodes.json', 248, 4, True, 0.025, 4, True)
