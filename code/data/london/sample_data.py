# This file samples the network data of london's gangs.
import random

import json

with open('london.json','r') as file:
    data = json.loads(file.read())

nodes = random.sample(data['nodes'], 20)
ids = [n['id'] for n in nodes]
edges = [e for e in data['links'] if e['source'] in ids and e['target'] in ids]

with open('london_sample.json', 'w') as outfile:
    json.dump({'nodes': nodes, 'links': edges}, outfile, indent=4)
    outfile.close()