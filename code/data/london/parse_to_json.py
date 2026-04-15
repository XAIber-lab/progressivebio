# This file parses the network data of london's gangs to a .json file.

import pandas as pd
import json

data_n = pd.read_csv('london/LONDON_GANG_ATTR.csv', sep=',')
data_n.rename(columns={'Unnamed: 0': 'id'}, inplace=True)
nodes = []
for d in data_n.to_dict(orient="records"):
    nodes.append({'id': d['id'], 'name': d['id'], 'attributes': {k: d[k] for k in d.keys() if k != 'id'}})
print(nodes)

data_e = pd.read_csv('london/LONDON_GANG.csv', sep=',', index_col=0)
edges = []
categories = ['Hang Out', 'Co-Offend', 'Serious Crime', 'Kin']
for i, e in data_e.iterrows():
    for j, v in e.iteritems():
        if i < int(j):
            attributes = {}
            if v != 0:
                attributes[categories[v - 1]] = 1
            if v > 2:
                attributes[categories[1]] = 1
            if v == 4:
                attributes[categories[2]] = 1

            if attributes:
                edges.append({'source': i, 'target': int(j), 'attributes': attributes})

with open('london.json', 'w') as outfile:
    json.dump({'nodes': nodes, 'links': edges}, outfile, indent=4)
    outfile.close()
