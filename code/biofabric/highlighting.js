function bfHighlightNodes(node, d, edges) {
    let adjacentNodes = getAdjacentNodes(d, edges)
    let adjacentEdges = edges.filter(e => e.source === d.id || e.target === d.id);

    node.classed("nodeHighlight", true);
    d3.selectAll("#bf .nodes g").filter(n => adjacentNodes.includes(n.id)).classed("nodeHighlight", true);
    d3.selectAll("#bf .edges g").filter(e => adjacentEdges.includes(e)).classed("nodeHighlight", true);
}

function bfRemoveHighlightedNodes() {
    d3.selectAll("#bf .nodes g:not(.fixedNode), #bf .edges g:not(.fixedNode)").classed("nodeHighlight", false);
}

function bfFixHighlightedNodes(node, d, edges) {
    if (node.classed("selectedNode")) {
        d3.selectAll("#bf .nodes g, #bf .edges g").classed("fixedNode", false).classed("selectedNode", false);
        selectedNode = null;
    } else {
        selectedNode = d;

        let adjacentNodes = getAdjacentNodes(d, edges)
        let adjacentEdges = edges.filter(e => e.source === d.id || e.target === d.id);

        d3.selectAll("#bf .nodes g, #bf .edges g").classed("fixedNode", false).classed("selectedNode", false).classed("nodeHighlight", false);
        node.classed("selectedNode", true).classed("fixedNode", true).classed("nodeHighlight", true);
        d3.selectAll("#bf .nodes g").filter(n => adjacentNodes.includes(n.id)).classed("fixedNode", true).classed("nodeHighlight", true);
        d3.selectAll("#bf .edges g").filter(e => adjacentEdges.includes(e)).classed("fixedNode", true).classed("nodeHighlight", true);
    }
}

function bfHighlightEdges(edge, d) {
    edge.classed("edgeHighlight", true);
    d3.selectAll("#bf .nodes g").filter(n => n.id === d.target || n.id === d.source).classed("edgeHighlight", true);
}

function bfRemoveHighlightedEdges() {
    d3.selectAll("#bf .nodes g:not(.fixedEdge), #bf .edges g:not(.fixedEdge)").classed("edgeHighlight", false);
}

function bfFixHighlightedEdges(edge, d) {
    if (edge.classed("selectedEdge")) {
        d3.selectAll("#bf .nodes g, #bf .edges g").classed("fixedEdge", false).classed("selectedEdge", false);
        selectedEdge = null;
    } else {
        selectedEdge = d;
        d3.selectAll("#bf .nodes g, #bf .edges g").classed("fixedEdge", false).classed("selectedEdge", false).classed("edgeHighlight", false);
        edge.classed("fixedEdge", true).classed("selectedEdge", true).classed("edgeHighlight", true);
        d3.selectAll("#bf .nodes g").filter(n => n.id === d.target || n.id === d.source).classed("fixedEdge", true).classed("edgeHighlight", true);
    }
}

function bfHighlightSelectedNodeOrdering(ordering, node, attributes) {
    switch (ordering.toLowerCase()) {
        case "alphabetical" :
            d3.select("#bf .alph").classed("selectedOrdering", true);
            break;
        case "mean" :
            break;
        case "degree" :
            break;
        case "edges" :
        case "RCM" :
            break;
        case "adjacency":
            d3.selectAll("#bf .sort").filter(x => x.id === node.id).classed("selectedOrdering", true);
            break;
        case "gansner":
            d3.select("#bf .gansner").classed("selectedOrdering", true);
            break;
        default :
            if (attributes.includes(ordering)) {
                d3.selectAll("#bf .juxtatableNodes .header g").filter(x => x === ordering).classed("selectedOrdering", true);
            }
            break;
    }
}

function bfHighlightSelectedEdgeOrdering(ordering, attributes) {
    switch (ordering) {
        case "nodes" :
            break;
        case "mean" :
            break;
        default :
            if (attributes.includes(ordering)) {
                d3.selectAll("#bf .juxtatableEdges .header g").filter(x => x === ordering).classed("selectedOrdering", true);
            }
            break;
    }
}
