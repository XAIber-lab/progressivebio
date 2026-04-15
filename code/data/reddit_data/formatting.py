import json
import os

root = os.path.dirname(__file__)
path = os.path.join(root, '')

i = 0
for file in os.listdir(os.fsencode(path)):
    filename = os.fsdecode(file)
    if filename.endswith('.json'):
        data = json.load(open(os.path.join(path, filename)))
        formatted = {'nodes': [], 'links': []}
        for n in data['nodes']:
            node = {'id': n['id'], 'name': n['name'],
                    'attributes': {'degree': n['degree'], 'degree_centrality': n['degree_centrality'],
                                   'clustering': n['clustering'], 'pagerank': n['pagerank']}}
            formatted['nodes'].append(node)
        for e in data['links']:
            edge = {'source': e['source'], 'target': e['target'],
                    'attributes': {'sentiment': e['sentiment'], 'num_chars': float(e['num_chars']),
                                   'num_words': float(e['num_words']), 'num_words_unique': float(e['num_words_unique']),
                                   'num_words_long': float(e['num_words_long']),
                                   'num_stop_word_unique': float(e['num_stop_word_unique']),
                                   'num_sentences': float(e['num_sentences'])}}
            formatted['links'].append(edge)

        with open(os.path.join(path, filename), 'w') as outfile:
            outfile.write(json.dumps(formatted, indent=4))
