import json
import os
import pygraphviz as pgv

root = os.path.dirname(__file__)
path = os.path.join(root, 'boardgames/preprocessed')

def norm(val, min, max):
    return (val - min) / (max - min)

i = 0
for file in os.listdir(os.fsencode(path)):
    filename = os.fsdecode(file)
    if filename.endswith('100.json'):
        data = json.load(open(os.path.join(path, filename)))
        ids = [n['id'] for n in data['nodes']]
        dot = "graph {\n"
        for link in data['links']:
            dot += "{} -- {};\n".format(link['source'], link['target'])

        # same rank (for output as sequence)
        rank = "{rank = same; " + "; ".join(map(str, ids)) + "};"
        dot1 = dot + rank + "}"

        G1 = pgv.AGraph(dot1)
        G1.layout(prog="dot")

        positions1 = {}
        for n in G1.nodes():
            positions1[n] = float(n.attr['pos'].split(',')[0])

        order = sorted(positions1, key=lambda k: positions1[k])


        # hierarchical
        dot2 = dot + "}"

        G2 = pgv.AGraph(dot2)
        G2.layout(prog="dot")

        x = []
        y = []
        positions2 = {}
        for n in G2.nodes():
            nx = float(n.attr['pos'].split(',')[0])
            ny = float(n.attr['pos'].split(',')[1])
            x.append(nx)
            y.append(ny)
            positions2[n] = {'x': nx, 'y': ny}
        x_max2, x_min2 = max(x), min(x)
        y_max2, y_min2 = max(y), min(y)


        # radial
        dot3 = dot + "}"

        G3 = pgv.AGraph(dot3)
        G3.layout(prog="circo")

        x = []
        y = []
        positions3 = {}
        for n in G3.nodes():
            nx = float(n.attr['pos'].split(',')[0])
            ny = float(n.attr['pos'].split(',')[1])
            x.append(nx)
            y.append(ny)
            positions3[n] = {'x': nx, 'y': ny}
        x_max3, x_min3 = max(x), min(x)
        y_max3, y_min3 = max(y), min(y)


        for node in data['nodes']:
            node['gansner'] = order.index(str(node['id']))
            node['hierarchy'] = [norm(positions2[str(node['id'])]['x'], x_min2, x_max2),
                                 norm(positions2[str(node['id'])]['y'], y_min2, y_max2)]
            node['radial'] = [norm(positions3[str(node['id'])]['x'], x_min3, x_max3),
                              norm(positions3[str(node['id'])]['y'], y_min3, y_max3)]

        with open(os.path.join(path, filename), 'w') as outfile:
            outfile.write(json.dumps({'nodes': data['nodes'], 'links': data['links']}, indent=4))