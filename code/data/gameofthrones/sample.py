# This file samples the network data of game of thrones.

import json
import random


def get_attribute_values(data, node, attributes):
    values = [e['attributes'] for e in data['links'] if e['source'] == node['id'] or e['target'] == node['id']]
    return [v['Season ' + str(i + 1)] for v in values for i in range(attributes) if ('Season ' + str(i + 1)) in v]


def sample(filename, size, density, attributes):
    with open('/Users/mariaheinle/Documents/Studium/Bachelor Arbeit/biofabricevaluation/code/data/gameofthrones/got.json', 'r') as file:
        data = json.loads(file.read())

    ordered = sorted(data['nodes'], key=lambda x: sum(get_attribute_values(data, x, attributes)), reverse=True)
    nodes = ordered[0:size]
    ids = [n['id'] for n in nodes]
    attr = ['Season ' + str(i + 1) for i in range(attributes)]
    edges = [e for e in data['links'] if e['source'] in ids and e['target'] in ids and (set(e['attributes'].keys()) & set(attr))]
    for e in edges:
        e['attributes'] = {k: e['attributes'][k] for k in attr if k in e['attributes']}

    edges = random.sample(edges, k=int(density * size * (size - 1)))

    with open(filename, 'w') as outfile:
        json.dump({'nodes': nodes, 'links': edges}, outfile, indent=4)
    outfile.close()

    return {'nodes': nodes, 'links': edges}


sample('got_sample_large.json', 50, 0.2, 8)