# This file generates tasks and saves them to a .json file fo each condition.

import json
import random as rnd
import itertools
from generate_social_network import generate_data


def get_adjacent_node_ids(network, node):
    """
    This function gets all adjacent node ids of the given node.
    :param network:
    :param node:
    :return: node ids
    """
    return [e['source'] for e in network['links'] if e['target'] == node['id']] + [e['target'] for e in network['links']
                                                                                   if e['source'] == node['id']]


def get_adjacent_nodes(network, node):
    """
    This function gets all adjacent nodes of the given node.
    :param network:
    :param node:
    :return: nodes
    """
    return [n for n in network['nodes'] if n['id'] in get_adjacent_node_ids(network, node)]


def get_adjacent_edges(network, node):
    """
    This function gets all adjacent edges of the given node.
    :param network:
    :param node:
    :return: edges
    """
    return [e for e in network['links'] if e['target'] == node['id'] or e['source'] == node['id']]


def get_adjacent_nodes_with_second_highest_value(network, node, attribute):
    """
    This function gets the adjacent nodes of the given node which edge has the second highest value on the given
    attribute.
    :param network:
    :param node:
    :param attribute:
    :return: nodes
    """
    values = set([e['attributes'][attribute] for e in get_adjacent_edges(network, node)])
    values.remove(max(values))
    target = [e['target'] for e in network['links'] if e['source'] == node['id']
              and e['attributes'][attribute] == max(values)] + \
             [e['source'] for e in network['links'] if e['target'] == node['id']
              and e['attributes'][attribute] == max(values)]

    return [n for n in data['nodes'] if n['id'] in target]


def get_adjacent_nodes_on_attribute_comparison(network, node, attributes):
    """
    This function gets the adjacent nodes of the given node which edge has a higher value in first than in the second
    attribute.
    :param network:
    :param node:
    :param attributes:
    :return: nodes
    """
    adjacent = get_adjacent_edges(network, node)
    target = [e for e in adjacent if e['attributes'][attributes[0]] > e['attributes'][attributes[1]]]
    ids = [e['source'] for e in target if e['target'] == node['id']] + [e['target'] for e in target if
                                                                        e['source'] == node['id']]

    return [n for n in network['nodes'] if n['id'] in ids]


def generate_textual_solution(solution, conj):
    if len(solution) == 1:
        text = solution[0]['name']
    else:
        names = [n['name'] for n in solution]
        text = ", ".join(names[:-1]) + ' ' + conj + ' ' + names[-1]
    return text


def generate_task(data, taskType):
    """
    This function generates a task including a description, answer option, solution and textual representation of
    the solution. It also provides an ordering of the edges which can be applied to BioFabric only.
    :param data: network data
    :param taskType: plain, one or two
    :return: task
    """
    node = rnd.choice(data['nodes'])
    # ensure that there are at least two adjacent edges
    while len(get_adjacent_edges(data, node)) < 2:
        node = rnd.choice(data['nodes'])

    if taskType == 'plain':
        solution = get_adjacent_nodes(data, node)
        return {'description': 'Find all friends of ' + node['name'] + '.', 'answer': 'multipleNodeSelection',
                'solution': solution, 'textSolution': generate_textual_solution(solution, 'and'), 'ordering': 'Nodes'}

    elif taskType == 'one':
        attribute = rnd.choice(['Years of Friendship', 'Distance', 'Interactions per Week', 'Common Hobbies'])
        # ensure that there are at least two different values for the chosen attribute
        while len(set([e['attributes'][attribute] for e in get_adjacent_edges(data, node)])) < 2:
            node = rnd.choice(data['nodes'])
            attribute = rnd.choice(['Years of Friendship', 'Distance', 'Interactions per Week', 'Common Hobbies'])

        solution = get_adjacent_nodes_with_second_highest_value(data, node, attribute)
        return {'description': 'Find a friend of ' + node['name'] + ' whose friendship has the second highest value in '
                               + attribute.lower() + ".", 'answer': 'nodeSelection', 'solution': solution,
                'textSolution': generate_textual_solution(solution, 'or'), 'ordering': attribute}

    else:
        attributes = rnd.sample(['Years of Friendship', 'Distance', 'Interactions per Week', 'Common Hobbies'], k=2)
        solution = get_adjacent_nodes_on_attribute_comparison(data, node, attributes)
        # ensure that there are at least two adjacent edges and the solution includes at least one of them
        while len(get_adjacent_edges(data, node)) < 2 or len(solution) < 1:
            node = rnd.choice(data['nodes'])
            attributes = rnd.sample(['Years of Friendship', 'Distance', 'Interactions per Week', 'Common Hobbies'], k=2)
            solution = get_adjacent_nodes_on_attribute_comparison(data, node, attributes)

        return {'description': 'Find all friends of ' + node['name'] + ' whose friendship has more ' +
                               attributes[0].lower() + ' than ' + attributes[1].lower() + '.',
                'answer': 'multipleNodeSelection', 'solution': solution,
                'textSolution': generate_textual_solution(solution, 'and'), 'ordering': attributes}


