// Visualization of the quilt

/**
 * This function appends the visualization of the network data in a quilt to the given g element.
 * The visualization is scaled to the provided width and height of the visualization space.
 * Possibilities for additional parameters of the encoding technique are described below:
 * @param g
 * @param width of the visualization space
 * @param height of the visualization space
 * @param data of network
 * @param nodeEncoding [plainNodes | coloredNodes | juxtaposedNodes]
 * @param edgeEncoding [plainEdges | coloredEdges | squaredEdges | multipleEdges]
 * @param ordering of nodes, [Alphabetical | Mean | Degree | any node attribute]
 * @param nodeAttribute any node attribute for encoding
 * @param edgeAttribute any edge attribute for encoding
 */
function quilt(g, width, height, data, nodeEncoding, edgeEncoding, ordering, nodeAttribute, edgeAttribute) {
    let network = JSON.parse(JSON.stringify(data));

    // get node and edge categories and layers
    const nodeAttributes = getAttributeLabels(network.nodes);
    const edgeAttributes = getAttributeLabels(network.edges);
    let layers = getLayers(network.nodes);
    let attributesAsLayers = false;

    if (!nodeAttributes.length && nodeEncoding !== "coloredNodes") {
        nodeEncoding = "plainNodes";
    }
    if (!edgeAttributes.length && edgeEncoding !== "coloredEdges") {
        edgeEncoding = "plainEdges";
    }

    // if no explicit layers are declared, each layer represents a different attribute
    if (layers.length === 1 && layers.includes(-1)) {
        attributesAsLayers = true;
        defineLayers(network.nodes);
        layers = getLayers(network.nodes);
    }

    // define size properties
    const cellNumbers = countCells(network.nodes, network.edges, layers, nodeAttributes.length);
    const cellSize = nodeEncoding === "juxtaposedNodes" ?
        0.6 * Math.min(height / cellNumbers.vertical, width / cellNumbers.horizontal) :
        Math.min(height / cellNumbers.vertical, width / cellNumbers.horizontal, 50);

    const nodeBarWidth = 0.4 * Math.min(width, height) / nodeAttributes.length - 10;
    const nodeBarDistance = nodeBarWidth + 10;
    const nodeBarHeight = 0.2 * cellSize;

    const edgeNameSpace = cellSize * 0.3;
    const edgeBarWidth = cellSize / edgeAttributes.length;
    const edgeBarHeight = cellSize - edgeNameSpace;

    const nameLength = Math.max(...network.nodes.map(n => n.name.length));
    const fontSize = Math.min(nameLength < 10 ? 20 : 10, nameLength < 10 ? cellSize * 0.5 : cellSize * 0.25);
    const smallFontSize = Math.min(nameLength < 10 ? 14 : 5, cellSize * 0.25);
    const categoriesFontSize = 10;

    // define scales on each attribute
    const nodeBarScales = defineScales(nodeAttributes, network.nodes, 1, nodeBarWidth);
    const nodeOpacityScales = defineScales(nodeAttributes, network.nodes, 0.5, 1);
    const nodeColors = d3.scaleOrdinal(d3.schemeSet1).domain(nodeAttributes);

    const edgeSquareScales = defineScales(edgeAttributes, network.edges, 2, cellSize);
    const edgeBarScales = defineScales(edgeAttributes, network.edges, 1, edgeBarHeight);
    const edgeOpacityScales = defineScales(edgeAttributes, network.edges, 0.5, 1);
    const edgeColors = d3.scaleOrdinal(d3.schemeSet2).domain(edgeAttributes);

    let layerColors = attributesAsLayers ? nodeColors : d3.scaleOrdinal(d3.schemeSet3).domain(layers);

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
        default :
            if (nodeAttributes.includes(ordering)) {
                sortByAttribute(ordering, network.nodes);
            }
            break;
    }

    // define node positions
    const nodePositions = {};
    network.nodes.forEach(function (d) {
        let x, y;
        let distance_x = network.nodes.filter(n => layers.indexOf(n.layer) < layers.indexOf(d.layer) && isEven(n.layer, layers)).length
            + layers.filter(l => layers.indexOf(l) < layers.indexOf(d.layer) && !isEven(l, layers)).length;
        let distance_y = network.nodes.filter(n => layers.indexOf(n.layer) < layers.indexOf(d.layer) && !isEven(n.layer, layers)).length +
            layers.filter(l => layers.indexOf(l) < layers.indexOf(d.layer) && isEven(l, layers)).length;

        if (isEven(d.layer, layers)) {
            x = (network.nodes.filter(n => n.layer === d.layer).indexOf(d) + distance_x) * cellSize;
            y = distance_y * cellSize;
        } else {
            x = distance_x * cellSize;
            y = (network.nodes.filter(n => n.layer === d.layer).indexOf(d) + distance_y) * cellSize;
        }

        nodePositions[d.id] = {"x": x, "y": y};
    });

    // count skip links of each source node
    let skipLinks = {};
    network.nodes.forEach(function (d) {
        skipLinks[d.id] = 0;
    });

    // define edge positions based on the layers of source and target node
    const edgePositions = network.edges.map(function (d) {
        let x, y;
        let source = network.nodes.find(n => n.id === d.source);
        let target = network.nodes.find(n => n.id === d.target);

        if (areConsecutive(source.layer, target.layer, layers)) {
            if (isEven(source.layer, layers)) {
                x = nodePositions[d.source].x;
                y = nodePositions[d.target].y;
            } else {
                x = nodePositions[d.target].x;
                y = nodePositions[d.source].y;
            }
        } else {
            // skip links
            if (isEven(source.layer, layers)) {
                x = nodePositions[d.source].x;
                y = nodePositions[d.source].y + (network.nodes.filter(n => layers.indexOf(n.layer) === layers.indexOf(source.layer) + 1).length
                    + skipLinks[source.id] + 1) * cellSize;
            } else {
                x = nodePositions[d.source].x + (network.nodes.filter(n => layers.indexOf(n.layer) === layers.indexOf(source.layer) + 1).length
                    + skipLinks[source.id] + 1) * cellSize;
                y = nodePositions[d.source].y;
            }
            skipLinks[d.source]++;
        }
        return {"x": x, "y": y};
    });

    // append nodes with changing alignment
    const node = g.append("g")
        .attr("class", "QLTNodes")
        .selectAll("g")
        .data(network.nodes)
        .enter().append("g");

    node.append("rect")
        .attr("width", cellSize)
        .attr("height", cellSize)
        .attr("x", function (d) {
            return nodePositions[d.id].x;
        })
        .attr("y", function (d) {
            return nodePositions[d.id].y;
        })
        .style("fill", "#e9ecef")
        .style("stroke", "black")
        .style("stroke-width", "2px");

    node.append("text")
        .attr("transform", function (d) {
            return "translate(" + (nodePositions[d.id].x + cellSize / 2) + ", " + (nodePositions[d.id].y + cellSize / 2) + ")" + (nameLength < 10 ? "" : "rotate(-45)");
        })
        .text(function (d) {
            return d.name;
        })
        .attr("dy", ".35em")
        .style("fill", "black")
        .style("text-anchor", "middle")
        .style("font-size", fontSize);

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
    const edge = g.append("g")
        .attr("class", "QLTEdges")
        .selectAll("g")
        .data(network.edges)
        .enter().append("g");

    // apply encoding of edge attributes
    switch (edgeEncoding) {
        case "plainEdges":
            plainEdges();
            break;
        case "coloredEdges" :
            coloredEdge();
            break;
        case "squaredEdges":
            oneEdgeAttribute(edgeAttribute);
            break;
        case "multipleEdges":
            if (edgeAttributes.length === 0) {
                plainEdges();
            } else if (edgeAttributes.length === 1) {
                oneEdgeAttribute(edgeAttribute);
            } else if (edgeAttributes.length === 2) {
                twoEdgeAttributes();
            } else {
                multipleEdgeAttributes();
            }
            break;
    }

    // highlighting of nodes and edges
    d3.selectAll(".QLTNodes,.QLTAttributes").selectAll("g").on("mouseover", function (_, d) {
        d3.selectAll(".QLTNodes").selectAll("g").filter(n => n === d).selectAll("rect").raise().style("stroke-width", "4px");
        d3.selectAll(".QLTNodes").selectAll("g").filter(n => n === d).selectAll("text").raise();
        d3.selectAll(".QLTAttributes").selectAll("g").filter(n => n !== d).selectAll(".QLTBase").style("stroke-opacity", 0.25);
        d3.selectAll(".QLTAttributes").selectAll("g").filter(n => n !== d).selectAll(".QLTAttribute").attr("stroke-opacity", 0.5);
    }).on("mouseout", function () {
        d3.selectAll(".QLTNodes").selectAll("rect").style("stroke-width", "2px");
        d3.selectAll(".QLTAttributes").selectAll("g").selectAll(".QLTBase").style("stroke-opacity", 0.5);
        d3.selectAll(".QLTAttributes").selectAll("g").selectAll(".QLTAttribute").attr("stroke-opacity", 1);
    });

    d3.selectAll(".QLTEdges").selectAll("g").on("mouseover", function (_, d) {
        d3.selectAll(".QLTEdges").selectAll("g").selectAll("rect").filter(e => e !== d).attr("opacity", 0.5);
        d3.selectAll(".QLTEdges").selectAll("g").selectAll(".QLTBase").filter(e => e !== d).style("opacity", 0.25);
    }).on("mouseout", function () {
        d3.selectAll(".QLTEdges").selectAll("g").selectAll("rect").attr("opacity", 1);
        d3.selectAll(".QLTEdges").selectAll("g").selectAll(".QLTBase").style("opacity", 0.5);
    });

    /**
     * This function colors nodes based on the given attribute. Nodes that do not share this attribute remain plain.
     * The attribute value is encoded using opacity.
     * @param attr
     */
    function coloredNodes(attr) {
        if (nodeAttributes.includes(attr)) {
            d3.selectAll(".QLTNodes").selectAll("g").selectAll("rect")
                .style("fill", function (d) {
                    return attr in d.attributes ? nodeColors(attr) : "#e9ecef";
                })
                .style("fill-opacity", function (d) {
                    return attr in d.attributes ? nodeOpacityScales[attr](d.attributes[attr]) : 1;
                });
        } else {
            d3.selectAll(".QLTNodes").selectAll("g").selectAll("rect")
                .style("fill", function (d) {
                    return layerColors(d.layer);
                });
        }
    }

    /**
     * This function encodes the node attributes in a juxtaposed table aligned to each layer.
     */
    function juxtaposedNodeAttributes() {
        /**
         * This helper function calculates a translation based on the layer.
         * @param layer
         * @returns {string}
         */
        function transform(layer) {
            let trans_x, trans_y;
            let x = nodePositions[network.nodes.find(n => n.layer === layer).id].x;
            let y = nodePositions[network.nodes.find(n => n.layer === layer).id].y;
            let maxSkips = Math.max(...network.nodes.filter(n => n.layer === layer).map(n => skipLinks[n.id]));
            if (isEven(layer, layers)) {
                trans_x = x;
                trans_y = y + (network.nodes.filter(n => isFollowingLayer(n.layer, layer, layers)).length + maxSkips + 1) * cellSize + 10;
            } else {
                trans_x = x + (network.nodes.filter(n => isFollowingLayer(n.layer, layer, layers)).length + maxSkips + 1) * cellSize + 10;
                trans_y = y;
            }
            return "translate(" + trans_x + ", " + trans_y + ")";
        }

        // create background
        const background = g.append("g")
            .attr("class", "QLTBackground");

        layers.forEach(function (l) {
            nodeAttributes.forEach(function (d, i) {
                background.append("rect")
                    .attr("width", function () {
                        if (isEven(l, layers)) {
                            return network.nodes.filter(n => n.layer === l).length * cellSize;
                        } else {
                            return nodeBarWidth + 4;
                        }
                    })
                    .attr("height", function () {
                        if (isEven(l, layers)) {
                            return nodeBarWidth + 4;
                        } else {
                            return network.nodes.filter(n => n.layer === l).length * cellSize;
                        }
                    })
                    .attr("x", isEven(l, layers) ? 0 : (nodeBarDistance * i - 2))
                    .attr("y", isEven(l, layers) ? (nodeBarDistance * i - 2) : 0)
                    .attr("transform", transform(l))
                    .style("fill", "#e9ecef");
            });

            g.append("g")
                .attr("class", "QLTLabels")
                .selectAll("text")
                .data(nodeAttributes)
                .enter().append("text")
                .text(function (d) {
                    return d;
                })
                .attr("x", function (d, i) {
                    return isEven(l, layers) ? network.nodes.filter(n => n.layer === l).length * (cellSize + 1) : (nodeBarDistance * i - 2) + nodeBarWidth / 2;
                })
                .attr("y", function (d, i) {
                    return isEven(l, layers) ? (nodeBarDistance * i - 2) + nodeBarWidth / 2 : -5;
                })
                .attr("transform", transform(l))
                .style("text-anchor", isEven(l, layers) ? "start" : "middle")
                .style("font-size", categoriesFontSize);
        });

        network.nodes.forEach(function (d) {
            let index = network.nodes.filter(n => n.layer === d.layer).indexOf(d);
            background.append("line")
                .attr("x1", function () {
                    if (isEven(d.layer, layers)) {
                        return cellSize * index;
                    } else {
                        return -2;
                    }
                })
                .attr("y1", function () {
                    if (isEven(d.layer, layers)) {
                        return -2;
                    } else {
                        return cellSize * index;
                    }
                })
                .attr("x2", function () {
                    if (isEven(d.layer, layers)) {
                        return cellSize * index;
                    } else {
                        return nodeBarDistance * nodeAttributes.length;
                    }
                })
                .attr("y2", function () {
                    if (isEven(d.layer, layers)) {
                        return nodeBarDistance * nodeAttributes.length;
                    } else {
                        return cellSize * index;
                    }
                })
                .attr("transform", transform(d.layer))
                .style("stroke", "white");
        });

        // append a table for representation of attributes
        const table = g.append("g")
            .attr("class", "QLTAttributes")
            .selectAll("g")
            .data(network.nodes)
            .enter().append("g");

        table.each(function (d) {
            let i = network.nodes.filter(n => n.layer === d.layer).indexOf(d);
            for (let [j, attr] of Object.entries(nodeAttributes)) {
                if (attr in d.attributes) {
                    // add a base for the bars
                    d3.select(this).append("line")
                        .attr("class", "QLTBase")
                        .attr("x1", function (d) {
                            if (isEven(d.layer, layers)) {
                                return cellSize * (i + 0.5);
                            } else {
                                return nodeBarDistance * j;
                            }
                        })
                        .attr("y1", function (d) {
                            if (isEven(d.layer, layers)) {
                                return nodeBarDistance * j;
                            } else {
                                return cellSize * (i + 0.5);
                            }
                        })
                        .attr("x2", function (d) {
                            if (isEven(d.layer, layers)) {
                                return cellSize * (i + 0.5);
                            } else {
                                return nodeBarScales[attr].range()[1] + nodeBarDistance * j;
                            }
                        })
                        .attr("y2", function (d) {
                            if (isEven(d.layer, layers)) {
                                return nodeBarScales[attr].range()[1] + nodeBarDistance * j;
                            } else {
                                return cellSize * (i + 0.5);
                            }
                        })
                        .style("stroke", nodeColors(attr))
                        .style("stroke-opacity", 0.5)
                        .style("stroke-width", nodeBarHeight)
                        .attr("transform", transform(d.layer));

                    // add bars encoding the numerical attribute
                    d3.select(this).append("line")
                        .attr("class", "QLTAttribute")
                        .attr("x1", function (d) {
                            if (isEven(d.layer, layers)) {
                                return cellSize * (i + 0.5);
                            } else {
                                return nodeBarDistance * j;
                            }
                        })
                        .attr("y1", function (d) {
                            if (isEven(d.layer, layers)) {
                                return nodeBarDistance * j;
                            } else {
                                return cellSize * (i + 0.5);
                            }
                        })
                        .attr("x2", function (d) {
                            if (isEven(d.layer, layers)) {
                                return cellSize * (i + 0.5);
                            } else {
                                return nodeBarScales[attr](d.attributes[attr]) + nodeBarDistance * j;
                            }
                        })
                        .attr("y2", function (d) {
                            if (isEven(d.layer, layers)) {
                                return nodeBarScales[attr](d.attributes[attr]) + nodeBarDistance * j;
                            } else {
                                return cellSize * (i + 0.5);
                            }
                        })
                        .style("stroke", nodeColors(attr))
                        .style("stroke-width", nodeBarHeight)
                        .attr("transform", transform(d.layer));
                }
            }
        });
    }

    /**
     * This function fills the edge cells without encoding an attribute.
     */
    function plainEdges() {
        edge.each(function (e) {
            let source = network.nodes.find(n => n.id === e.source);
            let target = network.nodes.find(n => n.id === e.target);

            d3.select(this).append("rect")
                .attr("width", cellSize)
                .attr("height", cellSize)
                .attr("x", function (d) {
                    return edgePositions[network.edges.indexOf(d)].x;
                })
                .attr("y", function (d) {
                    return edgePositions[network.edges.indexOf(d)].y;
                });

            if (!areConsecutive(source.layer, target.layer, layers)) {
                d3.select(this).append("text")
                    .attr("transform", function (d) {
                        return "translate(" + (edgePositions[network.edges.indexOf(d)].x + cellSize / 2) + ", "
                            + (edgePositions[network.edges.indexOf(d)].y + cellSize / 2) + ")" + (nameLength < 10 ? "" : "rotate(-45)");
                    })
                    .text(target.name)
                    .style("fill", "black")
                    .attr("dy", ".35em")
                    .style("text-anchor", "middle")
                    .style("font-size", smallFontSize);
            }

            edge.selectAll("rect")
                .style("fill", "gray")
                .style("stroke", "black")
                .style("stroke-width", "1px");
        });
    }

    /**
     * This function encodes the layer of the target node on the edge filling it with the respective hue.
     */
    function coloredEdge() {
        plainEdges();
        edge.each(function (e) {
            let source = network.nodes.find(n => n.id === e.source);
            let target = network.nodes.find(n => n.id === e.target);
            d3.select(this).selectAll("rect")
                .style("fill", !areConsecutive(source.layer, target.layer, layers) ? layerColors(target.layer) : "gray")
                .style("fill-opacity", !areConsecutive(source.layer, target.layer, layers) ? 0.7 : 1);
        });

    }

    /**
     * This function encodes the given edge attribute by mapping the value to the size of the square filled in corresponding hue.
     * Nodes that do not share this attribute remain plain.
     * @param attr
     */
    function oneEdgeAttribute(attr) {
        plainEdges();
        edge.selectAll("rect")
            .attr("width", function (d) {
                return attr in d.attributes ? edgeSquareScales[attr](d.attributes[attr]) : cellSize ;
            })
            .attr("height", function (d) {
                return attr in d.attributes ? edgeSquareScales[attr](d.attributes[attr]) : cellSize;
            })
            .attr("transform", function (d) {
                return attr in d.attributes ?
                    "translate(" + (cellSize / 2 - edgeSquareScales[attr](d.attributes[attr]) / 2) + ", "
                    + (cellSize / 2 - edgeSquareScales[attr](d.attributes[attr]) / 2) + ")" :
                    "translate(0, 0)";
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
        let first = edgeAttributes[0]
        edge.append("rect")
            .attr("width", cellSize)
            .attr("height", cellSize)
            .style("fill", edgeColors(first))
            .style("fill-opacity", function (d) {
                return first in d.attributes ? edgeOpacityScales[first](d.attributes[first]) : 0;
            });

        edge.append("rect")
            .attr("width", cellSize / 2)
            .attr("height", cellSize / 2)
            .attr("x", cellSize / 4)
            .attr("y", cellSize / 4)
            .style("fill", "white");

        // encode second attribute in inner space
        let second = edgeAttributes[1]
        edge.append("rect")
            .attr("width", cellSize / 2)
            .attr("height", cellSize / 2)
            .attr("x", cellSize / 4)
            .attr("y", cellSize / 4)
            .style("fill", edgeColors(second))
            .style("fill-opacity", function (d) {
                return second in d.attributes ? edgeOpacityScales[second](d.attributes[second]) : 0;
            });

        edge.each(function (e) {
            let source = network.nodes.find(n => n.id === e.source);
            let target = network.nodes.find(n => n.id === e.target);
            if (!areConsecutive(source.layer, target.layer, layers)) {
                d3.select(this).append("text")
                    .text(target.name)
                    .attr("transform", "translate(" + (cellSize / 2) + ", " + (cellSize / 2) + ")" + (nameLength < 10 ? "" : "rotate(-45)"))
                    .style("fill", "black")
                    .style("font-size", smallFontSize)
                    .attr("dy", ".35em")
                    .attr("text-anchor", "middle");
            }
        });

        edge.append("rect")
            .attr("width", cellSize)
            .attr("height", cellSize)
            .style("fill", "none")
            .style("stroke", "black")
            .style("stroke-width", "1px");

        d3.selectAll(".QLTEdges").selectAll("g")
            .attr("transform", function (d) {
                return "translate(" + edgePositions[network.edges.indexOf(d)].x + "," + edgePositions[network.edges.indexOf(d)].y + ")";
            });
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
                        .attr("height", edgeBarHeight)
                        .attr("x", i * edgeBarWidth)
                        .attr("y", edgeNameSpace)
                        .style("fill", edgeColors(attr))
                        .style("fill-opacity", 0.3);

                    d3.select(this).append("rect")
                        .attr("class", "ADMEdgeAttribute")
                        .attr("width", edgeBarWidth)
                        .attr("height", function (d) {
                            return edgeBarScales[attr](d.attributes[attr]);
                        })
                        .attr("x", i * edgeBarWidth)
                        .attr("y", function (d) {
                            return edgeBarHeight - edgeBarScales[attr](d.attributes[attr]) + edgeNameSpace;
                        })
                        .style("fill", edgeColors(attr));
                }
            }

            // visualize edges without attributes as plain edges
            if (!Object.keys(e.attributes).length) {
                d3.select(this).append("rect")
                    .attr("width", cellSize)
                    .attr("height", cellSize)
                    .style("fill", "gray")
                    .style("stroke", "black")
                    .style("stroke-width", "1px");
            }
        });

        edge.append("rect")
            .attr("width", cellSize)
            .attr("height", cellSize)
            .style("fill", "none")
            .style("stroke", "black")
            .style("stroke-width", "1px");

        edge.each(function (e) {
            let source = network.nodes.find(n => n.id === e.source);
            let target = network.nodes.find(n => n.id === e.target);
            if (!areConsecutive(source.layer, target.layer, layers)) {
                d3.select(this).append("text")
                    .text(target.name)
                    .attr("transform", "translate(" + (cellSize / 2) + ", " + (edgeNameSpace / 2) + ")" + (nameLength < 10 ? "" : "rotate(-45)"))
                    .attr("dy", ".35em")
                    .style("fill", "black")
                    .style("text-anchor", "middle")
                    .style("font-size", smallFontSize);
            }
        });

        d3.selectAll(".QLTEdges").selectAll("g")
            .attr("transform", function (d) {
                return "translate(" + edgePositions[network.edges.indexOf(d)].x + "," + edgePositions[network.edges.indexOf(d)].y + ")";
            });
    }

    // overlay a grid
    const matrix = [];
    network.nodes.forEach(function (a) {
        network.nodes.forEach(function (b) {
            if (areConsecutive(a.layer, b.layer, layers)) {
                let x, y;
                if (isEven(a.layer, layers)) {
                    x = nodePositions[a.id].x;
                    y = nodePositions[b.id].y;
                } else {
                    x = nodePositions[b.id].x;
                    y = nodePositions[a.id].y;
                }
                matrix.push({"x": x, "y": y});
            }
        });
    });

    g.append("g")
        .attr("class", "QLTGrid")
        .selectAll("g")
        .data(matrix)
        .enter().append("rect")
        .attr("x", function (d) {
            return d.x;
        })
        .attr("y", function (d) {
            return d.y;
        })
        .attr("width", cellSize)
        .attr("height", cellSize)
        .style("fill", "none")
        .style("stroke", "black");
}