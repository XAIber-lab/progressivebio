import json
import os
import networkx as nx

root = os.path.dirname(__file__)
path = os.path.join(root, '')

for file in os.listdir(os.fsencode(path)):
    filename = os.fsdecode(file)
    if filename.endswith('.json'):
        print(filename)
        data = json.load(open(os.path.join(path, filename)))

        g = nx.node_link_graph(data, directed=False, multigraph=False)
        closeness = nx.closeness_centrality(g)
        betweenness = nx.betweenness_centrality(g)
        centrality = nx.eigenvector_centrality(g, max_iter=200)

        for n in g.nodes():
            # delete all node attributes except 'degree'
            tmp = g.nodes[n]['attributes']['degree']
            g.nodes[n]['attributes'].clear()
            g.nodes[n]['attributes']['degree'] = tmp

            # add 'closeness', 'betweenness' and 'eigenvector' centrality
            g.nodes[n]['attributes']['closeness'] = closeness[n]
            g.nodes[n]['attributes']['betweenness'] = betweenness[n]
            g.nodes[n]['attributes']['eigenvector'] = centrality[n]

        # write json formatted data
        json.dump(nx.json_graph.node_link_data(g), open(os.path.join(path, 'preprocessed/' + filename), 'w'), indent=4)

