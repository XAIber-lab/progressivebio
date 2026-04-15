// Visualization of the BioFabric

/**
 * This function appends the visualization of the network data in a BioFabric to the given g element.
 * The visualization is scaled to the provided width and height of the visualization space.
 * Possibilities for additional parameters of the encoding technique are described below:
 * @param og
 * @param width of the visualization space
 * @param height of the visualization space
 * @param data of network
 * @param nodeEncoding [plainNodes | coloredCircles | barsOnNodes | coloredLines | parallelLines | barsOnLines | juxtaposedNodes]
 * @param edgeEncoding [plainEdges | parallelEdges | barsOnEdges | juxtaposedEdges | parallelAndJuxtaposed | barsAndJuxtaposed]
 * @param nodeOrdering [Alphabetical | Mean | Degree | Edge Length | any node attribute]
 * @param edgeOrdering [Nodes | Mean | any ede attribute]
 * @param nodeAttribute any node attribute for encoding
 * @param edgeAttribute any node attribute for encoding
 * @param study indicates whether the study's visualization design is used
 * @param nodeShading
 * @param edgeShading
 * @param doubleEdges
 */
function bioFabric(og, width, height, data, nodeEncoding, edgeEncoding, nodeOrdering, edgeOrdering, nodeAttribute,
                   edgeAttribute, study = false, nodeShading = false, edgeShading = false, doubleEdges = false) {
    let network = JSON.parse(JSON.stringify(data));
    let g = og.append("g").attr("transform", "translate(50, 0)"); // + 10 für checkbox

    // get node and edge categories
    const nodeAttributes = getAttributeLabels(network.nodes);
    const edgeAttributes = getAttributeLabels(network.edges);

    if (!study) {
        edgeAttributes.sort();
    }

    if (!nodeAttributes.length) {
        nodeEncoding = "plainNodes";
    }
    if (!edgeAttributes.length) {
        edgeEncoding = "plainEdges";
    }

    // define size properties
    const widthForEdges = nodeEncoding === "juxtaposedNodes" ? 0.6 * width : width - 40;

    const nodeDistance = (["juxtaposedEdges", "parallelAndJuxtaposed", "barsAndJuxtaposed"].includes(edgeEncoding) ? 2 / 3 * height : height - 40) / network.nodes.length;
    const nodeBarWidth = (0.4 * width - 60) / nodeAttributes.length - 10;
    const nodeBarDistance = nodeBarWidth + 10;
    const nodeBarHeight = Math.min(10, nodeDistance / 4);
    const min_nodeRadius = nodeDistance * 0.2;
    const max_nodeRadius = nodeDistance * 0.4;
    const nodeSize = nodeDistance * 0.9;
    const inNodeBarHeight = 0.6 * nodeSize;
    const inNodeBarWidth = nodeSize / nodeAttributes.length - 2;
    const inNodeBarDistance = inNodeBarWidth + 2;
    const min_nodeWidth = 1;
    const max_nodeWidth = Math.max(1, Math.min(10, nodeDistance * 2 / (3 * (nodeAttributes.length - 2))));
    const onNodeSpace = 0.1 * widthForEdges;
    const onNodeBarHeight = Math.max(1, Math.min(30, nodeDistance * 0.8));
    const onNodeBarWidth = Math.max(1, Math.min(10, onNodeSpace / nodeAttributes.length - 2));
    const onNodeBarDistance = onNodeBarWidth + 2;

    const squareSize = Math.min(15, Math.max(3, (widthForEdges - 30) / network.edges.length - 2), Math.max(3, nodeDistance * 0.5 - 2));
    const min_edgeWidth = Math.max(1, Math.min(5, (widthForEdges - 30) / network.edges.length / edgeAttributes.length - 2));
    const max_edgeWidth = Math.max(1, Math.min(10, (widthForEdges - 30) / network.edges.length / edgeAttributes.length - 2));
    const edgeBarWidth = (1 / 3 * height - 40) / edgeAttributes.length - 10;
    const edgeBarDistance = edgeBarWidth + 10;
    const edgeBarHeight = squareSize; // (widthForEdges - 30) / network.edges.length - 2;

    const nameLength = Math.max(...network.nodes.map(n => n.name.length));
    const fontSize = study ? (network.nodes.length < 30 ? 14 : (network.nodes.length < 60 ? 12 : 10)) : (Math.min(nameLength < 7 ? 20 : 10, nameLength < 10 ? nodeDistance * 0.5 : nodeDistance * 0.4));
    const smallFontSize = Math.min(nameLength < 10 ? 10 : 5, nodeSize * 0.25);
    const categoriesFontSize = study ? fontSize : 10;

    // define scales on each attribute
    const nodeRadiusScales = defineScales(nodeAttributes, network.nodes, min_nodeRadius, max_nodeRadius);
    const nodeBarScales = defineScales(nodeAttributes, network.nodes, 1, nodeBarWidth);
    const nodeWidthScales = defineScales(nodeAttributes, network.nodes, min_nodeWidth, max_nodeWidth);
    const inNodeBarScales = defineScales(nodeAttributes, network.nodes, 1, inNodeBarHeight);
    const onNodeBarScales = defineScales(nodeAttributes, network.nodes, 1, onNodeBarHeight);
    const nodeCurveScales = defineScales(nodeAttributes, network.nodes, -nodeDistance / 3, nodeDistance / 3);
    const nodeDashScales = defineScales(nodeAttributes, network.nodes, 10, 0);
    const modSet1 = ['#377eb8', '#984ea3', '#ff7f00', '#a65628', '#f781bf', '#999999']
    const nodeColors = d3.scaleOrdinal(modSet1).domain(nodeAttributes);

    const edgeWidthScales = defineScales(edgeAttributes, network.edges, min_edgeWidth, max_edgeWidth);
    const edgeBarScales = defineScales(edgeAttributes, network.edges, 0, edgeBarWidth); // study ? defineStandardScales(edgeAttributes, 0, edgeBarWidth) : defineScales(edgeAttributes, network.edges, 1, edgeBarWidth);
    const edgeDashScales = defineScales(edgeAttributes, network.edges, 10, 0);
    const modSet2 = ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3']
    const edgeColors = d3.scaleOrdinal(modSet2).domain(edgeAttributes);

    // apply node and edge ordering
    switch (nodeOrdering) {
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
            if (nodeAttributes.includes(nodeOrdering)) {
                sortByAttribute(nodeOrdering, network.nodes);
            }
            break;
    }

    if (doubleEdges) {
        network.edges = network.edges.concat(network.edges.map(function (d) {
            let e = {};
            e.source = d.target;
            e.target = d.source;
            e.attributes = d.attributes;
            return e;
        }));
    }

    switch (edgeOrdering) {
        case "Nodes" :
            sortByNodes(network.nodes, network.edges);
            break;
        case "Mean" :
            sortByMean(network.edges);
            break;
        default :
            if (edgeAttributes.includes(edgeOrdering)) {
                sortByNodes(network.nodes, network.edges);
                sortByAttribute(edgeOrdering, network.edges);
            } else if (Array.isArray(edgeOrdering) && edgeOrdering.map(a => edgeAttributes.includes(a)).every(Boolean)) {
                sortByNodes(network.nodes, network.edges);
                sortByTwoAttributes(edgeOrdering, network.edges);
            }
            break;
    }

    if (doubleEdges) {
        sortBySourceNodes(network.nodes, network.edges);
    }

    // define node and edge positions
    const nodePositions = function (id) {
        return network.nodes.map(n => n.id).indexOf(id) * nodeDistance;
    };

    const edgePositions = d3.scaleLinear()
        .domain([0, network.edges.length - 1])
        .range([nodeEncoding === "barsOnLines" ? onNodeSpace : 0, widthForEdges - (edgeEncoding === "barsOnEdges" ? 55 : 30)]);
    const edgeDistance = edgePositions(1) - edgePositions(0);
    const edgeCurveScales = defineScales(edgeAttributes, network.edges, -edgeDistance / 3, edgeDistance / 3);
    const onEdgeBarGap = study ? 0 : 2;
    const onEdgeBarWidth = Math.max(1, Math.min(15, (nodeDistance - squareSize - ((study && onEdgeBarGap === 0) ? 2 : edgeAttributes.length * onEdgeBarGap)) / edgeAttributes.length));
    const onEdgeBarDistance = onEdgeBarWidth + onEdgeBarGap;
    const onEdgeBarHeight = Math.max(1, Math.min(60, (study && edgeDistance - squareSize < 7) ? edgeDistance - 1 : edgeDistance - squareSize));
    const onEdgeBarScales = defineScales(edgeAttributes, network.edges, 0, onEdgeBarHeight); // study ? defineStandardScales(edgeAttributes, 0, onEdgeBarHeight) : defineScales(edgeAttributes, network.edges, 1, onEdgeBarHeight);

    // append node lines
    const node = g.append("g")
        .attr("class", "BFNodes")
        .attr("transform", "translate(40, 40)")
        .selectAll("g")
        .data(network.nodes)
        .enter().append("g");

    node.append("line")
        .attr("class", "BFNodeLine")
        .attr("y1", function (d) {
            return nodePositions(d.id);
        })
        .attr("x2", widthForEdges)
        .attr("y2", function (d) {
            return nodePositions(d.id);
        })
        .attr("fill", "none")
        .attr("stroke", "gray");

    // apply encoding of node attributes
    switch (nodeEncoding) {
        case "plainNodes":
            plainNodes();
            break;
        case "coloredCircles":
            coloredNodeCircles(nodeAttribute);
            break;
        case "barsOnNodes" :
            barsOnNodes();
            break;
        case "coloredLines":
            coloredNodeLines(nodeAttribute);
            break;
        case "parallelLines":
            parallelNodeLines();
            break;
        case "curvedLines":
            curvedNodeLines();
            break;
        case "dashedLines":
            dashedNodeLines();
            break;
        case "barsOnLines":
            barsOnNodeLines();
            break;
        case "juxtaposedNodes":
            juxtaposedNodeAttributes();
            break;
    }

    // apply encoding of edge attributes
    switch (edgeEncoding) {
        case "plainEdges":
            plainEdges();
            break;
        case "coloredEdges":
            coloredEdgeLines(edgeAttribute);
            break;
        case "parallelEdges":
            parallelEdges();
            break;
        case "curvedEdges":
            curvedEdges();
            break;
        case "dashedEdges":
            dashedEdges();
            break;
        case "barsOnEdges":
            barsOnEdges();
            break;
        case "juxtaposedEdges":
            plainEdges();
            juxtaposedEdgeAttributes();
            break;
        case "parallelAndJuxtaposed":
            parallelEdges();
            juxtaposedEdgeAttributes();
            break;
        case "barsAndJuxtaposed":
            barsOnEdges();
            juxtaposedEdgeAttributes();
            break;
    }
    addSquares();

    switch (nodeShading) {
        case "background":
            addNodeShadingToBackground();
            break;
        case "line":
            addNodeShadingToLine();
            break;
    }
    switch (edgeShading) {
        case "background":
            addEdgeShadingToBackground();
            break;
        case "line":
            if (!["coloredEdges", "parallelEdges", "curvedEdges", "parallelAndJuxtaposed"].includes(edgeEncoding)) {
                addEdgeShadingToLine();
            }
            break;
    }

    // highlighting of nodes
    let backgroundNodeHighlight = node.append("rect")
        .attr("class", "BFNodeHighlight")
        .attr("y", function (d) {
            return nodePositions(d.id) - nodeDistance * 0.25;
        })
        .attr("width", widthForEdges)
        .attr("height", nodeDistance * 0.5)
        .attr("pointer-events", "all")
        .lower();

    if (BFNodeHighlighting === "line") {
        backgroundNodeHighlight.style("fill", "none");
    } else {
        backgroundNodeHighlight.attr("fill", "none")
    }

    if (selectedNode !== null) {
        g.selectAll(".BFNodes").selectAll("g").filter(b => selectedNode.id === b.id).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
        let adjacentNodes = network.edges.filter(e => e.source === selectedNode.id).map(e => e.target)
            .concat(network.edges.filter(e => e.target === selectedNode.id).map(e => e.source));
        g.selectAll(".BFNodes").selectAll("g").filter(n => adjacentNodes.includes(n.id)).classed("fixedNode", true).classed("nodeHighlight", true);
        let adjacentEdges = network.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id);
        g.selectAll(".BFEdges").selectAll("g").filter(e => adjacentEdges.includes(e)).classed("fixedNode", true).classed("nodeHighlight", true);
        g.selectAll(".BFNodeBackground").selectAll("g").filter(n => n.id === selectedNode.id || adjacentNodes.includes(n.id)).classed("fixedNode", true).classed("nodeHighlight", true);
        g.selectAll(".BFEdgeBackground").selectAll("g").filter(e => adjacentEdges.includes(e)).classed("fixedNode", true).classed("nodeHighlight", true);

    }

    g.selectAll(".BFNodes").selectAll("g").on("mouseover", function (event, a) {
        d3.select(this).classed("nodeHover", true);
        let adjacentNodes = network.edges.filter(e => e.source === a.id).map(e => e.target)
            .concat(network.edges.filter(e => e.target === a.id).map(e => e.source));
        g.selectAll(".BFNodes").selectAll("g").filter(n => adjacentNodes.includes(n.id)).classed("nodeHighlight", true);
        let adjacentEdges = network.edges.filter(e => e.source === a.id || e.target === a.id);
        g.selectAll(".BFEdges").selectAll("g").filter(e => adjacentEdges.includes(e)).classed("nodeHighlight", true);
        g.selectAll(".BFNodeBackground").selectAll("g").filter(n => n === a || adjacentNodes.includes(n.id)).classed("nodeHighlight", true);
        g.selectAll(".BFEdgeBackground").selectAll("g").filter(e => adjacentEdges.includes(e)).classed("nodeHighlight", true);
    }).on("mouseout", function () {
        g.selectAll(".BFNodes,.BFEdges,.BFNodeBackground,.BFEdgeBackground,.BFNodeHighlight").selectAll("g:not(.fixedNode)").classed("nodeHighlight", false).classed("nodeHover", false);
    });

    g.selectAll(".BFNodes").selectAll("g").on("click", function (event, a) {
        if (d3.select(this).classed("selectedNode")) {
            d3.selectAll(".BFNodes,.BFEdges,.BFNodeBackground,.BFEdgeBackground,.BFNodeHighlight").selectAll("g").classed("fixedNode", false).classed("selectedNode", false);
            selectedNode = null;
        } else {
            selectedNode = a;
            d3.selectAll(".BFNodes,.BFEdges,.BFNodeBackground,.BFEdgeBackground,.BFNodeHighlight").selectAll("g").classed("fixedNode", false).classed("selectedNode", false).classed("nodeHighlight", false).classed("nodeHover", false);
            d3.select(this).classed("selectedNode", true).classed("fixedNode", true).classed("nodeHover", true);
            let adjacentNodes = network.edges.filter(e => e.source === a.id).map(e => e.target)
                .concat(network.edges.filter(e => e.target === a.id).map(e => e.source));
            g.selectAll(".BFNodes").selectAll("g").filter(n => adjacentNodes.includes(n.id)).classed("fixedNode", true).classed("nodeHighlight", true);
            let adjacentEdges = network.edges.filter(e => e.source === a.id || e.target === a.id);
            g.selectAll(".BFEdges").selectAll("g").filter(e => adjacentEdges.includes(e)).classed("fixedNode", true).classed("nodeHighlight", true);
            g.selectAll(".BFNodeBackground").selectAll("g").filter(n => n === a || adjacentNodes.includes(n.id)).classed("fixedNode", true).classed("nodeHighlight", true);
            g.selectAll(".BFEdgeBackground").selectAll("g").filter(e => adjacentEdges.includes(e)).classed("fixedNode", true).classed("nodeHighlight", true);
        }
    });

    // highlighting of edges
    g.selectAll(".BFEdges")
        .selectAll("g")
        .append("rect")
        .attr("class", "BFEdgeHighlight")
        .attr("y", function (d) {
            return nodePositions(d.source) > nodePositions(d.target) ? nodePositions(d.target) : nodePositions(d.source);
        })
        .attr("x", function (d, i) {
            return edgePositions(i) - edgeDistance * 0.25;
        })
        .attr("width", edgeDistance * 0.5)
        .attr("height", function (d) {
            return nodePositions(d.source) > nodePositions(d.target) ? (nodePositions(d.source) - nodePositions(d.target)) : (nodePositions(d.target) - nodePositions(d.source));
        })
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .lower();

    if (selectedEdge !== null) {
        g.selectAll(".BFEdges").selectAll("g").filter(b => b.target === selectedEdge.target && b.source === selectedEdge.source).classed("selectedEdge", true).classed("fixedEdge", true).classed("edgeHover", true);
        g.selectAll(".BFNodes").selectAll("g").filter(n => n.id === selectedEdge.target || n.id === selectedEdge.source).classed("fixedEdge", true).classed("edgeHighlight", true);
        g.selectAll(".BFNodeBackground").selectAll("g").filter(n => n.id === selectedEdge.target || n.id === selectedEdge.source).classed("fixedEdge", true).classed("edgeHighlight", true);
        g.selectAll(".BFEdgeBackground").selectAll("g").filter(b => b.target === selectedEdge.target && b.source === selectedEdge.source).classed("fixedEdge", true).classed("edgeHighlight", true);
    }

    g.selectAll(".BFEdges").selectAll("g").on("mouseover", function (event, a) {
        d3.select(this).classed("edgeHover", true);
        g.selectAll(".BFNodes").selectAll("g").filter(n => n.id === a.target || n.id === a.source).classed("edgeHighlight", true);
        g.selectAll(".BFNodeBackground").selectAll("g").filter(n => n.id === a.target || n.id === a.source).classed("edgeHighlight", true);
        g.selectAll(".BFEdgeBackground").selectAll("g").filter(e => e === a).classed("edgeHighlight", true);
    }).on("mouseout", function () {
        g.selectAll(".BFNodes,.BFEdges,.BFNodeBackground,.BFEdgeBackground").selectAll("g:not(.fixedEdge)").classed("edgeHighlight", false).classed("edgeHover", false);
    });

    g.selectAll(".BFEdges").selectAll("g").on("click", function (event, a) {
        if (d3.select(this).classed("selectedEdge")) {
            d3.selectAll(".BFEdges,.BFNodes,.BFNodeBackground,.BFEdgeBackground").selectAll("g").classed("fixedEdge", false).classed("selectedEdge", false);
            selectedEdge = null;
        } else {
            selectedEdge = a;
            d3.selectAll(".BFEdges,.BFNodes,.BFNodeBackground,.BFEdgeBackground").selectAll("g").classed("fixedEdge", false).classed("selectedEdge", false).classed("edgeHover", false).classed("edgeHighlight", false);
            d3.select(this).classed("selectedEdge", true).classed("fixedEdge", true).classed("edgeHover", true);
            g.selectAll(".BFNodes").selectAll("g").filter(n => n.id === a.target || n.id === a.source).classed("fixedEdge", true).classed("edgeHighlight", true);
            g.selectAll(".BFNodeBackground").selectAll("g").filter(n => n.id === a.target || n.id === a.source).classed("fixedEdge", true).classed("edgeHighlight", true);
            g.selectAll(".BFEdgeBackground").selectAll("g").filter(e => e === a).classed("fixedEdge", true).classed("edgeHighlight", true);
        }
    });

    // sort on attributes based on click
    g.selectAll(".BFNodeLabels").selectAll("text").on("click", function (event, a) {
        og.selectAll("*").remove();
        BFNodeOrdering = a;
        bioFabric(og, width, height, data, nodeEncoding, edgeEncoding, BFNodeOrdering, edgeOrdering, nodeAttribute,
            edgeAttribute, study, nodeShading, edgeShading, doubleEdges);
    });
    g.selectAll(".BFEdgeLabels").selectAll("text").on("click", function (event, a) {
        og.selectAll("*").remove();
        BFEdgeOrdering = a;
        bioFabric(og, width, height, data, nodeEncoding, edgeEncoding, nodeOrdering, BFEdgeOrdering, nodeAttribute,
            edgeAttribute, study, nodeShading, edgeShading, doubleEdges);
    });

    // sort nodes alphabetically
    let sort = g.append("g").attr("id", "sortButton").attr("transform", "translate(-20, -5)");
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

    let triangle = d3.symbol().type(d3.symbolTriangle2);
    triangle.size(50);
    let path = triangle();
    sort.append("path")
        .attr("d", path)
        .attr("stroke", "gray")
        .attr("fill", "none")
        .attr("transform", "translate(46 8) rotate(180 0 0)");

    g.select("#sortButton").on("click", function () {
        og.selectAll("*").remove();
        BFNodeOrdering = "Alphabetical";
        bioFabric(og, width, height, data, nodeEncoding, edgeEncoding, BFNodeOrdering, edgeOrdering, nodeAttribute,
            edgeAttribute, study, nodeShading, edgeShading, doubleEdges);
    });

    // checkbox
    let checkbox = g.append("g")
        .attr("id", "BFSelection")
        .attr("transform", "translate(-65, " + (40 - nodeDistance / 3) + ")")
        .selectAll("g")
        .data(network.nodes)
        .enter()
        .append("g")
        .attr("class", "checkbox");

    checkbox.append("rect")
        .attr("width", 2 * nodeDistance / 3)
        .attr("height", 2 * nodeDistance / 3)
        .attr("y", function (d, i) {
            return nodeDistance * i;
        })
        .style("stroke", "black")
        .style("fill", "white")
        .style("stroke-width", "2px");

    checkbox.append("rect")
        .attr("class", "checkmark")
        .attr("transform", "translate(" + (nodeDistance / 9) + " " + (nodeDistance / 9) + ")")
        .attr("width", 4 * nodeDistance / 9)
        .attr("height", 4 * nodeDistance / 9)
        .attr("y", function (d, i) {
            return nodeDistance * i;
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


    /**
     * This function appends the name of a node without encoding an attribute.
     */
    function plainNodes() {
        node.append("text")
            .attr("transform", function (d) {
                return "translate(-5," + nodePositions(d.id) + ")"; //+ (nameLength < 10 ? "" : "rotate(-45)");
            })
            .text(function (d) {
                return d.name;
            })
            .attr("dy", ".35em")
            .style("fill", "black")
            .style("text-anchor", "end")
            .style("font-size", fontSize);
    }

    /**
     * This function encodes one given node attribute by mapping the value to the radius of a circle filled in corresponding hue.
     * Nodes that do not share this attribute remain plain.
     * @param attr
     */
    function coloredNodeCircles(attr) {
        node.append("circle")
            .attr("transform", function (d) {
                return "translate(-" + max_nodeRadius + "," + nodePositions(d.id) + ")";
            })
            .attr("r", function (d) {
                return attr in d.attributes ? nodeRadiusScales[attr](d.attributes[attr]) : 0;// min_nodeRadius;
            })
            .style("fill", function (d) {
                return attr in d.attributes ? nodeColors(attr) : "#e9ecef";
            });

        node.append("text")
            .attr("transform", function (d) {
                return "translate(-" + max_nodeRadius + "," + nodePositions(d.id) + ")";
            })
            .text(function (d) {
                return d.name;
            })
            .style("fill", "black")
            .style("font-size", smallFontSize)
            .attr("dy", ".35em")
            .attr("text-anchor", "middle");
    }


    /**
     * This function encodes the node attributes in a bar chart.
     */
    function barsOnNodes() {
        node.append("rect")
            .attr("class", "nodeBarChart")
            .attr("width", nodeSize)
            .attr("height", nodeSize)
            .attr("x", -nodeSize / 2)
            .attr("y", -nodeSize / 2)
            .style("fill", "#e9ecef");

        node.each(function (n) {
            for (let [i, attr] of Object.entries(nodeAttributes)) {
                if (attr in n.attributes) {
                    d3.select(this).append("line")
                        .attr("class", "nodeBarChart")
                        .attr("x1", inNodeBarDistance * i - nodeSize / 2 + inNodeBarWidth / 2 + 1)
                        .attr("y1", nodeSize / 2 - 2)
                        .attr("x2", inNodeBarDistance * i - nodeSize / 2 + inNodeBarWidth / 2 + 1)
                        .attr("y2", -inNodeBarScales[attr](n.attributes[attr]) + nodeSize / 2 - 2)
                        .style("stroke-opacity", 1)
                        .style("stroke-width", inNodeBarWidth)
                        .style("stroke", nodeColors(attr));
                }
            }
        });

        node.append("text")
            .attr("class", "nodeBarChart")
            .text(function (d) {
                return d.name;
            })
            .style("fill", "black")
            .style("font-size", smallFontSize)
            .attr("y", -nodeSize + inNodeBarHeight * 1.1)
            .attr("dy", ".35em")
            .attr("text-anchor", "middle");

        g.selectAll(".nodeBarChart")
            .attr("transform", function (d) {
                return "translate(-10 ," + nodePositions(d.id) + ")";
            });
    }

    /**
     * This function encodes one given node attribute by mapping the value to the width of the line filled in corresponding hue.
     * Nodes that do not share this attribute remain plain.
     * @param attr
     */
    function coloredNodeLines(attr) {
        plainNodes();
        node.selectAll("line")
            .style("stroke", function (d) {
                return attr in d.attributes ? nodeColors(attr) : "gray";
            })
            .style("stroke-width", function (d) {
                return attr in d.attributes ? nodeWidthScales[attr](d.attributes[attr]) : 1;
            });
    }

    /**
     * This function encodes each node attribute by a separate line.
     * These lines map the value to the width of the line filled in corresponding hue and are aligned in parallel.
     */
    function parallelNodeLines() {
        plainNodes();
        node.each(function (n) {
            for (let [i, [attr, value]] of Object.entries(Object.entries(n.attributes))) {
                let max = Object.keys(n.attributes).length - 1;
                d3.select(this).append("line")
                    .attr("y1", nodePositions(n.id))
                    .attr("x2", widthForEdges)
                    .attr("y2", nodePositions(n.id))
                    // shift lines up or down from the middle line
                    .attr("transform", "translate(0, " + -(Math.round(max / 2 - i) * (max_nodeWidth + 2)) + ")")
                    .style("stroke-width", nodeWidthScales[attr](value))
                    .style("stroke", nodeColors(attr));
            }

            // visualize edges without attributes as plain edges
            if (Object.keys(n.attributes).length) {
                d3.select(this).select(".BFNodeLine").remove();
            }
        });
    }

    /**
     * This function encodes each node attribute by a separate line.
     * These lines map the value to the curve of the lines.
     * (small values are bend to the bottom, high values are bend to the top)
     */
    function curvedNodeLines() {
        plainNodes();
        const curve = d3.line().curve(d3.curveNatural);
        node.each(function (n) {
            let x1 = 0;
            let x2 = widthForEdges;
            let y = nodePositions(n.id);
            for (let [attr, value] of Object.entries(n.attributes)) {
                let points = [[x1, y], [(x2 + x1) / 2, y - nodeCurveScales[attr](value)], [x2, y]];
                d3.select(this).append("path")
                    .attr("d", curve(points))
                    .attr("fill", "none")
                    .style("stroke-width", "2px")
                    .style("stroke", nodeColors(attr));
            }

            // visualize edges without attributes as plain edges
            if (Object.keys(n.attributes).length) {
                d3.select(this).select(".BFNodeLine").remove();
            }
        });
    }

    function dashedNodeLines() {
        plainNodes();
        node.each(function (n) {
            for (let [i, [attr, value]] of Object.entries(Object.entries(n.attributes))) {
                let max = Object.keys(n.attributes).length - 1;
                d3.select(this).append("line")
                    .attr("y1", nodePositions(n.id))
                    .attr("x2", widthForEdges)
                    .attr("y2", nodePositions(n.id))
                    // shift lines up or down from the middle line
                    .attr("transform", "translate(0, " + -(Math.round(max / 2 - i) * (max_nodeWidth + 2)) + ")")
                    .style("stroke-width", max_nodeWidth / 2)
                    .style("stroke", nodeColors(attr))
                    .style("stroke-dasharray", "10 " + nodeDashScales[attr](value));
            }

            // visualize edges without attributes as plain edges
            if (Object.keys(n.attributes).length) {
                d3.select(this).select(".BFNodeLine").remove();
            }
        });
    }

    /**
     * This function encodes each node attribute by a bar on the node's line.
     */
    function barsOnNodeLines() {
        plainNodes();
        let max = nodeAttributes.length - 1;
        node.each(function (n) {
            for (let [i, attr] of Object.entries(nodeAttributes)) {
                if (attr in n.attributes) {
                    let y = nodePositions(n.id);
                    let mid_x = (0.1 * width) / 2 + 2;
                    let shift_x = -Math.round(max / 2 - i) * onNodeBarDistance;
                    d3.select(this).append("line")
                        .attr("x1", mid_x + shift_x)
                        .attr("y1", y)
                        .attr("x2", mid_x + shift_x)
                        .attr("y2", y - onNodeBarScales[attr](n.attributes[attr]))
                        .style("stroke-width", onNodeBarWidth)
                        .style("stroke", nodeColors(attr));
                }
            }
        });
    }

    /**
     * This function encodes the node attributes in a juxtaposed table aligned to the nodes.
     */
    function juxtaposedNodeAttributes() {
        plainNodes();

        // create background
        const background = g.append("g")
            .attr("class", "BFNodeBackground")
            .attr("transform", "translate(" + (60 + widthForEdges) + ", 40)");

        nodeAttributes.forEach(function (d, i) {
            background.append("rect")
                .attr("width", nodeBarWidth + 4)
                .attr("height", (network.nodes.length - 0.5) * nodeDistance)
                .attr("x", nodeBarDistance * i - 2)
                .attr("y", -nodeDistance / 4)
                .attr("fill", "#e9ecef");
        });

        network.nodes.forEach(function (d, i) {
            background.append("line")
                .attr("x1", -2)
                .attr("y1", nodeDistance * i)
                .attr("x2", nodeBarDistance * nodeAttributes.length)
                .attr("y2", nodeDistance * i)
                .style("stroke", "white");
        });

        background.selectAll("g")
            .data(network.nodes)
            .enter()
            .append("g")
            .append("rect")
            .attr("width", (nodeBarWidth + 4) * nodeAttributes.length)
            .attr("height", 0.5 * nodeDistance)
            .attr("y", function (d) {
                return nodePositions(d.id) - 0.25 * nodeDistance;
            })
            .attr("fill", "none");

        g.append("g")
            .attr("class", "BFNodeLabels")
            .attr("transform", "translate(" + (60 + widthForEdges) + ", 20)")
            .selectAll("text")
            .data(nodeAttributes)
            .enter().append("text")
            .text(function (d) {
                return d;
            })
            .attr("x", function (d, i) {
                return nodeBarDistance * i + nodeBarWidth / 2;
            })
            .style("text-anchor", "middle")
            .style("font-size", categoriesFontSize);

        // append a table for representation of attributes
        const table = g.append("g")
            .attr("class", "BFAttributes")
            .attr("transform", "translate(" + (60 + widthForEdges) + ", 40)")
            .selectAll("g")
            .data(network.nodes)
            .enter().append("g");

        table.each(function (n) {
            for (let [j, attr] of Object.entries(nodeAttributes)) {
                if (attr in n.attributes) {
                    // add a base for the bars
                    d3.select(this).append("line")
                        .attr("class", "BFBase")
                        .attr("transform", "translate(" + (nodeBarDistance * j) + ", 0)")
                        .attr("y1", nodePositions(n.id))
                        .attr("x2", nodeBarWidth)
                        .attr("y2", nodePositions(n.id))
                        .style("stroke", nodeColors(attr))
                        .style("stroke-opacity", 0.5)
                        .style("stroke-width", nodeBarHeight)
                        .raise();

                    // add bars encoding the numerical attribute
                    d3.select(this).append("line")
                        .attr("class", "BFAttribute")
                        .attr("transform", "translate(" + (nodeBarDistance * j) + ", 0)")
                        .attr("y1", nodePositions(n.id))
                        .attr("x2", nodeBarScales[attr](n.attributes[attr]))
                        .attr("y2", nodePositions(n.id))
                        .style("stroke", nodeColors(attr))
                        .style("stroke-width", nodeBarHeight)
                        .raise();
                }
            }
        });
    }

    /**
     * This function creates edge lines without encoding an attribute. The source and target node are marked with a square on the corresponding line.
     */
    function plainEdges() {
        const edge = g.append("g")
            .attr("class", "BFEdges")
            .attr("transform", "translate(60, 40)")
            .selectAll("g")
            .data(network.edges)
            .enter().append("g");

        edge.append("line")
            .attr("class", "BFEdgeLine")
            .attr("x1", function (d, i) {
                return edgePositions(i);
            })
            .attr("y1", function (d) {
                return nodePositions(d.source);
            })
            .attr("x2", function (d, i) {
                return edgePositions(i);
            })
            .attr("y2", function (d) {
                return nodePositions(d.target);
            })
            .attr("fill", "none")
            .attr("stroke", "black");
    }

    /**
     * This function encodes one given edge attribute by mapping the value to the width of the line filled in corresponding hue.
     * Edges that do not share this attribute remain plain.
     * @param attr
     */
    function coloredEdgeLines(attr) {
        plainEdges();
        g.selectAll(".BFEdges").selectAll("line")
            .style("stroke", function (d) {
                return attr in d.attributes ? edgeColors(attr) : "gray";
            })
            .style("stroke-width", function (d) {
                return attr in d.attributes ? edgeWidthScales[attr](d.attributes[attr]) : 1;
            });
    }

    /**
     * This function encodes each edge attribute by a separate line.
     * These lines map the value to the width of the line filled in corresponding hue and are aligned in parallel.
     */
    function parallelEdges() {
        const edge = g.append("g")
            .attr("class", "BFEdges")
            .attr("transform", "translate(60, 40)")
            .selectAll("g")
            .data(network.edges)
            .enter().append("g");

        edge.each(function (e, j) {
            for (let [i, [attr, value]] of Object.entries(Object.entries(e.attributes))) {
                let max = Object.keys(e.attributes).length - 1;
                d3.select(this).append("line")
                    .attr("x1", edgePositions(j))
                    .attr("y1", nodePositions(e.source))
                    .attr("x2", edgePositions(j))
                    .attr("y2", nodePositions(e.target))
                    // shift edges right or left from the middle edge
                    .attr("transform", "translate(" + -(Math.round(max / 2 - i) * (max_edgeWidth + 2)) + ", 0)")
                    .style("stroke-width", edgeWidthScales[attr](value))
                    .style("stroke", edgeColors(attr));
            }

            // visualize edges without attributes as plain edges
            if (!Object.keys(e.attributes).length) {
                d3.select(this).append("line")
                    .attr("x1", edgePositions(j))
                    .attr("y1", nodePositions(e.source))
                    .attr("x2", edgePositions(j))
                    .attr("y2", nodePositions(e.target))
                    .style("fill", "none")
                    .style("stroke", "black");
            }
        });
    }

    /**
     * This function encodes each edge attribute by a separate line.
     * These lines map the value to the curve of the line.
     * (small values are bend to the left, high values are bend to the right)
     */
    function curvedEdges() {
        const edge = g.append("g")
            .attr("class", "BFEdges")
            .attr("transform", "translate(60, 40)")
            .selectAll("g")
            .data(network.edges)
            .enter().append("g");

        const curve = d3.line().curve(d3.curveNatural);
        edge.each(function (e, j) {
            let x = edgePositions(j);
            let y1 = nodePositions(e.source);
            let y2 = nodePositions(e.target);
            for (let [attr, value] of Object.entries(e.attributes)) {
                let points = [[x, y1], [x + edgeCurveScales[attr](value), (y2 + y1) / 2], [x, y2]];
                d3.select(this).append("path")
                    .attr("d", curve(points))
                    .attr("fill", "none")
                    .style("stroke-width", "2px")
                    .style("stroke", edgeColors(attr));
            }

            // visualize edges without attributes as plain edges
            if (!Object.keys(e.attributes).length) {
                d3.select(this).append("line")
                    .attr("x1", edgePositions(j))
                    .attr("y1", nodePositions(e.source))
                    .attr("x2", edgePositions(j))
                    .attr("y2", nodePositions(e.target))
                    .style("fill", "none")
                    .style("stroke", "black");
            }
        });
    }

    /**
     * This function encodes each edge attribute by a separate line.
     * These lines map the value to the width of the line filled in corresponding hue and are aligned in parallel.
     */
    function dashedEdges() {
        const edge = g.append("g")
            .attr("class", "BFEdges")
            .attr("transform", "translate(60, 40)")
            .selectAll("g")
            .data(network.edges)
            .enter().append("g");

        edge.each(function (e, j) {
            for (let [i, [attr, value]] of Object.entries(Object.entries(e.attributes))) {
                let max = Object.keys(e.attributes).length - 1;
                d3.select(this).append("line")
                    .attr("x1", edgePositions(j))
                    .attr("y1", nodePositions(e.source))
                    .attr("x2", edgePositions(j))
                    .attr("y2", nodePositions(e.target))
                    // shift edges right or left from the middle edge
                    .attr("transform", "translate(" + -(Math.round(max / 2 - i) * (max_edgeWidth / 2 + 2)) + ", 0)")
                    .style("stroke-width", max_edgeWidth / 2)
                    .style("stroke", edgeColors(attr))
                    .style("stroke-dasharray", "10 " + edgeDashScales[attr](value));
            }

            // visualize edges without attributes as plain edges
            if (!Object.keys(e.attributes).length) {
                d3.select(this).append("line")
                    .attr("x1", edgePositions(j))
                    .attr("y1", nodePositions(e.source))
                    .attr("x2", edgePositions(j))
                    .attr("y2", nodePositions(e.target))
                    .style("fill", "none")
                    .style("stroke", "black");
            }
        });
    }

    /**
     * This function encodes the edge attributes using bars. These are represented beside each other on a common baseline.
     * The numerical values are mapped to the height of the bars which are filled in the corresponding hue.
     */
    function barsOnEdges() {
        plainEdges();
        let max = edgeAttributes.length - 1;
        g.selectAll(".BFEdges").selectAll("g").each(function (e, j) {
            for (let [i, attr] of Object.entries(edgeAttributes)) {
                if (attr in e.attributes) {
                    let x = edgePositions(j);
                    let mid_y = (nodePositions(e.source) + nodePositions(e.target)) / 2;
                    let shift_y = -Math.round(max / 2 - i) * onEdgeBarDistance;

                    if (study) {
                        let nodePos = Math.min(nodePositions(e.source), nodePositions(e.target));
                        mid_y = nodePos + nodeDistance / 2;
                    }
                    if (edgeAttributes.length % 2 === 0) {
                        mid_y += onEdgeBarDistance / 2;
                    }

                    d3.select(this).append("line")
                        .attr("class", "BFEdgeAttribute")
                        .attr("x1", x)
                        .attr("y1", mid_y + shift_y)
                        .attr("x2", x + onEdgeBarScales[attr](e.attributes[attr]))
                        .attr("y2", mid_y + shift_y)
                        .style("stroke-width", onEdgeBarWidth)
                        .style("stroke", edgeColors(attr));
                }
            }
        });
    }

    /**
     * This function encodes the edge attributes in a juxtaposed table aligned to the edge lines.
     */
    function juxtaposedEdgeAttributes() {
        // create background
        const background = g.append("g")
            .attr("class", "BFEdgeBackground")
            .attr("transform", "translate(40, " + (network.nodes.length * nodeDistance + 40) + ")");

        edgeAttributes.forEach(function (d, i) {
            background.append("rect")
                .attr("width", widthForEdges)
                .attr("height", edgeBarWidth + 4)
                .attr("y", edgeBarDistance * i - 2)
                .attr("fill", "#e9ecef");
        });

        network.edges.forEach(function (d, i) {
            background.append("line")
                .attr("transform", "translate(20, 0)")
                .attr("x1", edgePositions(i))
                .attr("y1", -2)
                .attr("x2", edgePositions(i))
                .attr("y2", edgeBarDistance * edgeAttributes.length)
                .style("stroke", "white");
        });

        background.selectAll("g")
            .data(network.edges)
            .enter()
            .append("g")
            .append("rect")
            .attr("width", edgeDistance * 0.5)
            .attr("height", edgeBarDistance * edgeAttributes.length - 5)
            .attr("x", function (d) {
                return edgePositions(network.edges.indexOf(d)) + 20 - edgeDistance * 0.25;
            })
            .attr("y", -3)
            .attr("fill", "none");

        g.append("g")
            .attr("class", "BFEdgeLabels")
            .attr("transform", "translate(30, " + (network.nodes.length * nodeDistance + 40) + ")")
            .selectAll("text")
            .data(edgeAttributes)
            .enter().append("text")
            .text(function (d) {
                if (d === "Years of Friendship") {
                    return "Years";
                } else if (d === "Common Hobbies") {
                    return "Hobbies";
                } else if (d === "Interactions per Week") {
                    return "Actions";
                } else {
                    return d;
                }
            })
            .attr("transform", function (d, i) {
                return "translate(5, " + (edgeBarDistance * i + edgeBarWidth / 2) + ")"; // + (nameLength < 10 ? "" : "rotate(-45)"); x = 0
            })
            .style("text-anchor", "end")
            .style("font-size", categoriesFontSize);

        // append a table for representation of attributes
        const table = g.append("g")
            .attr("class", "BFEdgeAttributes")
            .attr("transform", "translate(60, " + (network.nodes.length * nodeDistance + 40) + ")")
            .selectAll("g")
            .data(network.edges)
            .enter().append("g");

        table.each(function (e) {
            for (let [j, attr] of Object.entries(edgeAttributes)) {
                if (attr in e.attributes) {
                    // add a base for the bars
                    d3.select(this).append("line")
                        .attr("class", "BFBase")
                        .attr("transform", "translate(0, " + (edgeBarDistance * j) + ")")
                        .attr("x1", edgePositions(network.edges.indexOf(e)))
                        .attr("y2", edgeBarWidth)
                        .attr("x2", edgePositions(network.edges.indexOf(e)))
                        .style("stroke", edgeColors(attr))
                        .style("stroke-opacity", 0.3)
                        .style("stroke-width", edgeBarHeight)
                        .raise();

                    // add bars encoding the numerical attribute
                    d3.select(this).append("line")
                        .attr("class", "BFAttribute")
                        .attr("transform", "translate(0, " + (edgeBarDistance * j) + ")")
                        .attr("x1", edgePositions(network.edges.indexOf(e)))
                        .attr("x2", edgePositions(network.edges.indexOf(e)))
                        .attr("y1", edgeBarWidth)
                        .attr("y2", edgeBarWidth - edgeBarScales[attr](e.attributes[attr]))
                        .style("stroke", edgeColors(attr))
                        .style("stroke-width", edgeBarHeight)
                        .raise();
                }
            }
        });
    }

    function addSquares() {
        const sources = g.selectAll(".BFEdges").selectAll("g").append("rect")
            .attr("width", squareSize)
            .attr("height", squareSize)
            .attr("x", function (d, i) {
                return edgePositions(i) - squareSize / 2;
            })
            .attr("y", function (d) {
                return nodePositions(d.source) - squareSize / 2;
            })
            .attr("fill", "black");

        const targets = g.selectAll(".BFEdges").selectAll("g").append("rect")
            .attr("width", squareSize)
            .attr("height", squareSize)
            .attr("x", function (d, i) {
                return edgePositions(i) - squareSize / 2;
            })
            .attr("y", function (d) {
                return nodePositions(d.target) - squareSize / 2;
            })
            .attr("fill", "black");

        // adapt to multiple node lines
        if (["parallelLines", "dashedLines"].includes(nodeEncoding)) {
            sources.attr("height", function (e) {
                let source = network.nodes.find(n => n.id === e.source);
                return Math.max(Object.keys(source.attributes).length * (max_nodeWidth + 2), squareSize);
            })
                .attr("y", function (e) {
                    let source = network.nodes.find(n => n.id === e.source);
                    let max = Object.keys(source.attributes).length;
                    if (max * (max_nodeWidth + 2) > squareSize) {
                        if (max % 2 === 0) {
                            return nodePositions(e.source) - (max + 1) * (max_nodeWidth + 2) / 2;
                        } else {
                            return nodePositions(e.source) - max * (max_nodeWidth + 2) / 2;
                        }
                    } else {
                        return nodePositions(e.source) - squareSize / 2;
                    }
                });

            targets.attr("height", function (e) {
                let source = network.nodes.find(n => n.id === e.target);
                return Math.max(Object.keys(source.attributes).length * (max_nodeWidth + 2), squareSize);
            })
                .attr("y", function (e) {
                    let source = network.nodes.find(n => n.id === e.target);
                    let max = Object.keys(source.attributes).length;
                    if (max * (max_nodeWidth + 2) > squareSize) {
                        if (max % 2 === 0) {
                            return nodePositions(e.target) - (max + 1) * (max_nodeWidth + 2) / 2;
                        } else {
                            return nodePositions(e.target) - max * (max_nodeWidth + 2) / 2;
                        }
                    } else {
                        return nodePositions(e.target) - squareSize / 2;
                    }
                });
        } else if (nodeEncoding === "curvedLines") {
            sources.attr("height", 2 * nodeDistance / 3 + 4)
                .attr("y", function (e) {
                    return nodePositions(e.source) - nodeDistance / 3 - 2;
                });

            targets.attr("height", 2 * nodeDistance / 3 + 4)
                .attr("y", function (e) {
                    return nodePositions(e.target) - nodeDistance / 3 - 2;
                });
        }

        if (["parallelEdges", "parallelAndJuxtaposed"].includes(edgeEncoding)) {
            sources.attr("width", function (e) {
                return Math.max(Object.keys(e.attributes).length * (max_edgeWidth + 2), squareSize);
            })
                .attr("x", function (e, i) {
                    if (Object.keys(e.attributes).length < 2) {
                        return edgePositions(i) - squareSize / 2;
                    } else {
                        return edgePositions(i) - 0.5 * max_edgeWidth - Math.round((Object.keys(e.attributes).length - 1) / 2) * (max_edgeWidth + 2);
                    }
                });

            targets.attr("width", function (e) {
                return Math.max(Object.keys(e.attributes).length * (max_edgeWidth + 2), squareSize);
            })
                .attr("x", function (e, i) {
                    if (Object.keys(e.attributes).length < 2) {
                        return edgePositions(i) - squareSize / 2;
                    } else {
                        return edgePositions(i) - 0.5 * max_edgeWidth - Math.round((Object.keys(e.attributes).length - 1) / 2) * (max_edgeWidth + 2);
                    }
                });
        } else if (edgeEncoding === "dashedEdges") {
            sources.attr("width", function (e) {
                return Math.max(Object.keys(e.attributes).length * (max_edgeWidth / 2 + 2), squareSize);
            })
                .attr("x", function (e, i) {
                    if (Object.keys(e.attributes).length < 2) {
                        return edgePositions(i) - squareSize / 2;
                    } else {
                        return edgePositions(i) - max_edgeWidth / 4 - Math.round((Object.keys(e.attributes).length - 1) / 2) * (max_edgeWidth / 2 + 2);
                    }
                });

            targets.attr("width", function (e) {
                return Math.max(Object.keys(e.attributes).length * (max_edgeWidth / 2 + 2), squareSize);
            })
                .attr("x", function (e, i) {
                    if (Object.keys(e.attributes).length < 2) {
                        return edgePositions(i) - squareSize / 2;
                    } else {
                        return edgePositions(i) - max_edgeWidth / 4 - Math.round((Object.keys(e.attributes).length - 1) / 2) * (max_edgeWidth / 2 + 2);
                    }
                });
        }
    }

    function addNodeShadingToBackground() {
        g.selectAll(".BFNodes").selectAll("g:nth-child(2n)")
            .append("line")
            .attr("class", "BFNodeShading")
            .attr("y1", function (d) {
                return nodePositions(d.id);
            })
            .attr("x2", widthForEdges)
            .attr("y2", function (d) {
                return nodePositions(d.id);
            })
            .style("fill", "none")
            .style("stroke", "gray")
            .style("stroke-opacity", 0.1)
            .style("stroke-width", nodeDistance)
            .lower();

        if (nodeEncoding === "juxtaposedNodes") {
            d3.selectAll(".BFNodeBackground").lower(); //remove()
            d3.selectAll(".BFNodeShading")
                .attr("x2", widthForEdges + 20 + nodeBarDistance * nodeAttributes.length);
        }
    }

    function addNodeShadingToLine() {
        g.selectAll(".BFNodes").selectAll("g:nth-child(2n)").selectAll(".BFNodeLine")
            .style("stroke-width", "2px");
    }

    function addEdgeShadingToBackground() {
        g.selectAll(".BFEdges").selectAll("g:nth-child(2n)")
            .append("line")
            .attr("class", "BFEdgeShading")
            .attr("x1", function (d, i) {
                return edgePositions(i * 2 + 1);
            })
            .attr("y1", 0)
            .attr("x2", function (d, i) {
                return edgePositions(i * 2 + 1);
            })
            .attr("y2", nodeDistance * (network.nodes.length - 1))
            .style("fill", "none")
            .style("stroke", "gray")
            .style("stroke-opacity", 0.1)
            .style("stroke-width", edgeDistance)
            .lower();

        if (["juxtaposedEdges", "barsAndJuxtaposed", "parallelAndJuxtaposed"].includes(edgeEncoding)) {
            d3.selectAll(".BFEdgeBackground").lower(); //remove()
            d3.selectAll(".BFEdgeShading")
                .attr("y2", nodeDistance * network.nodes.length + edgeBarDistance * edgeAttributes.length);
        }
    }

    function addEdgeShadingToLine() {
        g.selectAll(".BFEdges").selectAll("g:nth-child(2n)").selectAll(".BFEdgeLine")
            .style("stroke-width", "2px");
    }
}