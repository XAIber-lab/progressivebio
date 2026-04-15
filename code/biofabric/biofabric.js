let bfNodeEncoding = "plain";
let bfEdgeEncoding = "plain";
let bfNodeAttribute = undefined;
let bfEdgeAttribute = undefined;
let bfNodeOrdering = "alphabetical";
let bfOrderingNode = undefined;
let bfEdgeOrdering = "nodes";
//let bfNodeShading = false;
let bfDoubleEdges = false;
let bfPattern = "none";

let nodeDistance, edgeDistance, widthForEdges, widthForNodeBars, squareSize; /*, fontSize, smallFontSize;
let nodeColors, edgeColors;

const triangle = d3.symbol().type(d3.symbolTriangle2);
triangle.size(50);
const path = triangle();*/

function biofabric(view, data) {
    // network properties
    const nodes = data.nodes;
    let edges = data.edges;
    const nodeAttributes = getAttributeLabels(nodes);
    const edgeAttributes = getAttributeLabels(edges);

    // visualization properties
    nodeDistance = (bfEdgeEncoding.toLowerCase().includes("juxta") ? 2 / 3 : 1) * (view.height - margins.top - margins.bottom) / nodes.length;
    widthForEdges = (bfNodeEncoding.toLowerCase().includes("juxta") ? 2 / 3 : 1) * (view.width - margins.left - margins.right);

    widthForNodeBars = bfNodeEncoding === "barLine" ? .05 * widthForEdges : 0;
    edgeDistance = (widthForEdges - widthForNodeBars) / edges.length * (bfDoubleEdges ? .5 : 1);
    squareSize = Math.min(15, Math.max(3, edgeDistance * 0.5, nodeDistance * 0.5));

    // TODO: adapt font size and colors
    const max_nameLength = Math.max(...nodes.map(n => n.name.length));
    fontSize = study ? (nodes.length < 30 ? 14 : (nodes.length < 60 ? 12 : 10)) : (Math.min(max_nameLength < 7 ? 20 : 10, max_nameLength < 10 ? cellSize * 0.5 : cellSize * 0.25));
    smallFontSize = 10;

    const modSet1 = ["#377eb8", "#984ea3", "#ff7f00", "#a65628", "#f781bf", "#999999"];
    nodeColors = d3.scaleOrdinal(modSet1).domain(nodeAttributes);
    const modSet2 = ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494", "#b3b3b3"];
    edgeColors = d3.scaleOrdinal(modSet2).domain(edgeAttributes);

    const g = view.g.append("g").attr("id", "bf");

    // handle nodes
    sortNodes(nodes, nodeAttributes, edges, data);
    const nodePositions = {};
    nodes.forEach(function (d, i) {
        nodePositions[d.id] = nodeDistance * (i + 0.5);
    });

    const node = g.append("g").attr("class", "nodes")
        .attr("transform", "translate(" + margins.left + ", " + margins.top + ")");
    const ids = nodes.map(x => x.id);
    drawNodes(node, nodes, nodePositions);
    visualizeNodeAttributes(view, nodes, nodePositions, nodeAttributes);

    // handle edges
    let swapped = edges.map(function (d) {
        return {"source": d.target, "target": d.source, "attributes": d.attributes};
    });
    const doubled = edges.concat(swapped);

    if (bfDoubleEdges) {
        edges = doubled;
    } else {
        unifyEdges();
    }

    sortEdges(nodes, edgeAttributes, edges);
    const edge = g.append("g")
        .attr("class", "edges")
        .attr("transform", "translate(" + (margins.left + widthForNodeBars) + ", " + margins.top + ")");
    drawEdges(edge, edges, nodePositions);
    visualizeEdgeAttributes(view, edges, edgeAttributes);
    addSquares(edge, nodePositions);

    // handle interaction
    //addSelection(g, nodes, nodePositions, edges);
    enableEdgeInteraction(edge, nodePositions, edges);
    enableNodeInteraction(node, nodePositions, edges);
    addOrderingPossibilities(g, view, data);

    // identify patterns
    addStatistics(nodes, edges);
    detectPatterns(nodes, edges);
    enableChangeOfParameters(nodes, edges, 12); // TODO add maximum of edge length

    let pattern = d3.selectAll("#patterns").selectAll(".nav-item.active").select(".nav-link").attr("id");
    d3.select("#parameters" + pattern.charAt(0).toUpperCase() + pattern.slice(1)).style("visibility", "visible");
    d3.select("#statistics" + pattern.charAt(0).toUpperCase() + pattern.slice(1)).style("visibility", "visible");

    d3.selectAll("#patterns").selectAll(".nav-item").on("click", function () {
        d3.selectAll("#patterns").selectAll(".nav-item").classed("active", false);
        d3.select(this).classed("active", true);

        let pattern = d3.select(this).select(".nav-link").attr("id");
        d3.selectAll(".parameters, .statistics").style("visibility", "hidden");
        d3.select("#parameters" + pattern.charAt(0).toUpperCase() + pattern.slice(1)).style("visibility", "visible");
        d3.select("#statistics" + pattern.charAt(0).toUpperCase() + pattern.slice(1)).style("visibility", "visible");

        detectPatterns(nodes, edges);
    });

    /*stairs = detectStairs(nodes, edges);
    switchStairsBF(d3.selectAll("#stairsBF").property("checked"));
    escalators = detectEscalators(nodes, edges); // TODO: check on artificial dataset
    switchEscalatorsBF(d3.selectAll("#escalatorsBF").property("checked"));
    let maximum = addStatistics(nodes, edges, qualities);
    console.log("paths", detectPaths(nodes, edges));*/


    //showPattern();

    // organizer functions
    function sortNodes(nodes, attributes, edges, data) {
        switch (bfNodeOrdering.toLowerCase()) {
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
                sortByNeighborhood(nodes, edges, bfOrderingNode);
                break;
            case "cluster":
                // TODO
                break;
            case "gansner":
                sortByGansner(nodes);
                break;
            default :
                if (attributes.includes(bfNodeOrdering)) {
                    sortByAttribute(bfNodeOrdering, nodes);
                }
                break;
        }
    }

    function drawNodes(g, nodes, positions) {
        let posOffset = ".35em";
        let negOffset = "-.35em";
        const vis = g.selectAll("g")
            .data(nodes)
            .enter()
            .append("g")
            .attr("transform", x => "translate(0, " + positions[x.id] + ")");

        vis.append("line")
            .attr("class", "baseline")
            .attr("x2", widthForEdges)
            .attr("fill", "none")
            .attr("stroke", "gray");

        vis.append("text")
            .text(x => x.name)
            .attr("dx", negOffset)
            .attr("dy", posOffset)
            .attr("fill", "black")
            .attr("text-anchor", "end")
            .attr("font-size", fontSize);
    }

    function sortEdges(nodes, attributes, edges) {
        if (bfDoubleEdges) {
            sortBySourceNodes(nodes, edges, attributes, bfEdgeOrdering);
        } else {
            switch (bfEdgeOrdering.toLowerCase()) {
                case "random":
                    sortRandomly(edges);
                    break;
                case "nodes" :
                    sortByNodes(nodes, edges);
                    break;
                case "degree":
                    sortEdgesByDegree(nodes, edges);
                    break;
                case "mean" :
                    sortByMean(edges);
                    break;
                case "staircases":
                    sortForStaircases(nodes, edges);
                    break;
                default :
                    if (attributes.includes(bfEdgeOrdering)) {
                        sortByNodes(nodes, edges);
                        sortByAttribute(bfEdgeOrdering, edges);
                    } else if (Array.isArray(bfEdgeOrdering) && bfEdgeOrdering.map(a => edgeAttributes.includes(a)).every(Boolean)) {
                        sortByNodes(nodes, edges);
                        sortByTwoAttributes(bfEdgeOrdering, edges);
                    }
                    break;
            }
        }
    }

    function unifyEdges() {
        edges.forEach(function (d) {
            if (ids.indexOf(d.source) > ids.indexOf(d.target)) {    // source is always at top
                let tmp = d.source;
                d.source = d.target;
                d.target = tmp;
            }
        });
    }

    function drawEdges(g, edges, positions) {
        g.selectAll("g")
            .data(edges)
            .enter()
            .append("g")
            .attr("transform", (x, i) => "translate(" + (edgeDistance * (i + 0.5)) + ", 0)")
            .append("line")
            .attr("class", "baseline")
            .attr("y1", x => positions[x.source])
            .attr("y2", x => positions[x.target])
            .attr("fill", "none")
            .attr("stroke", "black");
    }

    function addSquares(g, positions) {
        const sources = g.selectAll("g").append("rect")
            .attr("width", squareSize)
            .attr("height", squareSize)
            .attr("x", -squareSize / 2)
            .attr("y", x => positions[x.source] - squareSize / 2)
            .attr("fill", "black");

        const targets = g.selectAll("g").append("rect")
            .attr("width", squareSize)
            .attr("height", squareSize)
            .attr("x", -squareSize / 2)
            .attr("y", x => positions[x.target] - squareSize / 2)
            .attr("fill", "black");

        // adapt to multiple node lines
        if (["parallelLine", "dashedLine"].includes(bfNodeEncoding)) {
            const maxWidth = Math.max(1, Math.min(10, 2 / 3 * nodeDistance / nodeAttributes.length));
            sources.attr("height", function (e) {
                let source = nodes.find(n => n.id === e.source);
                return Math.max(Object.keys(source.attributes).length * (maxWidth + 2), squareSize);
            })
                .attr("y", function (e) {
                    let source = nodes.find(n => n.id === e.source);
                    let max = Object.keys(source.attributes).length;
                    if (max * (maxWidth + 2) > squareSize) {
                        if (max % 2 === 0) {
                            return positions[e.source] - (max + 1) * (maxWidth + 2) / 2;
                        } else {
                            return positions[e.source] - max * (maxWidth + 2) / 2;
                        }
                    } else {
                        return positions[e.source] - squareSize / 2;
                    }
                });

            targets.attr("height", function (e) {
                let source = nodes.find(n => n.id === e.target);
                return Math.max(Object.keys(source.attributes).length * (maxWidth + 2), squareSize);
            })
                .attr("y", function (e) {
                    let source = nodes.find(n => n.id === e.target);
                    let max = Object.keys(source.attributes).length;
                    if (max * (maxWidth + 2) > squareSize) {
                        if (max % 2 === 0) {
                            return positions[e.target] - (max + 1) * (maxWidth + 2) / 2;
                        } else {
                            return positions[e.target] - max * (maxWidth + 2) / 2;
                        }
                    } else {
                        return positions[e.target] - squareSize / 2;
                    }
                });
        } else if (bfNodeEncoding === "curvedLine") {
            sources.attr("height", 2 * nodeDistance / 3 + 4)
                .attr("y", function (e) {
                    return positions[e.source] - nodeDistance / 3 - 2;
                });

            targets.attr("height", 2 * nodeDistance / 3 + 4)
                .attr("y", function (e) {
                    return positions[e.target] - nodeDistance / 3 - 2;
                });
        }

        if (["parallel", "parallelAndJuxta", "dashed"].includes(bfEdgeEncoding)) {
            const maxWidth = Math.max(1, Math.min(10, 2 / 3 * nodeDistance / edgeAttributes.length));
            sources.attr("width", function (e) {
                return Math.max(Object.keys(e.attributes).length * (maxWidth + 2), squareSize);
            })
                .attr("x", function (e) {
                    if (Object.keys(e.attributes).length < 2) {
                        return -squareSize / 2;
                    } else {
                        return -0.5 * maxWidth - Math.round((Object.keys(e.attributes).length - 1) / 2) * (maxWidth + 2);
                    }
                });

            targets.attr("width", function (e) {
                return Math.max(Object.keys(e.attributes).length * (maxWidth + 2), squareSize);
            })
                .attr("x", function (e) {
                    if (Object.keys(e.attributes).length < 2) {
                        return -squareSize / 2;
                    } else {
                        return -0.5 * maxWidth - Math.round((Object.keys(e.attributes).length - 1) / 2) * (maxWidth + 2);
                    }
                });
        } /*else if (bfEdgeEncoding === "dashed") {
            const maxWidth = Math.max(1, Math.min(10, 2/3 * nodeDistance / edgeAttributes.length));
            sources.attr("width", function (e) {
                return Math.max(Object.keys(e.attributes).length * (maxWidth / 2 + 2), squareSize);
            })
                .attr("x", function (e) {
                    if (Object.keys(e.attributes).length < 2) {
                        return - squareSize / 2;
                    } else {
                        return - maxWidth / 4 - Math.round((Object.keys(e.attributes).length - 1) / 2) * (maxWidth / 2 + 2);
                    }
                });

            targets.attr("width", function (e) {
                return Math.max(Object.keys(e.attributes).length * (maxWidth / 2 + 2), squareSize);
            })
                .attr("x", function (e, i) {
                    if (Object.keys(e.attributes).length < 2) {
                        return edgeDistance * i - squareSize / 2;
                    } else {
                        return edgeDistance * i - maxWidth / 4 - Math.round((Object.keys(e.attributes).length - 1) / 2) * (maxWidth / 2 + 2);
                    }
                });
        }*/
    }

    function visualizeNodeAttributes(view, nodes, positions, attributes) {
        switch (bfNodeEncoding) {
            case "plain":
                break;
            case "colorCircle":
                coloredNodeCircles(bfNodeAttribute, nodes, attributes);
                break;
            case "barNodes" :
                barsOnNodes(nodes, attributes);
                break;
            case "colorLine":
                coloredNodeLines(bfNodeAttribute, nodes, attributes);
                break;
            case "parallelLine":
                parallelNodeLines(nodes, attributes);
                break;
            case "curvedLine":
                curvedNodeLines(nodes, attributes);
                break;
            case "dashedLine":
                dashedNodeLines(nodes, attributes);
                break;
            case "barLine":
                barsOnNodeLines(nodes, attributes);
                break;
            case "juxta":
                bfJuxtaposedNodeAttributes(view, nodes, positions, attributes);
                break;
        }
    }

    function visualizeEdgeAttributes(view, edges, attributes) {
        switch (bfEdgeEncoding) {
            case "plain":
                break;
            case "color":
                coloredEdgeLines(bfEdgeAttribute, edges, attributes);
                break;
            case "parallel":
                parallelEdges(edges, nodePositions, attributes);
                break;
            case "curved":
                curvedEdges(edges, nodePositions, attributes);
                break;
            case "dashed":
                dashedEdges(edges, nodePositions, attributes);
                break;
            case "bars":
                barsOnEdges(edges, nodePositions, attributes);
                break;
            case "juxta":
                juxtaposedEdgeAttributes(view, edges, nodes, nodePositions, attributes);
                break;
            case "parallelAndJuxta":
                parallelEdges(edges, nodePositions, attributes);
                juxtaposedEdgeAttributes(view, edges, nodes, nodePositions, attributes);
                break;
            case "barsAndJuxta":
                barsOnEdges(edges, nodePositions, attributes);
                juxtaposedEdgeAttributes(view, edges, nodes, nodePositions, attributes);
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
            changeSelectedNodeOrderingBF("alphabetical");
            biofabric(view, data);
        });

        // gansner
        const gansner = buttons.append("g")
            .attr("class", "gansner")
            .attr("transform", "translate(0, " + fontSize * 2 + ")");
        gansner.append("rect")
            .attr("width", margins.left)
            .attr("height", fontSize * 1.5)
            .attr("fill", "white")
            .attr("stroke", "gray")
            .attr("stroke-width", "1px");
        gansner.append("text")
            .text("Gansner")
            .attr("x", margins.left * 0.25)
            .attr("dy", "1em")
            .attr("text-anchor", "start")
            .attr("font-size", fontSize);
        gansner.append("path")
            .attr("transform", "translate(10, " + (0.7 * fontSize) + ") rotate(180 0 0)")
            .attr("d", path)
            .attr("stroke", "gray")
            .attr("fill", "white");
        gansner.on("click", function () {
            view.g.selectAll("*").remove();
            changeSelectedNodeOrderingBF("gansner");
            biofabric(view, data);
        });

        // node attributes
        g.selectAll(".juxtatableNodes .header > g")
            .append("path")
            .attr("transform", "translate(10, " + (0.7 * fontSize) + ") rotate(180 0 0)")
            .attr("d", path)
            .attr("stroke", "gray")
            .attr("fill", "white");

        g.selectAll(".juxtatableNodes .header > g").on("click", function (event, d) {
            view.g.selectAll("*").remove();
            changeSelectedNodeOrderingBF(d);
            biofabric(view, data);
        });

        // edge attributes
        g.selectAll(".juxtatableEdges .header > g")
            .append("path")
            .attr("transform", "translate(10, 0) rotate(90 0 0)")
            .attr("d", path)
            .attr("stroke", "gray")
            .attr("fill", "white");

        g.selectAll(".juxtatableEdges .header > g").on("click", function (event, d) {
            view.g.selectAll("*").remove();
            changeSelectedEdgeOrderingBF(d);
            biofabric(view, data);
        });

        // adjacent nodes
        g.selectAll(".nodes text").attr("x", -fontSize * 1.5);
        let adjacenct = g.selectAll(".nodes g")
            .append("g")
            .attr("class", "sort")
            .attr("transform", "translate(" + (-fontSize * 1.5) + ", " + (-fontSize * 0.5) + ")");
        adjacenct.append("rect")
            .attr("width", fontSize)
            .attr("height", fontSize)
            .attr("fill", "gray")
            .attr("stroke", "gray")
            .attr("stroke-width", "1px");
        adjacenct.append("path")
            .attr("transform", "translate(" + (0.5 * fontSize) + "," + (0.5 * fontSize) + ") rotate(90 0 0)")
            .attr("d", path)
            .attr("stroke", "white")
            .attr("fill", "white");

        g.selectAll(".nodes .sort").on("click", function (event, d) {
            bfOrderingNode = d;
            selectedNode = d;
            changeSelectedNodeOrderingBF("adjacency");
            changeSelectedEdgeOrderingBF("nodes");
            view.g.selectAll("*").remove();
            biofabric(view, data);
        });

        bfHighlightSelectedNodeOrdering(bfNodeOrdering, bfOrderingNode, nodeAttributes);
        bfHighlightSelectedEdgeOrdering(bfEdgeOrdering, edgeAttributes);
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
                return "translate(0, " + positions[d.id] + ")";
            });

        selection.append("rect")
            .attr("transform", "translate(5, " + (-size / 2) + ")")
            .attr("width", size)
            .attr("height", size)
            .attr("stroke", "gray")
            .attr("fill", "white")
            .attr("stroke-width", "2px");

        selection.append("rect")
            .attr("class", "checkmark")
            .attr("transform", "translate(6, " + (-(size - 2) / 2) + ")")
            .attr("width", size - 2)
            .attr("height", size - 2)
            .attr("fill", "blue")
            .attr("fill-opacity", 0.6)
            .attr("display", "none");

        g.selectAll(".checkbox").on("mouseover", function (event, d) {
            highlightNodes(d3.selectAll("#bf .nodes g").filter(x => x === d), d, edges);
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

    function enableNodeInteraction(node, positions, edges) {
        node.selectAll("g").append("rect")
            .attr("class", "background")
            .attr("x", -margins.left)
            .attr("y", -nodeDistance * 0.25)
            .attr("width", view.width)
            .attr("height", nodeDistance * 0.5)
            .attr("pointer-events", "visible")
            .attr("fill", "none")
            .lower();

        if (selectedNode !== null) {
            let selected = node.selectAll("g").filter(x => x.id === selectedNode.id);
            bfFixHighlightedNodes(selected, selected.data()[0], edges);
        }

        bfCreateNodeTooltip();
        node.selectAll("g").on("mouseover", function (event, d) {
            bfHighlightNodes(d3.select(this), d, edges);
            bfShowNodeTooltip(this, d, positions, nodes);
        });
        node.selectAll("g").on("mouseout", function () {
            bfRemoveHighlightedNodes();
            bfHideNodeTooltip();
        });
        node.selectAll("g").on("click", function (event, d) {
            bfFixHighlightedNodes(d3.select(this), d, edges);
        });
    }

    function enableEdgeInteraction(edge, positions, edges) {
        let offset = Math.min(nodeDistance * .25, squareSize);
        edge.selectAll("g").append("rect")
            .attr("class", "background")
            .attr("y", function (d) {
                return positions[d.source] > positions[d.target] ? positions[d.target] - offset : positions[d.source] - offset;
            })
            .attr("x", -0.25 * edgeDistance)
            .attr("width", edgeDistance * 0.5)
            .attr("height", function (d) {
                let start = positions[d.source] > positions[d.target] ? positions[d.target] : positions[d.source];
                if (bfEdgeEncoding.toLowerCase().includes("juxta")) {
                    return view.height - margins.top - margins.bottom - start + offset;
                } else {
                    return (positions[d.source] > positions[d.target] ? (positions[d.source] - positions[d.target]) : (positions[d.target] - positions[d.source])) + 2 * offset;
                }
            })
            .attr("pointer-events", "visible")
            .attr("fill", "none")
            .lower();

        if (selectedEdge !== null) {
            let selected = edge.selectAll("g").filter(x => x.target === selectedEdge.target && x.source === selectedEdge.source);
            bfFixHighlightedEdges(selected, selected.data()[0]);
        }

        bfCreateEdgeTooltip();
        edge.selectAll("g").on("mouseover", function (event, d) {
            bfHighlightEdges(d3.select(this), d);
            bfShowEdgeTooltip(this, d, positions, edges);
        });
        edge.selectAll("g").on("mouseout", function () {
            bfRemoveHighlightedEdges();
            bfHideEdgeTooltip();
        });
        edge.selectAll("g").on("click", function (event, d) {
            bfFixHighlightedEdges(d3.select(this), d);
        });
    }
}

function changeNodeEncodingBF(encoding) {
    bfNodeEncoding = encoding;
}

function changeEdgeEncodingBF(encoding) {
    bfEdgeEncoding = encoding;
}

function changeSelectedNodeAttributeBF(attr) {
    bfNodeAttribute = attr;
}

function changeSelectedEdgeAttributeBF(attr) {
    bfEdgeAttribute = attr;
}

function changeSelectedNodeOrderingBF(attr) {
    bfNodeOrdering = attr;
}

function changeSelectedEdgeOrderingBF(attr) {
    if (attr === "Index of Nodes") { attr = "nodes"}
    bfEdgeOrdering = attr;
}

function switchDoubleEdgesBF(bool) {
    bfDoubleEdges = bool;
}

function removeCreatedDivs() {
    d3.selectAll(".parameters, .statistics, #statisticsLength, .edgeTooltip, .nodeTooltip").remove();
}