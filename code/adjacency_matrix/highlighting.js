function highlightNodes(node, d, edges, side) {
    node.classed("nodeHover", true);
    let adjacent = getAdjacentNodes(d, edges)
    if (side === "left") {
        d3.selectAll("#adm .grid g").filter(x => x.source === d.id).classed("nodeHover", true);
        d3.selectAll("#adm .nodes .top g").filter(x => adjacent.includes(x.id)).classed("nodeHighlight", true);
        d3.selectAll("#adm .grid g").filter(x => adjacent.includes(x.target)).classed("nodeHighlight", true);
        d3.selectAll("#adm .juxtatable .grid g").filter(x => x === d).classed("nodeHighlight", true);
    } else {
        d3.selectAll("#adm .grid g").filter(x => x.target === d.id).classed("nodeHover", true);
        d3.selectAll("#adm .nodes .left g").filter(x => adjacent.includes(x.id)).classed("nodeHighlight", true);
        d3.selectAll("#adm .grid g").filter(x => adjacent.includes(x.source)).classed("nodeHighlight", true);
        d3.selectAll("#adm .juxtatable .grid g").filter(x => adjacent.includes(x.id)).classed("nodeHighlight", true);
    }
}

function removeHighlightedNodes() {
    d3.selectAll("#adm .nodes g:not(.fixedNode), #adm .grid g:not(.fixedNode)").classed("nodeHover", false).classed("nodeHighlight", false);
    d3.selectAll("#adm .nodes g:not(.selectedNode), #adm .grid g:not(.selectedNode)").classed("nodeHover", false);
}

function fixHighlightedNodes(node, d, edges, side) {
    if (node.classed("selectedNode")) {
        d3.selectAll("#adm .nodes g, #adm .grid g").classed("fixedNode", false).classed("selectedNode", false);
        selectedNode = null;
    } else {
        selectedNode = d;
        let adjacent = getAdjacentNodes(d, edges)
        d3.selectAll("#adm .nodes g, #adm .grid g").classed("fixedNode", false).classed("selectedNode", false).classed("nodeHighlight", false).classed("nodeHover", false);
        node.classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
        if (side ==="left") {
            selectedNodeSide = "left";
            d3.selectAll("#adm .grid g").filter(x => x.source === d.id).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
            d3.selectAll("#adm .nodes .top g").filter(x => adjacent.includes(x.id)).classed("fixedNode", true).classed("nodeHighlight", true);
            d3.selectAll("#adm .grid g").filter(x => adjacent.includes(x.target)).classed("fixedNode", true).classed("nodeHighlight", true);
            d3.selectAll("#adm .juxtatable .grid g").filter(x => x === d).classed("fixedNode", true).classed("nodeHighlight", true);
        } else {
            selectedNodeSide = "top";
            d3.selectAll("#adm .grid g").filter(x => x.target === d.id).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
            d3.selectAll("#adm .nodes .left g").filter(x => adjacent.includes(x.id)).classed("fixedNode", true).classed("nodeHighlight", true);
            d3.selectAll("#adm .grid g").filter(x => adjacent.includes(x.source)).classed("fixedNode", true).classed("nodeHighlight", true);
            d3.selectAll("#adm .juxtatable .grid g").filter(x => adjacent.includes(x.id)).classed("fixedNode", true).classed("nodeHighlight", true);
        }
    }
}

function highlightEdges(d) {
    d3.selectAll("#adm .grid g").filter(x => d.source === x.source || d.target === x.target).classed("edgeHighlight", true);
    d3.selectAll("#adm .juxtatable .grid g").filter(x => x.id === d.source).classed("edgeHighlight", true);
}

function removeHighlightedEdges() {
    d3.selectAll("#adm .grid g:not(.fixedEdge)").classed("edgeHighlight", false);
}

function fixHighlightedEdges(cell, d) {
    if (cell.classed("selectedEdge")) {
        d3.selectAll("#adm .grid g").classed("fixedEdge", false).classed("selectedEdge", false);
        selectedEdge = null;
    } else {
        selectedEdge = d
        d3.selectAll("#adm .grid g").classed("fixedEdge", false).classed("selectedEdge", false).classed("edgeHighlight", false);
        cell.classed("selectedEdge", true).classed("fixedEdge", true).classed("edgeHighlight", true);
        d3.selectAll("#adm .grid g").filter(x => x.source === d.source || x.target === d.target).classed("fixedEdge", true).classed("edgeHighlight", true);
        d3.selectAll("#adm .juxtatable .grid g").filter(x => x.id === d.source).classed("fixedEdge", true).classed("edgeHighlight", true);
    }
}

function highlightSelectedOrdering(ordering, node, side, attributes) {
    switch (ordering.toLowerCase()) {
        case "alphabetical" :
            d3.select("#adm .alph").classed("selectedOrdering", true);
            break;
        case "mean" :
            break;
        case "degree" :
            break;
        case "edges" :
        case "RCM" :
            break;
        case "adjacency":
            d3.selectAll("#adm ." + side + " .sort").filter(x => x.id === node.id).classed("selectedOrdering", true);
            break;
        case "cluster":
            // d3.select("#bf .cluster").classed("selectedOrdering", true);
            break;
        default :
            if (attributes.includes(ordering)) {
                d3.selectAll("#adm .juxtatable .header g").filter(x => x === ordering).classed("selectedOrdering", true);
            }
            break;
    }
}