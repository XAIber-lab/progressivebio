import json
import os
import networkx as nx

root = os.path.dirname(__file__)
path = os.path.join(root, '')

for file in os.listdir(os.fsencode(path)):
    filename = os.fsdecode(file)
    if filename.endswith('.json'):
        data = json.load(open(os.path.join(path, filename)))

        nodes = []
        edges = []
        check = []
        ids = []
        for entry in data:
            attr = {}
            attr['year'] = entry['year']
            attr['rank'] = entry['rank']
            attr['minplayers'] = entry['minplayers']
            attr['maxplayers'] = entry['maxplayers']
            attr['minplaytime'] = entry['minplaytime']
            attr['maxplaytime'] = entry['maxplaytime']
            attr['minage'] = entry['minage']
            attr['rating'] = entry['rating']['rating']
            attr['num_of_reviews'] = entry['rating']['num_of_reviews']

            node = {'id': entry['id'], 'name': entry['title'], 'attributes': attr}
            nodes.append(node)
            ids.append(entry['id'])

            for game in entry['recommendations']['fans_liked']:
                if (game, entry['id']) not in check:
                    edges.append({'source': entry['id'], 'target': game, 'attributes': {}})
                    check.append((entry['id'], game))

            """
            for key, val in entry['types'].items():
                for edge in val:
                    nodes.append({'id': edge['id'], 'name': edge['name'], 'attributes': {key: 1}})
                    edges.append({'source': entry['id'], 'target': edge['id'], 'attributes': {}})

            for designer in entry['credit']['designer']:
                nodes.append({'id': designer['id'], 'name': designer['name'], 'attributes': {'designer': 1}})
                edges.append({'source': entry['id'], 'target': designer['id'], 'attributes': {}})
            """

        edges = [edge for edge in edges if edge['source'] in ids and edge['target'] in ids]
        json.dump({'nodes': nodes, 'links': edges}, open(os.path.join(path, 'preprocessed/' + filename), 'w'), indent=4)