// Visualization of the node-link diagram

/**
 * This function appends the visualization of the network data in a node-link diagram to the given g element.
 * The visualization is scaled to the provided width and height of the visualization space.
 * Possibilities for additional parameters of the encoding technique are described below:
 * @param g
 * @param width of the visualization space
 * @param height of the visualization space
 * @param data of network
 * @param nodeEncoding [plainNodes | coloredNodes | barsOnNodes]
 * @param edgeEncoding [plainEdges | coloredEdges | parallelEdges | barsOnEdges]
 * @param nodeAttribute any node attribute for encoding
 * @param edgeAttribute any edge attribute for encoding
 */
function nodeLinkDiagram(g, width, height, data, nodeEncoding, edgeEncoding, nodeAttribute, edgeAttribute) {
    let network = JSON.parse(JSON.stringify(data));

    // get node and edge categories
    const nodeAttributes = getAttributeLabels(network.nodes);
    const edgeAttributes = getAttributeLabels(network.edges);

    if (!nodeAttributes.length) {
        nodeEncoding = "plainNodes";
    }
    if (!edgeAttributes.length) {
        edgeEncoding = "plainEdges";
    }

    // define size properties
    const nodeSize = 50;
    const min_nodeRadius = 20;
    const max_nodeRadius = 30;
    const nodeBarHeight = 30;
    const nodeBarWidth = (nodeSize - nodeAttributes.length * 2) / nodeAttributes.length;
    const nodeBarDistance = nodeBarWidth + 2;

    const max_edgeWidth = Math.max(1, Math.min(10, min_nodeRadius / edgeAttributes.length));
    const min_edgeWidth = Math.min(5, max_edgeWidth / 2);
    const edgeBarHeight = 20;
    const edgeBarWidth = 10;
    const edgeBarDistance = edgeBarWidth + 2;

    const nameLength = Math.max(...network.nodes.map(n => n.name.length));
    const fontSize = nameLength < 3 ? min_nodeRadius : min_nodeRadius / 2;

    // define scales on each attribute
    const nodeRadiusScales = defineScales(nodeAttributes, network.nodes, min_nodeRadius, max_nodeRadius);
    const nodeBarScales = defineScales(nodeAttributes, network.nodes, 1, nodeBarHeight);
    const nodeColors = d3.scaleOrdinal(d3.schemeSet1).domain(nodeAttributes);

    const edgeWidthScales = defineScales(edgeAttributes, network.edges, min_edgeWidth, max_edgeWidth);
    const edgeBarScales = defineScales(edgeAttributes, network.edges, 1, edgeBarHeight);
    const edgeColors = d3.scaleOrdinal(d3.schemeSet2).domain(edgeAttributes);

    // layout nodes and edges by a force simulation
    const simulation = d3.forceSimulation(network.nodes)
        .force("link", d3.forceLink().id(function (d) {
            return d.id;
        }))
        .force("charge", d3.forceManyBody().strength(-500)
            .distanceMin(nodeBarDistance * nodeAttributes.length + 2 * max_nodeRadius)
            .distanceMax(Math.min(width, height) / 2))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide()
            .strength(1)
            .radius(max_nodeRadius))
        // additional boundaries to fit the visualization space
        .force("boundary", forceBoundary(max_nodeRadius, max_nodeRadius, width - max_nodeRadius, height - max_nodeRadius))
        .stop();

    simulation.force("link")
        .links(network.edges)
        .distance(Math.min(width, height) / Math.sqrt(network.nodes.length));

    simulation.tick(300);

    // append edges
    const edge = g.append("g")
        .attr("class", "NLDEdges")
        .selectAll("line")
        .data(network.edges)
        .enter().append("g");

    // apply encoding of edge attributes
    switch (edgeEncoding) {
        case "plainEdges" :
            plainEdges();
            break;
        case "coloredEdges":
            coloredEdges(edgeAttribute);
            break;
        case "parallelEdges" :
            parallelEdges();
            break;
        case "barsOnEdges" :
            barsOnEdges();
            break;
    }

    // append nodes
    const node = g.append("g")
        .attr("class", "NLDNodes")
        .selectAll("g")
        .data(network.nodes)
        .enter().append("g");

    // apply encoding of node attributes
    switch (nodeEncoding) {
        case "plainNodes" :
            plainNodes();
            break;
        case "coloredNodes" :
            plainNodes();
            coloredNodes(nodeAttribute);
            break;
        case "barsOnNodes" :
            barsOnNodes();
            break;
    }

    // highlighting of nodes and edges
    d3.selectAll(".NLDNodes").selectAll("g").on("mouseover", function () {
        d3.select(this).selectAll("rect,circle").style("stroke", "black")
            .style("stroke-width", "2px");
    }).on("mouseout", function () {
        d3.select(this).selectAll("rect,circle").style("stroke", null);
    });

    d3.selectAll(".NLDEdges").selectAll("g").on("mouseover", function (e, d) {
        d3.select(this).selectAll(".baseline").attr("stroke-width", "2px");
        d3.select(this).raise();
        d3.selectAll(".NLDEdges").selectAll("g").filter(e => e !== d).style("stroke-opacity", 0.5);
    }).on("mouseout", function () {
        d3.select(this).selectAll(".baseline").attr("stroke-width", "1px");
        d3.selectAll(".NLDEdges").selectAll("g").style("stroke-opacity", 1);
    });

    /**
     * This function creates simple nodes without encoding an attribute.
     */
    function plainNodes() {
        node.append("circle")
            .attr("r", min_nodeRadius)
            .style("fill", "#e9ecef");

        node.append("text")
            .text(function (d) {
                return d.name;
            })
            .style("fill", "black")
            .style("font-size", fontSize)
            .attr("dy", ".35em")
            .attr("text-anchor", "middle");

        d3.selectAll(".NLDNodes").selectAll("g")
            .attr("transform", function (d) {
                return "translate(" + d.x + "," + d.y + ")";
            });
    }

    /**
     * This function encodes one given node attribute by mapping the value to the radius of a circle filled in corresponding hue.
     * Nodes that do not share this attribute remain plain.
     * @param attr
     */
    function coloredNodes(attr) {
        d3.selectAll(".NLDNodes").selectAll("circle")
            .attr("r", function (d) {
                return attr in d.attributes ? nodeRadiusScales[attr](d.attributes[attr]) : min_nodeRadius;
            })
            .style("fill", function (d) {
                return attr in d.attributes ? nodeColors(attr) : "#e9ecef";
            });
    }

    /**
     * This function encodes the node attributes in a bar chart.
     */
    function barsOnNodes() {
        node.append("rect")
            .attr("width", nodeSize)
            .attr("height", nodeSize)
            .attr("x", -nodeSize / 2)
            .attr("y", -nodeSize / 2)
            .style("fill", "#e9ecef");

        node.each(function (n) {
            for (let [i, attr] of Object.entries(nodeAttributes)) {
                if (attr in n.attributes) {
                    d3.select(this).append("line")
                        .attr("transform", "translate(" + (-nodeSize / 2 + nodeBarWidth / 2 + 1) + ", " + (nodeSize / 2 - 2) + ")")
                        .attr("x1", nodeBarDistance * i)
                        .attr("x2", nodeBarDistance * i)
                        .attr("y2", -nodeBarScales[attr](n.attributes[attr]))
                        .style("stroke-width", nodeBarWidth)
                        .style("stroke", nodeColors(attr));
                }
            }
        });

        node.append("text")
            .text(function (d) {
                return d.name;
            })
            .style("fill", "black")
            .style("font-size", fontSize)
            .attr("y", -nodeSize + nodeBarHeight * 1.1)
            .attr("dy", ".35em")
            .attr("text-anchor", "middle");

        d3.selectAll(".NLDNodes").selectAll("g")
            .attr("transform", function (d) {
                return "translate(" + d.x + "," + d.y + ")";
            });
    }

    /**
     * This function creates edge lines without encoding an attribute.
     */
    function plainEdges() {
        edge.append("line")
            .attr("class", "baseline")
            .attr("x1", function (d) {
                return d.source.x;
            })
            .attr("y1", function (d) {
                return d.source.y;
            })
            .attr("x2", function (d) {
                return d.target.x;
            })
            .attr("y2", function (d) {
                return d.target.y;
            })
            .style("fill", "none")
            .style("stroke", "gray");
    }

    function coloredEdges(attr) {
        plainEdges();
        g.selectAll(".NLDEdges").selectAll("line")
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
        edge.each(function (e) {
            for (let [i, [attr, value]] of Object.entries(Object.entries(e.attributes))) {
                let max = Object.keys(e.attributes).length - 1;
                d3.select(this).append("line")
                    .attr("x1", e.source.x)
                    .attr("y1", e.source.y)
                    .attr("x2", e.target.x)
                    .attr("y2", e.target.y)
                    // shift edges right or left from the middle edge
                    .attr("transform", function () {
                        let translation = shift(Math.round(max / 2 - i) * (max_edgeWidth + 2), e.source, e.target);
                        return "translate(" + translation.x + "," + translation.y + ")";
                    })
                    .attr("stroke-width", edgeWidthScales[attr](value))
                    .style("stroke", edgeColors(attr))
            }

            // visualize edges without attributes as plain edges
            if (!Object.keys(e.attributes).length) {
                d3.select(this).append("line")
                    .attr("class", "baseline")
                    .attr("x1", function (d) {
                        return d.source.x;
                    })
                    .attr("y1", function (d) {
                        return d.source.y;
                    })
                    .attr("x2", function (d) {
                        return d.target.x;
                    })
                    .attr("y2", function (d) {
                        return d.target.y;
                    })
                    .style("fill", "none")
                    .style("stroke", "gray");
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
        edge.each(function (e) {
            for (let [i, attr] of Object.entries(edgeAttributes)) {
                if (attr in e.attributes) {
                    let mid_x = (e.source.x + e.target.x) / 2;
                    let mid_y = (e.source.y + e.target.y) / 2;
                    let normalized = norm(e.source, e.target);
                    let shift_x = Math.round(max / 2 - i) * edgeBarDistance * normalized.x;
                    let shift_y = Math.round(max / 2 - i) * edgeBarDistance * normalized.y;

                    d3.select(this).append("line")
                        .attr("x1", mid_x + shift_x)
                        .attr("y1", mid_y + shift_y)
                        .attr("x2", mid_x + shift_x + edgeBarScales[attr](e.attributes[attr]) * normalized.y)
                        .attr("y2", mid_y + shift_y - edgeBarScales[attr](e.attributes[attr]) * normalized.x)
                        .style("stroke-width", edgeBarWidth)
                        .style("stroke", edgeColors(attr));
                }
            }
        });
    }
}
