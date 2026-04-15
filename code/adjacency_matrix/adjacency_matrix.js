const margins = {left: 75, top: 75, right: 0, bottom: 10};

let nodeEncoding = "plain";
let edgeEncoding = "plain";
let nodeAttribute = undefined;
let edgeAttribute = undefined;
let ordering = "alphabetical";
let orderingNode = undefined;
let orderingSide = undefined;
let nodeShading = false;
// let selectedNode = undefined;
// let selectedEdge = undefined;

let cellSize, fontSize, smallFontSize;
let nodeColors, edgeColors;

const triangle = d3.symbol().type(d3.symbolTriangle2);
triangle.size(50);
const path = triangle();

function adjacency_matrix(view, data) {
    // network properties
    const nodes = data.nodes;
    const edges = data.edges;
    const nodeAttributes = getAttributeLabels(nodes);
    const edgeAttributes = getAttributeLabels(edges);

    // visualization properties
    cellSize = (view.height - margins.top - margins.bottom) / nodes.length;

    // TODO: adapt font size and colors
    const max_nameLength = Math.max(...nodes.map(n => n.name.length));
    fontSize = study ? (nodes.length < 30 ? 14 : (nodes.length < 60 ? 12 : 10)) : (Math.min(max_nameLength < 7 ? 20 : 10, max_nameLength < 10 ? cellSize * 0.5 : cellSize * 0.25));
    smallFontSize = 10;

    const modSet1 = ["#377eb8", "#984ea3", "#ff7f00", "#a65628", "#f781bf", "#999999"];
    nodeColors = d3.scaleOrdinal(modSet1).domain(nodeAttributes);
    const modSet2 = ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494", "#b3b3b3"];
    edgeColors = d3.scaleOrdinal(modSet2).domain(edgeAttributes);

    const g = view.g.append("g").attr("id", "adm");

    // handle nodes
    let otherNodes = sortNodes(nodes, nodeAttributes, edges, ordering, data);
    const nodePositions = nodes.map(x => x.id).reduce((acc, id) => ({...acc, [id]: []}), {});
    if (typeof otherNodes !== "undefined") {
        if (orderingSide === "top") {
            otherNodes.forEach(function (d, i) {
                nodePositions[d.id][0] = cellSize * i;  // left is modified
            });
            nodes.forEach(function (d, i) {
                nodePositions[d.id][1] = cellSize * i;  // top is original
            });
        } else {
            nodes.forEach(function (d, i) {
                nodePositions[d.id][0] = cellSize * i;  // left is original
            });
            otherNodes.forEach(function (d, i) {
                nodePositions[d.id][1] = cellSize * i;  // top is modified
            });
        }
    } else {
        nodes.forEach(function (d, i) {
            nodePositions[d.id][0] = cellSize * i;  // left and top are same
            nodePositions[d.id][1] = cellSize * i;
        });
    }

    const node = g.append("g").attr("class", "nodes")
        .attr("transform", "translate(" + margins.left + ", " + margins.top + ")");
    drawNodes(node, nodes, nodePositions);
    visualizeNodeAttributes(view, nodes, nodePositions, nodeAttributes, nodeEncoding);

    // handle edges
    let swapped = edges.map(function (d) {
        return {"source": d.target, "target": d.source, "attributes": d.attributes};
    });
    const doubled = edges.concat(swapped);

    const edge = g.append("g")
        .attr("class", "edges")
        .attr("transform", "translate(" + margins.left + ", " + margins.top + ")");
    drawEdges(edge, doubled, nodePositions, cellSize);
    visualizeEdgeAttributes(view, edges, edgeAttributes, edgeEncoding);

    // handle overlaid grid
    const matrix = [];
    nodes.forEach(function (d1) {
        nodes.forEach(function (d2) {
            matrix.push({source: d1.id, target: d2.id});
        });
    });

    const grid = g.append("g")
        .attr("class", "grid")
        .attr("transform", "translate(" + margins.left + ", " + margins.top + ")");
    //.attr("pointer-events", "all")
    drawGrid(grid, matrix, nodePositions, cellSize);

    // handle interaction
    // addSelection(g, nodes, nodePositions, edges);
    enableGridInteraction(grid, nodePositions, doubled);
    enableNodeInteraction(node, grid, edges);
    addOrderingPossibilities(g, view, data);

    // organizer functions
    function sortNodes(nodes, attributes, edges, ordering, data) {
        let otherNodes = undefined;

        switch (ordering.toLowerCase()) {
            case "random":
                sortRandomly(nodes);
                break;
            case "alphabetical" :
                sortAlphabetically(nodes);
                break;
            case "mean" :
                sortByMean(nodes);
                break;
            case "degree" :
                sortByDegree(nodes, edges);
                break;
            case "edges" :
            case "rcm" :
                sortByRCM(data);
                break;
            case "adjacency":
                otherNodes = sortByAdjacency(nodes, edges, orderingNode);
                break;
            case "cluster":
                // TODO
                break;
            case "gansner":
                sortByGansner(nodes);
                break;
            default :
                if (attributes.includes(ordering)) {
                    sortByAttribute(ordering, nodes);
                }
                break;
        }

        return otherNodes;
    }

    function drawNodes(g, nodes, positions) {
        let posOffset = ".35em";
        let negOffset = "-.35em";
        const left = g.append("g")
            .attr("class", "left")
            .selectAll("g")
            .data(nodes)
            .enter()
            .append("g")
            .attr("transform", function (d) {
                return "translate(0, " + positions[d.id][0] + ")";
            });

        left.append("rect")
            .attr("transform", "translate(" + (-margins.left) + ", 0)")
            .attr("width", margins.left)
            .attr("height", cellSize)
            .attr("fill", "white");

        left.append("text")
            .attr("transform", "translate(0, " + (cellSize * 0.5) + ")")
            .text(function (d) {
                return d.name;
            })
            .attr("dx", negOffset)
            .attr("dy", posOffset)
            .attr("fill", "black")
            .attr("text-anchor", "end")
            .attr("font-size", fontSize);

        const top = g.append("g")
            .attr("class", "top")
            .selectAll("g")
            .data(nodes)
            .enter()
            .append("g")
            .attr("transform", function (d) {
                return "translate(" + positions[d.id][1] + ", 0)";
            });

        top.append("rect")
            .attr("transform", "translate(0, " + (-margins.top) + ")")
            .attr("width", cellSize)
            .attr("height", margins.top)
            .attr("fill", "white");

        top.append("text")
            .attr("transform", "translate(" + (cellSize * 0.5) + ", 0) rotate(-90)")
            .text(function (d) {
                return d.name;
            })
            .attr("dx", posOffset)
            .attr("dy", posOffset)
            .attr("fill", "black")
            .attr("text-anchor", "start")
            .attr("font-size", fontSize);
    }

    function drawEdges(g, edges, positions, cellSize) {
        g.selectAll("g")
            .data(edges)
            .enter()
            .append("g")
            .attr("transform", function (d) {
                return "translate(" + positions[d.source][1] + ", " + positions[d.target][0] + ")";
            })
            //.raise()
            .append("rect")
            .attr("width", cellSize)
            .attr("height", cellSize);

    }

    function drawGrid(g, matrix, positions, cellSize) {
        g.selectAll("g")
            .data(matrix)
            .enter()
            .append("g")
            .attr("transform", function (d) {
                return "translate(" + positions[d.target][1] + ", " + positions[d.source][0] + ")";
            })
            .append("rect")
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("fill", "none")
            .attr("stroke-width", "1px")
            .attr("stroke", d3.select("#colorpicker").empty() ? "black" : d3.select("#colorpicker").property("value"));
    }

    function visualizeNodeAttributes(view, nodes, positions, attributes, encoding) {
        switch (encoding) {
            case "plain":
                break;
            case "color":
                coloredNodes(nodeAttribute, nodes, attributes);
                break;
            case "juxta":
                juxtaposedNodeAttributes(view, nodes, positions, attributes);
                break;
        }
    }

    function visualizeEdgeAttributes(view, edges, attributes, encoding) {
        switch (encoding) {
            case "plain":
                break;
            case "size":
                squaredEdges(edgeAttribute, edges, attributes);
                break;
            case "opacity":
                opaqueEdges(edgeAttribute, edges, attributes);
                break;
            case "divided":
                if (attributes.length > 1) {
                    dividedEdges(edges, attributes);
                }
                break;
            case "bars":
                if (attributes.length > 2) {
                    barsEdges(edges, attributes);
                }
                break;
        }
    }

    function addOrderingPossibilities(g, view, data) {
        const buttons = g.append("g")
            .attr("class", "buttons");

        // alphabetically
        const alph = buttons.append("g")
            .attr("class", "alph");

        alph.append("rect")
            .attr("width", margins.left)
            .attr("height", fontSize * 1.5)
            .attr("fill", "white")
            .attr("stroke", "gray")
            .attr("stroke-width", "1px");

        alph.append("text")
            .text("Name")
            .attr("x", margins.left * 0.25)
            .attr("dy", "1em")
            .attr("text-anchor", "start")
            .attr("font-size", fontSize);

        alph.append("path")
            .attr("transform", "translate(10, " + (0.7 * fontSize) + ") rotate(180 0 0)")
            .attr("d", path)
            .attr("stroke", "gray")
            .attr("fill", "white");

        alph.on("click", function () {
            view.g.selectAll("*").remove();
            ordering = "alphabetical";
            adjacency_matrix(view, data);
        });

        // cluster
        const cluster = buttons.append("g")
            .attr("class", "cluster")
            .attr("transform", "translate(0, " + fontSize * 2 + ")");

        cluster.append("rect")
            .attr("width", margins.left)
            .attr("height", fontSize * 1.5)
            .attr("fill", "white")
            .attr("stroke", "gray")
            .attr("stroke-width", "1px");

        cluster.append("text")
            .text("Cluster")
            .attr("x", margins.left * 0.25)
            .attr("dy", "1em")
            .attr("text-anchor", "start")
            .attr("font-size", fontSize);

        cluster.append("path")
            .attr("transform", "translate(10, " + (0.7 * fontSize) + ") rotate(180 0 0)")
            .attr("d", path)
            .attr("stroke", "gray")
            .attr("fill", "white");

        cluster.on("click", function () {
            view.g.selectAll("*").remove();
            ordering = "cluster";
            adjacency_matrix(view, data);
        });

        // node attributes
        g.selectAll(".header > g")
            .append("path")
            .attr("transform", "translate(10, " + (0.7 * fontSize) + ") rotate(180 0 0)")
            .attr("d", path)
            .attr("stroke", "gray")
            .attr("fill", "white");

        g.selectAll(".header > g").on("click", function (event, d) {
            view.g.selectAll("*").remove();
            ordering = d;
            adjacency_matrix(view, data);
        });

        // adjacent nodes
        g.selectAll(".nodes .top text").attr("x", fontSize * 1.5);
        let adjacenctToTop = g.selectAll(".nodes .top g")
            .append("g")
            .attr("class", "sort")
            .attr("transform", "translate(" + (cellSize * 0.5 - fontSize * 0.5) + ", " + (-fontSize * 1.5) + ")");
        adjacenctToTop.append("rect")
            .attr("width", fontSize)
            .attr("height", fontSize)
            .attr("fill", "gray")
            .attr("stroke", "gray")
            .attr("stroke-width", "1px");
        adjacenctToTop.append("path")
            .attr("transform", "translate(" + (0.5 * fontSize) + "," + +(0.5 * fontSize) + ") rotate(180 0 0)")
            .attr("d", path)
            .attr("stroke", "white")
            .attr("fill", "white");

        g.selectAll(".nodes .top .sort").on("click", function (event, d) {
            view.g.selectAll("*").remove();
            ordering = "adjacency";
            orderingNode = d;
            orderingSide = "top";
            adjacency_matrix(view, data);
        });

        g.selectAll(".nodes .left text").attr("x", -fontSize * 1.5);
        let adjacenctToLeft = g.selectAll(".nodes .left g")
            .append("g")
            .attr("class", "sort")
            .attr("transform", "translate(" + (-fontSize * 1.5) + ", " + (cellSize * 0.5 - fontSize * 0.5) + ")");
        adjacenctToLeft.append("rect")
            .attr("width", fontSize)
            .attr("height", fontSize)
            .attr("fill", "gray")
            .attr("stroke", "gray")
            .attr("stroke-width", "1px");
        adjacenctToLeft.append("path")
            .attr("transform", "translate(" + (0.5 * fontSize) + "," + (0.5 * fontSize) + ") rotate(90 0 0)")
            .attr("d", path)
            .attr("stroke", "white")
            .attr("fill", "white");

        g.selectAll(".nodes .left .sort").on("click", function (event, d) {
            view.g.selectAll("*").remove();
            ordering = "adjacency";
            orderingNode = d;
            orderingSide = "left";
            adjacency_matrix(view, data);
        });

        highlightSelectedOrdering(ordering, orderingNode, orderingSide, nodeAttributes);
    }

    function addSelection(g, nodes, positions, edges) {
        const size = 10;
        const selection = g.append("g")
            .attr("class", "selection")
            .attr("transform", "translate(0, " + margins.top + ")")
            .selectAll("g")
            .data(nodes)
            .enter()
            .append("g")
            .attr("class", "checkbox")
            .attr("transform", function (d) {
                return "translate(0, " + positions[d.id][0] + ")";
            });

        selection.append("rect")
            .attr("transform", "translate(5, " + (cellSize / 2 - size / 2) + ")")
            .attr("width", size)
            .attr("height", size)
            .attr("stroke", "gray")
            .attr("fill", "white")
            .attr("stroke-width", "2px");

        selection.append("rect")
            .attr("class", "checkmark")
            .attr("transform", "translate(6, " + (cellSize / 2 - (size - 2) / 2) + ")")
            .attr("width", size - 2)
            .attr("height", size - 2)
            .attr("fill", "blue")
            .attr("fill-opacity", 0.6)
            .attr("display", "none");

        g.selectAll(".checkbox").on("mouseover", function (event, d) {
            highlightNodes(d3.selectAll("#adm .nodes .left g").filter(x => x === d), d, edges, "left");
        }).on("mouseout", function () {
            removeHighlightedNodes();
        });

        g.selectAll(".checkbox").on("click", function () {
            if (d3.select(this).classed("checked")) {
                d3.select(this).classed("checked", false);
            } else {
                d3.select(this).classed("checked", true);
            }
        });
    }

    function enableNodeInteraction(node, grid, edges) {
        if (selectedNode !== null) {
            let selected;
            if (selectedNodeSide === "left") {
                selected = node.selectAll(".left g").filter(x => x.id === selectedNode.id);

            } else {
                selected = node.selectAll(".top g").filter(x => x.id === selectedNode.id);
            }
            fixHighlightedNodes(selected, selected.data()[0], edges, selectedNodeSide);
        }

        if (nodeEncoding === "juxta") { createNodeTooltip();}
        node.selectAll(".left g").on("mouseover", function (event, d) {
            highlightNodes(d3.select(this), d, edges, "left");
            if (nodeEncoding === "juxta") { showNodeTooltip(this, d, nodes); }
        });
        node.selectAll(".top g").on("mouseover", function (event, d) {
            highlightNodes(d3.select(this), d, edges, "top");
            if (nodeEncoding === "juxta") { hideNodeTooltip(); }
        });
        node.selectAll(".left g, .top g").on("mouseout", function () {
            removeHighlightedNodes();
        });

        node.selectAll(".left g").on("click", function (event, d) {
            fixHighlightedNodes(d3.select(this), d, edges, "left");
        });
        node.selectAll(".top g").on("click", function (event, d) {
            fixHighlightedNodes(d3.select(this), d, edges, "top");
        });
    }

    function enableGridInteraction(grid, positions, edges) {
        if (selectedEdge !== null) {
            grid.selectAll("g").filter(x => x === selectedEdge).classed("selectedEdge", true).classed("fixedEdge", true).classed("edgeHighlight", true);
            grid.selectAll("g").filter(x => x.source === selectedEdge.source || x.target === selectedEdge.target).classed("fixedEdge", true).classed("edgeHighlight", true);
            d3.selectAll("#adm .juxtatable .grid g").filter(x => x.id === selectedEdge.source).classed("fixedEdge", true).classed("edgeHighlight", true);
        }

        createEdgeTooltip();
        grid.selectAll("g").on("mouseover", function (event, d) {
            highlightEdges(d);
            showEdgeTooltip(this, d, positions, edges);
        }).on("mouseout", function () {
            removeHighlightedEdges();
            hideEdgeTooltip();
        });

        grid.selectAll("g").on("click", function (event, d) {
            fixHighlightedEdges(d3.select(this), d);
        });
    }
}


function changeNodeEncoding(encoding) {
    nodeEncoding = encoding;
}

function changeEdgeEncoding(encoding) {
    edgeEncoding = encoding;
}

function changeSelectedNodeAttribute(attr) {
    nodeAttribute = attr;
}

function changeSelectedEdgeAttribute(attr) {
    edgeAttribute = attr;
}

function changeSelectedNodeOrdering(attr) {
    ordering = attr;
}