# between-group
technique = ['adjacency_matrix', 'biofabric']

# within-group
size = [20, 50, 80]
density = [0.025, 0.0625, 0.1]
taskType = ['plain', 'one', 'two']

conditions = itertools.product(size, density, taskType)

tasks = {}
for t in technique:
    tasks[t] = {}
    for tt in taskType:
        tasks[t][tt] = {}
        tasks[t][tt]['training'] = []
        tasks[t][tt]['survey'] = []

for tt in taskType:
    for i in range(3):
        s = size[0]
        d = density[0]
        filename = 'tasks/training/' + str(s) + '_' + str(d) + '_' + tt + '_' + str(i) + '.json'
        data = generate_data(filename, s, d)
        task = generate_task(data, tt)

        for t in technique:
            if t == 'adjacency_matrix':
                parameters = {'nodeEncoding': 'plainNodes', 'edgeEncoding': 'multipleEdges', 'nodeOrdering': 'RCM',
                              'nodeAttribute': '', 'edgeAttribute': ''}
            else:
                parameters = {'nodeEncoding': 'plainNodes', 'edgeEncoding': 'juxtaposedEdges', 'nodeOrdering': 'RCM',
                              'edgeOrdering': task['ordering'], 'attribute': ''}

            if tt == 'plain':
                parameters['edgeEncoding'] = 'plainEdges'

            tasks[t][tt]['training'].append({'technique': t, 'parameters': parameters, 'size': s, 'density': d,
                                             'type': tt, 'data': filename, 'task': task['description'],
                                             'answer_option': task['answer'], 'solution': task['solution'],
                                             'text_solution': task['textSolution']})

for i, [s, d, tt] in enumerate(conditions):
    filename = 'tasks/survey/' + str(s) + '_' + str(d) + '_' + tt + '.json'
    data = generate_data(filename, s, d)
    task = generate_task(data, tt)

    for t in technique:
        if t == 'adjacency_matrix':
            parameters = {'nodeEncoding': 'plainNodes', 'edgeEncoding': 'multipleEdges', 'nodeOrdering': 'RCM',
                          'nodeAttribute': '', 'edgeAttribute': ''}
        else:
            parameters = {'nodeEncoding': 'plainNodes', 'edgeEncoding': 'juxtaposedEdges', 'nodeOrdering': 'RCM',
                          'edgeOrdering': task['ordering'], 'attribute': ''}

        if tt == 'plain':
            parameters['edgeEncoding'] = 'plainEdges'

        tasks[t][tt]['survey'].append({'technique': t, 'parameters': parameters, 'size': s, 'density': d,
                                       'type': tt, 'data': filename, 'task': task['description'],
                                       'answer_option': task['answer'], 'solution': task['solution'],
                                       'text_solution': task['textSolution']})

for t in technique:
    with open('tasks/' + t + '.json', 'w') as outfile:
        json.dump(tasks[t], outfile, indent=4)
    outfile.close()
    with open('tasks/' + t + '.json', 'w') as outfile:
        json.dump(tasks[t], outfile, indent=4)
    outfile.close()
