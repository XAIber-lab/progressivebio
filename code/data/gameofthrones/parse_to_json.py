# This file parses the network data of interactions in GOT to a .json file.

import pandas as pd
import json

nodes_1 = pd.read_csv('got-s1-nodes.csv', sep=',')
nodes_2 = pd.read_csv('got-s2-nodes.csv', sep=',')
nodes_3 = pd.read_csv('got-s3-nodes.csv', sep=',')
nodes_4 = pd.read_csv('got-s4-nodes.csv', sep=',')
nodes_5 = pd.read_csv('got-s5-nodes.csv', sep=',')
nodes_6 = pd.read_csv('got-s6-nodes.csv', sep=',')
nodes_7 = pd.read_csv('got-s7-nodes.csv', sep=',')
nodes_8 = pd.read_csv('got-s8-nodes.csv', sep=',')
data_nodes = pd.concat([nodes_1, nodes_2, nodes_3, nodes_4, nodes_5, nodes_6, nodes_7, nodes_8])
data_nodes.drop_duplicates(subset=['Id'], inplace=True, ignore_index=True)

mapping = {v: k for k, v in data_nodes['Id'].to_dict().items()}

nodes = []
for d in data_nodes.to_dict(orient="records"):
    nodes.append({'id': mapping[d['Id']], 'name': d['Label']})

edges_1 = pd.read_csv('got-s1-edges.csv', sep=',')
edges_2 = pd.read_csv('got-s2-edges.csv', sep=',')
edges_3 = pd.read_csv('got-s3-edges.csv', sep=',')
edges_4 = pd.read_csv('got-s4-edges.csv', sep=',')
edges_5 = pd.read_csv('got-s5-edges.csv', sep=',')
edges_6 = pd.read_csv('got-s6-edges.csv', sep=',')
edges_7 = pd.read_csv('got-s7-edges.csv', sep=',')
edges_8 = pd.read_csv('got-s8-edges.csv', sep=',')
data_edges = pd.concat([edges_1, edges_2, edges_3, edges_4, edges_5, edges_6, edges_7, edges_8])
grouped = data_edges.groupby(['Source', 'Target'])
edges = []
ids = []
for _, group in grouped:
    edge = {'source': mapping[group.iloc[0]['Source']], 'target': mapping[group.iloc[0]['Target']], 'attributes': {}}
    for d in group.to_dict(orient="records"):
        edge['attributes']['Season ' + str(d['Season'])] = d['Weight']
    edges.append(edge)

with open('got.json', 'w') as outfile:
    json.dump({'nodes': nodes, 'links': edges}, outfile, indent=4)
    outfile.close()
