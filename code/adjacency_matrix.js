// Visualization of the adjacency matrix

/**
 * This function appends the visualization of the network data in an adjacency matrix to the given g element.
 * The visualization is scaled to the provided width and height of the visualization space.
 * Possibilities for additional parameters of the encoding technique are described below:
 * @param og original g
 * @param width of the visualization space
 * @param height of the visualization space
 * @param data of network
 * @param nodeEncoding [plainNodes | coloredNodes | juxtaposedNodes]
 * @param edgeEncoding [plainEdges | coloredEdges | multipleEdges]
 * @param ordering of nodes, [Alphabetical | Mean | Degree | any node attribute]
 * @param nodeAttribute any node attribute for encoding
 * @param edgeAttribute any edge attribute for encoding
 * @param study indicates whether the study's visualization design is used
 * @param nodeShading
 */
function adjacencyMatrix(og, width, height, data, nodeEncoding, edgeEncoding, ordering, nodeAttribute, edgeAttribute, study = false, nodeShading = false) {
    let network = JSON.parse(JSON.stringify(data));
    let g = og.append("g").attr("transform", "translate(30, 20)"); // + 10 für checkbox

    // get node and edge categories
    const nodeAttributes = getAttributeLabels(network.nodes);
    const edgeAttributes = getAttributeLabels(network.edges);

    const triangle = d3.symbol().type(d3.symbolTriangle2);
    triangle.size(50);
    const path = triangle();

    if (!nodeAttributes.length) {
        nodeEncoding = "plainNodes";
    }
    if (!edgeAttributes.length) {
        edgeEncoding = "plainEdges";
    }

    // define size properties
    const cellSize = (height - 5) / (network.nodes.length + 1); // Math.min(50, height / (network.nodes.length + 1));

    const nodeBarWidth = (width - (network.nodes.length + 2) * cellSize - 10 * nodeAttributes.length) / nodeAttributes.length;
    const nodeBarDistance = nodeBarWidth + 10;
    const nodeBarHeight = 0.2 * cellSize;

    const edgeBarWidth = cellSize / edgeAttributes.length;

    const max_nameLength = Math.max(...network.nodes.map(n => n.name.length));
    const fontSize = study ? (network.nodes.length < 30 ? 14 : (network.nodes.length < 60 ? 12 : 10)) : (Math.min(max_nameLength < 7 ? 20 : 10, max_nameLength < 10 ? cellSize * 0.5 : cellSize * 0.25));

    // define scales on each attribute
    const nodeBarScales = defineScales(nodeAttributes, network.nodes, 1, nodeBarWidth);
    const nodeOpacityScales = defineScales(nodeAttributes, network.nodes, 0.5, 1);
    const modSet1 = ['#377eb8', '#984ea3', '#ff7f00', '#a65628', '#f781bf', '#999999']
    const nodeColors = d3.scaleOrdinal(modSet1).domain(nodeAttributes);

    const edgeSquareScales = defineScales(edgeAttributes, network.edges, 2, cellSize);
    const edgeBarScales = defineScales(edgeAttributes, network.edges, 0, cellSize); // study ? defineStandardScales(edgeAttributes, 0, cellSize) : defineScales(edgeAttributes, network.edges, 1, cellSize);
    const edgeOpacityScales = defineScales(edgeAttributes, network.edges, 0.5, 1);
    const modSet2 = ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3']
    const edgeColors = d3.scaleOrdinal(modSet2).domain(edgeAttributes);

    // apply node ordering
    switch (ordering) {
        case "Alphabetical" :
            sortAlphabetically(network.nodes);
            break;
        case "Mean" :
            sortByMean(network.nodes);
            break;
        case "Degree" :
            sortByDegree(network.nodes, network.edges);
            break;
        case "Edge Length" :
        case "RCM" :
            sortByRCM(network);
            break;
        default :
            if (nodeAttributes.includes(ordering)) {
                sortByAttribute(ordering, network.nodes);
            }
            break;
    }

    // define node positions
    const nodePositions = {};
    network.nodes.forEach(function (d, i) {
        nodePositions[d.id] = cellSize * i;
    });

    // append nodes to left header
    const leftNode = g.append("g")
        .attr("class", "ADMNodes left")
        .attr("transform", "translate(0, " + cellSize + ")")
        .selectAll("g")
        .data(network.nodes)
        .enter().append("g");

    leftNode.append("rect")
        .attr("width", cellSize)
        .attr("height", cellSize)
        .attr("y", function (d, i) {
            return cellSize * i;
        })
        .attr("fill", study ? "white" : "#e9ecef")
        .attr("stroke", study ? "white" : "black")
        .attr("stroke-width", "2px");

    leftNode.append("text")
        .attr("transform", function (d, i) {
            if (study) {
                return "translate(" + (cellSize - 5) + ", " + (cellSize * i + cellSize / 2) + ")";
            } else {
                return "translate(" + (cellSize / 2) + ", " + (cellSize * i + cellSize / 2) + ")" + (max_nameLength < 7 ? "" : "rotate(-45)");
            }
        })
        .text(function (d) {
            return d.name;
        })
        .attr("dy", ".35em")
        .attr("fill", "black")
        .attr("text-anchor", study ? "end" : "middle")
        .attr("font-size", fontSize);

    // append nodes to upper header
    const upperNode = g.append("g")
        .attr("class", "ADMNodes top")
        .attr("transform", "translate(" + cellSize + ", 0)")
        .selectAll("g")
        .data(network.nodes)
        .enter().append("g");

    upperNode.append("rect")
        .attr("width", cellSize)
        .attr("height", cellSize)
        .attr("x", function (d, i) {
            return cellSize * i;
        })
        .attr("fill", study ? "white" : "#e9ecef")
        .attr("stroke", study ? "white" : "black")
        .attr("stroke-width", "2px");

    upperNode.append("text")
        .attr("transform", function (d, i) {
            if (study) {
                return "translate(" + (cellSize * i + cellSize / 2) + ", " + (cellSize - 30) + ")" + "rotate(-90)";
            } else {
                return "translate(" + (cellSize * i + cellSize / 2) + ", " + (cellSize / 2) + ")" + (max_nameLength < 7 ? "" : "rotate(-45)");
            }
        })
        .text(function (d) {
            return d.name;
        })
        .attr("dy", ".35em")
        .attr("fill", "black")
        .attr("text-anchor", study ? "start" : "middle")
        .attr("font-size", fontSize);

    upperNode.append("path")
        .attr("d", path)
        .attr("class", "orderingButton")
        .attr("stroke", "gray")
        .attr("fill", "none")
        .attr("transform", function (d, i) {
            return "translate("+ (cellSize * i + cellSize/2) + " " + (cellSize - 15) + ") rotate(180 0 0)"
        });

    // apply encoding of node attributes
    switch (nodeEncoding) {
        case "plainNodes":
            break;
        case "coloredNodes":
            coloredNodes(nodeAttribute);
            break;
        case "juxtaposedNodes":
            juxtaposedNodeAttributes();
            break;
    }

    // append edges
    const doubled = network.edges.concat(network.edges.map(function (e) {
        return {"source": e.target, "target": e.source, "attributes": e.attributes};
    }));
    const edge = g.append("g")
        .attr("class", "ADMEdges")
        .attr("transform", "translate(" + cellSize + ", " + cellSize + ")")
        .selectAll("g")
        .data(doubled)
        .enter()
        .append("g")
        .raise();

    // apply encoding of edge attributes
    switch (edgeEncoding) {
        case "plainEdges":
            plainEdges();
            break;
        case "squaredEdges":
            oneEdgeAttribute(edgeAttribute);
            break;
        case "multipleEdges":
            if (edgeAttributes.length === 1) {
                oneEdgeAttribute(edgeAttribute);
            } else if (edgeAttributes.length === 2) {
                twoEdgeAttributes();
            } else {
                multipleEdgeAttributes();
            }
            break;
    }

    // overlay a grid
    const matrix = [];
    network.nodes.forEach(function (n1) {
        network.nodes.forEach(function (n2) {
            matrix.push({source: n1.id, target: n2.id});
        });
    });
    /*for (let i = 0; i <= network.nodes.length; i++) {
        for (let j = 0; j <= network.nodes.length; j++) {
            matrix.push({x: i * cellSize, y: j * cellSize, header: i === 0 || j === 0});
        }
    }
    matrix.shift();*/

    g.append("g")
        .attr("class", "ADMGrid")
        .attr("transform", "translate(" + cellSize + ", " + cellSize + ")")
        .attr("pointer-events", "all")
        .selectAll("g")
        .data(matrix)
        .enter()
        .append("g")
        .append("rect")
        .attr("x", function (d) {
            return nodePositions[d.source];
        })
        .attr("y", function (d) {
            return nodePositions[d.target];
        })
        .attr("width", cellSize)
        .attr("height", cellSize)
        .attr("fill", "none")
        .style("stroke-width", "1px")
        .style("stroke", d3.select("#colorpicker").empty() ? "black" : d3.select("#colorpicker").property("value"))
    if (nodeShading) {
        addNodeShading();
    }

    // highlighting of edges
    if (selectedEdge !== null) {
        g.selectAll(".ADMGrid").selectAll("g").filter(b => b === selectedEdge).classed("selectedEdge", true).classed("fixedEdge", true).classed("edgeHighlight", true);
        g.selectAll(".ADMGrid").selectAll("g").filter(b => b.source === selectedEdge.source || b.target === selectedEdge.target).classed("fixedEdge", true).classed("edgeHighlight", true);
    }

    g.selectAll(".ADMGrid").selectAll("g").on("mouseover", function (event, a) {
        g.selectAll(".ADMGrid").selectAll("g").filter(b => b.source === a.source || b.target === a.target).classed("edgeHighlight", true);
    }).on("mouseout", function () {
        g.selectAll(".ADMGrid").selectAll("g:not(.fixedEdge)").classed("edgeHighlight", false);
    });

    g.selectAll(".ADMGrid").selectAll("g").on("click", function (event, a) {
        if (d3.select(this).classed("selectedEdge")) {
            g.selectAll(".ADMGrid").selectAll("g").classed("fixedEdge", false).classed("selectedEdge", false);
            selectedEdge = null;
        } else {
            selectedEdge = a
            g.selectAll(".ADMGrid").selectAll("g").classed("fixedEdge", false).classed("selectedEdge", false).classed("edgeHighlight", false);
            d3.select(this).classed("selectedEdge", true).classed("fixedEdge", true).classed("edgeHighlight", true);
            g.selectAll(".ADMGrid").selectAll("g").filter(b => b.source === a.source || b.target === a.target).classed("fixedEdge", true).classed("edgeHighlight", true);
        }
    });

    // highlighting of nodes
    if (ADMNodeHighlighting === "row") {
        if (selectedNode !== null) {
            g.selectAll(".ADMNodes").selectAll("g").filter(n => n.id === selectedNode.id).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
            g.selectAll(".ADMGrid").selectAll("g").filter(e =>  e.target === selectedNode.id || e.source === selectedNode.id).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
            let adjacent = network.edges.filter(e => e.source === selectedNode.id).map(e => e.target)
                .concat(network.edges.filter(e => e.target === selectedNode.id).map(e => e.source));
            g.selectAll(".ADMNodes.left").selectAll("g").filter(n => adjacent.includes(n.id)).classed("fixedNode", true).classed("nodeHighlight", true);
            g.selectAll(".ADMGrid").selectAll("g").filter(e => adjacent.includes(e.target)).classed("fixedNode", true).classed("nodeHighlight", true);
            g.selectAll(".ADMBackground").selectAll("g").filter(n => adjacent.includes(n.id)).classed("fixedNode", true).classed("nodeHighlight", true);
            g.selectAll(".ADMBackground").selectAll("g").filter(n => n.id === selectedNode.id ).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
        }

        g.selectAll(".ADMNodes").selectAll("g").on("mouseover", function (event, a) {
            g.selectAll(".ADMNodes").selectAll("g").filter(n => n.id === a.id).classed("nodeHover", true);
            g.selectAll(".ADMGrid").selectAll("g").filter(e => e.source === a.id || e.target === a.id).classed("nodeHover", true);
            let adjacent = network.edges.filter(e => e.source === a.id).map(e => e.target)
                .concat(network.edges.filter(e => e.target === a.id).map(e => e.source));
            g.selectAll(".ADMNodes.left").selectAll("g").filter(n => adjacent.includes(n.id)).classed("nodeHighlight", true);
            g.selectAll(".ADMGrid").selectAll("g").filter(e => adjacent.includes(e.target)).classed("nodeHighlight", true);
            g.selectAll(".ADMBackground").selectAll("g").filter(n => adjacent.includes(n.id)).classed("nodeHighlight", true);
            g.selectAll(".ADMBackground").selectAll("g").filter(n => n.id === a.id ).classed("nodeHover", true);
        }).on("mouseout", function () {
            g.selectAll(".ADMNodes,.ADMGrid,.ADMBackground").selectAll("g:not(.fixedNode)").classed("nodeHover", false).classed("nodeHighlight", false);
            g.selectAll(".ADMNodes,.ADMGrid,.ADMBackground").selectAll("g:not(.selectedNode)").classed("nodeHover", false);
        });

        g.selectAll(".ADMNodes").selectAll("g").on("click", function (event, a) {
            if (d3.select(this).classed("selectedNode")) {
                d3.selectAll(".ADMNodes,.ADMGrid,.ADMBackground").selectAll("g").classed("fixedNode", false).classed("selectedNode", false);
                selectedNode = null;
            } else {
                selectedNode = a;
                d3.selectAll(".ADMNodes,.ADMGrid,.ADMBackground").selectAll("g").classed("fixedNode", false).classed("selectedNode", false).classed("nodeHighlight", false).classed("nodeHover", false);
                g.selectAll(".ADMNodes").selectAll("g").filter(n => n.id === a.id).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
                g.selectAll(".ADMGrid").selectAll("g").filter(e => e.target === a.id || e.source === a.id).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
                let adjacent = network.edges.filter(e => e.source === a.id).map(e => e.target)
                    .concat(network.edges.filter(e => e.target === a.id).map(e => e.source));
                g.selectAll(".ADMNodes.left").selectAll("g").filter(n => adjacent.includes(n.id)).classed("fixedNode", true).classed("nodeHighlight", true);
                g.selectAll(".ADMGrid").selectAll("g").filter(e => adjacent.includes(e.target)).classed("fixedNode", true).classed("nodeHighlight", true);
                g.selectAll(".ADMBackground").selectAll("g").filter(n => adjacent.includes(n.id)).classed("fixedNode", true).classed("nodeHighlight", true);
                g.selectAll(".ADMBackground").selectAll("g").filter(n => n.id === a.id ).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
            }
        });

    } else {
        if (selectedNode !== null) {
            if (selectedNodeSide === "top") {
                g.selectAll(".ADMNodes.top").selectAll("g").filter(b => b.id === selectedNode.id).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
                g.selectAll(".ADMGrid").selectAll("g").filter(e => e.source === selectedNode.id).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
                let adjacent = network.edges.filter(e => e.source === selectedNode.id).map(e => e.target)
                    .concat(network.edges.filter(e => e.target === selectedNode.id).map(e => e.source));
                g.selectAll(".ADMNodes.left").selectAll("g").filter(n => adjacent.includes(n.id)).classed("fixedNode", true).classed("nodeHighlight", true);
                g.selectAll(".ADMGrid").selectAll("g").filter(e => adjacent.includes(e.target)).classed("fixedNode", true).classed("nodeHighlight", true);
                g.selectAll(".ADMBackground").selectAll("g").filter(n => adjacent.includes(n.id)).classed("fixedNode", true).classed("nodeHighlight", true);
            } else {
                g.selectAll(".ADMNodes.left").selectAll("g").filter(b => b.id === selectedNode.id).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
                g.selectAll(".ADMGrid").selectAll("g").filter(e => e.target === selectedNode.id).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
                let adjacent = network.edges.filter(e => e.source === selectedNode.id).map(e => e.target)
                    .concat(network.edges.filter(e => e.target === selectedNode.id).map(e => e.source));
                g.selectAll(".ADMNodes.top").selectAll("g").filter(n => adjacent.includes(n.id)).classed("fixedNode", true).classed("nodeHighlight", true);
                g.selectAll(".ADMGrid").selectAll("g").filter(e => adjacent.includes(e.source)).classed("fixedNode", true).classed("nodeHighlight", true);
                g.selectAll(".ADMBackground").selectAll("g").filter(n => n === selectedNode).classed("fixedNode", true).classed("nodeHighlight", true);
            }
        }

        g.selectAll(".ADMNodes.top").selectAll("g").on("mouseover", function (event, a) {
            d3.select(this).classed("nodeHover", true);
            g.selectAll(".ADMGrid").selectAll("g").filter(e => e.source === a.id).classed("nodeHover", true);
            let adjacent = network.edges.filter(e => e.source === a.id).map(e => e.target)
                .concat(network.edges.filter(e => e.target === a.id).map(e => e.source));
            g.selectAll(".ADMNodes.left").selectAll("g").filter(n => adjacent.includes(n.id)).classed("nodeHighlight", true);
            g.selectAll(".ADMGrid").selectAll("g").filter(e => adjacent.includes(e.target)).classed("nodeHighlight", true);
            g.selectAll(".ADMBackground").selectAll("g").filter(n => adjacent.includes(n.id)).classed("nodeHighlight", true);
        });

        g.selectAll(".ADMNodes.left").selectAll("g").on("mouseover", function (event, a) {
            d3.select(this).classed("nodeHover", true);
            g.selectAll(".ADMGrid").selectAll("g").filter(e => e.target === a.id).classed("nodeHover", true);
            let adjacent = network.edges.filter(e => e.source === a.id).map(e => e.target)
                .concat(network.edges.filter(e => e.target === a.id).map(e => e.source));
            g.selectAll(".ADMNodes.top").selectAll("g").filter(n => adjacent.includes(n.id)).classed("nodeHighlight", true);
            g.selectAll(".ADMGrid").selectAll("g").filter(e => adjacent.includes(e.source)).classed("nodeHighlight", true);
            g.selectAll(".ADMBackground").selectAll("g").filter(n => n === a).classed("nodeHighlight", true);
        });

        g.selectAll(".ADMNodes").selectAll("g").on("mouseout", function () {
            g.selectAll(".ADMNodes,.ADMGrid,.ADMBackground").selectAll("g:not(.fixedNode)").classed("nodeHover", false).classed("nodeHighlight", false);
            g.selectAll(".ADMNodes,.ADMGrid,.ADMBackground").selectAll("g:not(.selectedNode)").classed("nodeHover", false);
        });

        g.selectAll(".ADMNodes.top").selectAll("g").on("click", function (event, a) {
            if (d3.select(this).classed("selectedNode")) {
                d3.selectAll(".ADMNodes,.ADMGrid,.ADMBackground").selectAll("g").classed("fixedNode", false).classed("selectedNode", false);
                selectedNode = null;
            } else {
                selectedNode = a;
                selectedNodeSide = "top";
                d3.selectAll(".ADMNodes,.ADMGrid,.ADMBackground").selectAll("g").classed("fixedNode", false).classed("selectedNode", false).classed("nodeHighlight", false).classed("nodeHover", false);
                d3.select(this).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
                g.selectAll(".ADMGrid").selectAll("g").filter(e => e.source === a.id).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
                let adjacent = network.edges.filter(e => e.source === a.id).map(e => e.target)
                    .concat(network.edges.filter(e => e.target === a.id).map(e => e.source));
                g.selectAll(".ADMNodes.left").selectAll("g").filter(n => adjacent.includes(n.id)).classed("fixedNode", true).classed("nodeHighlight", true);
                g.selectAll(".ADMGrid").selectAll("g").filter(e => adjacent.includes(e.target)).classed("fixedNode", true).classed("nodeHighlight", true);
                g.selectAll(".ADMBackground").selectAll("g").filter(n => adjacent.includes(n.id)).classed("fixedNode", true).classed("nodeHighlight", true);
            }
        });

        g.selectAll(".ADMNodes.left").selectAll("g").on("click", function (event, a) {
            if (d3.select(this).classed("selectedNode")) {
                d3.selectAll(".ADMNodes,.ADMGrid,.ADMBackground").selectAll("g").classed("fixedNode", false).classed("selectedNode", false);
                selectedNode = null;
            } else {
                selectedNode = a;
                selectedNodeSide = "left";
                d3.selectAll(".ADMNodes,.ADMGrid,.ADMBackground").selectAll("g").classed("fixedNode", false).classed("selectedNode", false).classed("nodeHighlight", false).classed("nodeHover", false);
                d3.select(this).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
                g.selectAll(".ADMGrid").selectAll("g").filter(e => e.target === a.id).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
                let adjacent = network.edges.filter(e => e.source === a.id).map(e => e.target)
                    .concat(network.edges.filter(e => e.target === a.id).map(e => e.source));
                g.selectAll(".ADMNodes.top").selectAll("g").filter(n => adjacent.includes(n.id)).classed("fixedNode", true).classed("nodeHighlight", true);
                g.selectAll(".ADMGrid").selectAll("g").filter(e => adjacent.includes(e.source)).classed("fixedNode", true).classed("nodeHighlight", true);
                g.selectAll(".ADMBackground").selectAll("g").filter(n => n === a).classed("fixedNode", true).classed("nodeHighlight", true);
            }
        });
    }

    // sort on attributes based on click
    g.selectAll(".ADMLabels").selectAll("g").on("click", function (event, a) {
        og.selectAll("*").remove();
        ADMNodeOrdering = a
        console.log(ADMNodeOrdering)
        adjacencyMatrix(og, width, height, data, nodeEncoding, edgeEncoding, ADMNodeOrdering, nodeAttribute, edgeAttribute, study, nodeShading)
        d3.select(".ADMGrid").selectAll("rect").style("stroke", d3.select("#colorpicker").empty() ? "black" : d3.select("#colorpicker").property("value"));
    });

    // sort nodes alphabetically
    let sort = g.append("g").attr("id", "sortButton").attr("transform", "translate(" + (cellSize - 57) + " " + (cellSize - 22) + ")");
    sort.append("rect")
        .attr("width", 55)
        .attr("height", 20)
        .style("fill", "none")
        .style("stroke", "black")
        .style("stroke-width", "1px");
    sort.append("text")
        .text("Name")
        .attr("x", 5)
        .attr("y", 14)
        .attr("font-size", 12);

    sort.append("path")
        .attr("d", path)
        .attr("stroke", "gray")
        .attr("fill", "none")
        .attr("transform", "translate(46 8) rotate(180 0 0)");

    g.select("#sortButton").on("click", function () {
        og.selectAll("*").remove();
        ADMNodeOrdering = "Alphabetical";
        adjacencyMatrix(og, width, height, data, nodeEncoding, edgeEncoding, ADMNodeOrdering, nodeAttribute, edgeAttribute, study, nodeShading)
        d3.select(".ADMGrid").selectAll("rect").style("stroke", d3.select("#colorpicker").empty() ? "black" : d3.select("#colorpicker").property("value"));
    });

    g.select(".orderingButton").on("hover", function () {
        console.log("here")});

    // checkbox
    let checkbox = g.append("g")
        .attr("id", "ADMSelection")
        .attr("transform", "translate(" + (cellSize - 60 - 2 / 3 * cellSize) + " " + (cellSize * 1.167) + ")")
        .selectAll("g")
        .data(network.nodes)
        .enter()
        .append("g")
        .attr("class", "checkbox");

    checkbox.append("rect")
        .attr("width", 2 * cellSize / 3)
        .attr("height", 2 * cellSize / 3)
        .attr("y", function (d, i) {
            return cellSize * i;
        })
        .style("stroke", "black")
        .style("fill", "white")
        .style("stroke-width", "2px");

    checkbox.append("rect")
        .attr("class", "checkmark")
        .attr("transform", "translate(" + (cellSize / 9) + " " + (cellSize / 9) + ")")
        .attr("width", 4 * cellSize / 9)
        .attr("height", 4 * cellSize / 9)
        .attr("y", function (d, i) {
            return cellSize * i;
        })
        .style("fill", "blue")
        .style("fill-opacity", 0.6)
        .attr("display", "none");

    g.selectAll(".checkbox").on("click", function () {
        if (d3.select(this).classed("checked")) {
            d3.select(this).classed("checked", false);
        } else {
            d3.select(this).classed("checked", true);
        }
    });

    // push edges of node to top



    /**
     * This function colors nodes based on the given attribute. Nodes that do not share this attribute remain plain.
     * The attribute value is encoded using opacity.
     * @param attr
     */
    function coloredNodes(attr) {
        d3.selectAll(".ADMNodes").selectAll("g").selectAll("rect")
            .style("fill", function (d) {
                return attr in d.attributes ? nodeColors(attr) : "#e9ecef";
            })
            .style("fill-opacity", function (d) {
                return attr in d.attributes ? nodeOpacityScales[attr](d.attributes[attr]) : 1;
            });
    }

    /**
     * This function encodes the node attributes in a juxtaposed table aligned to the left nodes.
     */
    function juxtaposedNodeAttributes() {
        // create background
        const background = g.append("g")
            .attr("class", "ADMBackground")
            .attr("transform", "translate(" + ((network.nodes.length + 2) * cellSize) + ", " + cellSize + ")")
            .selectAll("g")
            .data(network.nodes)
            .enter()
            .append("g");

        nodeAttributes.forEach(function (d, i) {
            background.append("rect")
                .attr("width", nodeBarWidth + 4)
                .attr("height", cellSize - 3)
                .attr("x", nodeBarDistance * i - 2)
                .attr("y", function (d) {
                    return nodePositions[d.id]
                })
                .attr("fill", "#e9ecef");
        })

        let labels = g.append("g")
            .attr("class", "ADMLabels")
            .attr("transform", "translate(" + ((network.nodes.length + 2) * cellSize) + ", " + (cellSize / 2) + ")")
            .selectAll("g")
            .data(nodeAttributes)
            .enter().append("g")

        labels.append("text")
            .text(function (d) {
                return d;
            })
            .attr("x", function (d, i) {
                return nodeBarDistance * (i + 0.5) - 10;
            })
            .style("text-anchor", "middle")
            .style("font-size", fontSize);

        labels.append("path")
            .attr("d", path)
            .attr("stroke", "gray")
            .attr("fill", "none")
            .attr("transform", function (d, i) {
                return "translate(" + (nodeBarDistance * (i + 0.7))+ "-5) rotate(180 0 0)"
            });

        // append a table for representation of attributes
        const table = g.append("g")
            .attr("class", "ADMAttributes")
            .attr("transform", "translate(" + ((network.nodes.length + 2) * cellSize) + ", " + cellSize + ")")
            .selectAll("g")
            .data(network.nodes)
            .enter().append("g");

        table.each(function (n, i) {
            for (let [j, attr] of Object.entries(nodeAttributes)) {
                if (attr in n.attributes) {
                    // add a base for the bars
                    d3.select(this).append("line")
                        .attr("transform", "translate(" + (nodeBarDistance * j) + ", 0)")
                        .attr("class", "ADMBase")
                        .attr("x1", 0)
                        .attr("y1", i * cellSize + cellSize / 2)
                        .attr("x2", nodeBarWidth)
                        .attr("y2", i * cellSize + cellSize / 2)
                        .style("stroke-opacity", 0.5)
                        .style("stroke-width", nodeBarHeight)
                        .style("stroke", nodeColors(attr))
                        .raise();

                    // add bars encoding the numerical attribute
                    d3.select(this).append("line")
                        .attr("transform", "translate(" + (nodeBarDistance * j) + ", 0)")
                        .attr("class", "ADMAttribute")
                        .attr("x1", 0)
                        .attr("y1", i * cellSize + cellSize / 2)
                        .attr("x2", nodeBarScales[attr](n.attributes[attr]))
                        .attr("y2", i * cellSize + cellSize / 2)
                        .style("stroke-width", nodeBarHeight)
                        .style("stroke", nodeColors(attr))
                        .raise();
                }
            }
        });
    }

    /**
     * This function fills the edge cells without encoding an attribute.
     */
    function plainEdges() {
        edge.append("rect")
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("x", function (d) {
                return nodePositions[d.source];
            })
            .attr("y", function (d) {
                return nodePositions[d.target];
            })
            .style("fill", "gray");

        /*// repeat with swapped source and target
        edge.append("rect")
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("x", function (d) {
                return nodePositions[d.target];
            })
            .attr("y", function (d) {
                return nodePositions[d.source];
            })
            .style("fill", "gray");*/
    }

    /**
     * This function encodes one given edge attribute by mapping the value to the size of the square filled in corresponding hue.
     * Nodes that do not share this attribute remain plain.
     * @param attr
     */
    function oneEdgeAttribute(attr) {
        plainEdges();
        edge.selectAll("rect")
            .attr("width", function (d) {
                return attr in d.attributes ? edgeSquareScales[attr](d.attributes[attr]) : cellSize;
            })
            .attr("height", function (d) {
                return attr in d.attributes ? edgeSquareScales[attr](d.attributes[attr]) : cellSize;
            })
            .attr("transform", function (d) {
                return attr in d.attributes ? "translate(" + (cellSize / 2 - edgeSquareScales[attr](d.attributes[attr]) / 2) + ", "
                    + (cellSize / 2 - edgeSquareScales[attr](d.attributes[attr]) / 2) + ")" : "translate(0, 0)";
            })
            .style("fill", function (d) {
                return attr in d.attributes ? edgeColors(attr) : "gray";
            });
    }

    /**
     * This function divides the cell into inner and outer square to encode two attributes.
     * The space is filled by differentiating hue and the attribute value is encoded by opacity.
     */
    function twoEdgeAttributes() {
        // encode first attribute in outer space
        let first = edgeAttributes[0];
        edge.append("rect")
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("x", function (d) {
                return nodePositions[d.source];
            })
            .attr("y", function (d) {
                return nodePositions[d.target];
            })
            .style("fill", edgeColors(first))
            .style("fill-opacity", function (d) {
                return first in d.attributes ? edgeOpacityScales[first](d.attributes[first]) : 0;
            });

        edge.append("rect")
            .attr("width", cellSize / 2)
            .attr("height", cellSize / 2)
            .attr("x", function (d) {
                return nodePositions[d.source] + cellSize / 4;
            })
            .attr("y", function (d) {
                return nodePositions[d.target] + cellSize / 4;
            })
            .style("fill", "white");

        // encode second attribute in inner space
        let second = edgeAttributes[1];
        edge.append("rect")
            .attr("width", cellSize / 2)
            .attr("height", cellSize / 2)
            .attr("x", function (d) {
                return nodePositions[d.source] + cellSize / 4;
            })
            .attr("y", function (d) {
                return nodePositions[d.target] + cellSize / 4;
            })
            .style("fill", edgeColors(second))
            .style("fill-opacity", function (d) {
                return second in d.attributes ? edgeOpacityScales[second](d.attributes[second]) : 0;
            });

        /*// repeat with swapped source and target
        edge.append("rect")
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("x", function (d) {
                return nodePositions[d.target];
            })
            .attr("y", function (d) {
                return nodePositions[d.source];
            })
            .style("fill", edgeColors(first))
            .style("fill-opacity", function (d) {
                return first in d.attributes ? edgeOpacityScales[first](d.attributes[first]) : 0;
            });

        edge.append("rect")
            .attr("width", cellSize / 2)
            .attr("height", cellSize / 2)
            .attr("x", function (d) {
                return nodePositions[d.target] + cellSize / 4;
            })
            .attr("y", function (d) {
                return nodePositions[d.source] + cellSize / 4;
            })
            .style("fill", "white");

        edge.append("rect")
            .attr("width", cellSize / 2)
            .attr("height", cellSize / 2)
            .attr("x", function (d) {
                return nodePositions[d.target] + cellSize / 4;
            })
            .attr("y", function (d) {
                return nodePositions[d.source] + cellSize / 4;
            })
            .style("fill", edgeColors(second))
            .style("fill-opacity", function (d) {
                return second in d.attributes ? edgeOpacityScales[second](d.attributes[second]) : 0;
            });*/
    }

    /**
     * This function encodes multiple edge attribute in a bar chart. Existing edge attributes are emphasised by a base of low opacity behind the actual bar.
     */
    function multipleEdgeAttributes() {
        edge.each(function (e) {
            for (let [i, attr] of Object.entries(edgeAttributes)) {
                if (attr in e.attributes) {
                    d3.select(this).append("rect")
                        .attr("class", "ADMEdgeBase")
                        .attr("width", edgeBarWidth)
                        .attr("height", cellSize)
                        .attr("x", function (d) {
                            return nodePositions[d.source] + i * edgeBarWidth;
                        })
                        .attr("y", function (d) {
                            return nodePositions[d.target];
                        })
                        .style("fill", edgeColors(attr))
                        .style("fill-opacity", 0.3);

                    d3.select(this).append("rect")
                        .attr("class", "ADMEdgeAttribute")
                        .attr("width", edgeBarWidth)
                        .attr("height", function (d) {
                            return edgeBarScales[attr](d.attributes[attr]);
                        })
                        .attr("x", function (d) {
                            return nodePositions[d.source] + i * edgeBarWidth;
                        })
                        .attr("y", function (d) {
                            return (nodePositions[d.target] + cellSize) - edgeBarScales[attr](d.attributes[attr]);
                        })
                        .style("fill", edgeColors(attr));

                    // repeat with swapped source and target
                    /*d3.select(this).append("rect")
                        .attr("class", "ADMEdgeBase")
                        .attr("width", edgeBarWidth)
                        .attr("height", cellSize)
                        .attr("x", function (d) {
                            return nodePositions[d.target] + i * edgeBarWidth;
                        })
                        .attr("y", function (d) {
                            return nodePositions[d.source];
                        })
                        .style("fill", edgeColors(attr))
                        .style("fill-opacity", 0.2);

                    d3.select(this).append("rect")
                        .attr("class", "ADMEdgeAttribute")
                        .attr("width", edgeBarWidth)
                        .attr("height", function (d) {
                            return edgeBarScales[attr](d.attributes[attr]);
                        })
                        .attr("x", function (d) {
                            return nodePositions[d.target] + i * edgeBarWidth;
                        })
                        .attr("y", function (d) {
                            return (nodePositions[d.source] + cellSize) - edgeBarScales[attr](d.attributes[attr]);
                        })
                        .style("fill", edgeColors(attr));*/
                }
            }

            // visualize edges without attributes as plain edges
            if (!Object.keys(e.attributes).length) {
                d3.select(this).append("rect")
                    .attr("width", cellSize)
                    .attr("height", cellSize)
                    .attr("x", function (d) {
                        return nodePositions[d.source];
                    })
                    .attr("y", function (d) {
                        return nodePositions[d.target];
                    })
                    .style("fill", "gray");

                /*// repeat with swapped source and target
                d3.select(this).append("rect")
                    .attr("width", cellSize)
                    .attr("height", cellSize)
                    .attr("x", function (d) {
                        return nodePositions[d.target];
                    })
                    .attr("y", function (d) {
                        return nodePositions[d.source];
                    })
                    .style("fill", "gray");*/
            }
        });
    }

    function addNodeShading() {
        g.selectAll(".left").selectAll("g:nth-child(2n)")
            .append("rect")
            .attr("class", "ADMNodeShading")
            .attr("width", cellSize * network.nodes.length)
            .attr("height", cellSize)
            .attr("x", cellSize)
            .attr("y", function (_, i) {
                return cellSize * 2 * i;
            })
            .style("fill", "gray")
            .style("opacity", 0.1)
            .lower();
    }
}