import pygraphviz as pgv

G = pgv.AGraph(directed=True)
G.add_node('A')
G.add_node('B')
G.add_edge('A', 'B')
G.draw('test_graph.png', prog='dot')

print("Graph created and saved as 'test_graph.png'")
