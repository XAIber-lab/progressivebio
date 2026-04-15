function drawBioFabric(nodes, edges) {
    const margins = {left: 25};
    const nodeDistance = height / nodes.length;
    const widthForEdges = (width - margins.left);
    const edgeDistance = widthForEdges / edges.length;
    const squareSize = Math.min(10, edgeDistance * 0.4);
    const fontSize = Math.min(15, 0.7 * nodeDistance);

    // draw nodes
    sortNodes(nodeOrdering, nodes, edges);
    const positions = {};
    nodes.forEach(function (d, i) {
        positions[d.id] = nodeDistance * (i + 0.5);
    });

    let posOffset = ".35em";
    let negOffset = "-.35em";
    const node = g.append("g").attr("class", "nodes")
        .attr("transform", "translate(" + margins.left + ", 0)");
    const vis = node.selectAll("g")
        .data(nodes)
        .enter()
        .append("g")
        .attr("transform", x => "translate(0, " + positions[x.id] + ")");
    vis.append("line")
        .attr("class", "baseline")
        .attr("x2", widthForEdges)
        .attr("fill", "none")
        .attr("stroke", "gray")
        .attr("pointer-events", "none");
    vis.append("text")
        .text(x => x.name)
        .attr("dx", negOffset)
        .attr("dy", posOffset)
        .attr("fill", "black")
        .attr("text-anchor", "end")
        .attr("font-size", fontSize);

    // draw edges
    const ids = nodes.map(x => x.id);
    edges.forEach(function (d) {
        if (ids.indexOf(d.source) > ids.indexOf(d.target)) {    // source is always at top (important for patterns)
            let tmp = d.source;
            d.source = d.target;
            d.target = tmp;
        }
    });
    sortEdges(edgeOrdering, nodes, edges);

    const edge = g.append("g")
        .attr("class", "edges")
        .attr("transform", "translate(" + margins.left + ", 0)");
    edge.selectAll("g")
        .data(edges)
        .enter()
        .append("g")
        .attr("transform", (x, i) => "translate(" + (edgeDistance * (i + 0.5)) + ", 0)")
        .append("line")
        .attr("class", "baseline")
        .attr("y1", x => positions[x.source])
        .attr("y2", x => positions[x.target])
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("pointer-events", "none");
    edge.selectAll("g").append("rect")
        .attr("width", squareSize)
        .attr("height", squareSize)
        .attr("x", -squareSize / 2)
        .attr("y", x => positions[x.source] - squareSize / 2)
        .attr("fill", "black")
        .attr("pointer-events", "none");
    edge.selectAll("g").append("rect")
        .attr("width", squareSize)
        .attr("height", squareSize)
        .attr("x", -squareSize / 2)
        .attr("y", x => positions[x.target] - squareSize / 2)
        .attr("fill", "black")
        .attr("pointer-events", "none");

    // highlight nodes
    /* node.selectAll("g").append("rect")
        .attr("class", "background")
        .attr("x", -margins.left)
        .attr("y", -nodeDistance * 0.25)
        .attr("width", width)
        .attr("height", nodeDistance * 0.5)
        .attr("pointer-events", "visible")
        .attr("fill", "none")
        .lower();
    node.selectAll("g").on("mouseover", function (event, d) {
        let adjacentNodes = getAdjacentNodes(d, edges);
        let adjacentEdges = edges.filter(e => e.source === d.id || e.target === d.id);
        d3.select(this).classed("highlightNodeBF", true);
        d3.selectAll(".nodes g").filter(n => adjacentNodes.includes(n.id)).classed("highlightNodeBF", true);
        d3.selectAll(".edges g").filter(e => adjacentEdges.includes(e)).classed("highlightNodeBF", true);
    }).on("mouseout", function () {
        d3.selectAll(".nodes g, .edges g").classed("highlightNodeBF", false);
    }); */

    // highlight edges
    let offset = Math.max(nodeDistance * .25, squareSize);
    edge.selectAll("g").append("rect")
        .attr("class", "background")
        .attr("y", function (d) {
            return positions[d.source] > positions[d.target] ? positions[d.target] - offset : positions[d.source] - offset;
        })
        .attr("x", -0.25 * edgeDistance)
        .attr("width", edgeDistance * 0.5)
        .attr("height", function (d) {
            return (positions[d.source] > positions[d.target] ? (positions[d.source] - positions[d.target]) : (positions[d.target] - positions[d.source])) + 2 * offset;
        })
        .attr("pointer-events", "visible")
        .attr("fill", "none")
        .lower();

    edge.selectAll("g").append("rect")
        .attr("class", "source")
        .attr("y", function (d) {
            return positions[d.source] - offset;
        })
        .attr("x", -0.5 * edgeDistance)
        .attr("width",  edgeDistance)
        .attr("height", 2 * offset)
        .attr("pointer-events", "visible")
        .attr("fill", "none")
        .lower();

    edge.selectAll("g").append("rect")
        .attr("class", "target")
        .attr("y", function (d) {
            return positions[d.target] - offset;
        })
        .attr("x", -0.5 * edgeDistance)
        .attr("width",  edgeDistance)
        .attr("height", 2 * offset)
        .attr("pointer-events", "visible")
        .attr("fill", "none")
        .lower();
    /* edge.selectAll("g").on("mouseover", function (event, d) {
        d3.select(this).classed("highlightEdgeBF", true);
        d3.selectAll(".nodes g").filter(n => n.id === d.target || n.id === d.source).classed("highlightEdgeBF", true);
    }).on("mouseout", function () {
        d3.selectAll(".nodes g, .edges g").classed("highlightEdgeBF", false);
    }); */
}

function drawAdjacencyMatrix(nodes, edges) {
    const margins = {left: 25, top: 25};
    const cellSize = (height - margins.top) / nodes.length;
    const fontSize = Math.min(15, 0.7 * cellSize);

    // draw nodes
    sortNodes(nodeOrdering, nodes, edges);
    const positions = nodes.map(x => x.id).reduce((acc, id) => ({...acc, [id]: []}), {});
    nodes.forEach(function (d, i) {
        positions[d.id][0] = cellSize * i;
        positions[d.id][1] = cellSize * i;
    });

    let posOffset = ".35em";
    let negOffset = "-.35em";
    const node = g.append("g").attr("class", "nodes")
        .attr("transform", "translate(" + margins.left + ", " + margins.top + ")");
    const left = node.append("g")
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

    const top = node.append("g")
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

    // draw edges
    let swapped = edges.map(function (d) {
        return {"source": d.target, "target": d.source, "attributes": d.attributes};
    });
    const doubled = edges.concat(swapped);
    const edge = g.append("g")
        .attr("class", "edges")
        .attr("transform", "translate(" + margins.left + ", " + margins.top + ")");
    edge.selectAll("g")
        .data(doubled)
        .enter()
        .append("g")
        .attr("transform", function (d) {
            return "translate(" + positions[d.source][1] + ", " + positions[d.target][0] + ")";
        })
        //.raise()
        .append("rect")
        .attr("width", cellSize)
        .attr("height", cellSize);

    const selfloops = edge.append("g").attr("class", "selfloops")
    for (let i = 0; i < nodes.length; i++) {
        selfloops.append("g")
            .attr("transform", "translate(" + (cellSize * i) + ", " + cellSize * i + ")")
            .append("rect")
            .attr("width", cellSize)
            .attr("height", cellSize)
            .style("fill", "gray");
    }

    // draw grid
    const matrix = [];
    nodes.forEach(function (d1) {
        nodes.forEach(function (d2) {
            matrix.push({source: d1.id, target: d2.id});
        });
    });
    const grid = g.append("g")
        .attr("class", "grid")
        .attr("transform", "translate(" + margins.left + ", " + margins.top + ")")
        .attr("pointer-events", "all")
    grid.selectAll("g")
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
        .attr("stroke", "gray");

    // highlight nodes
    /* node.selectAll(".left g").on("mouseover", function (event, d) {
        d3.select(this).classed("highlightNodeAM", true);
        let adjacent = getAdjacentNodes(d, edges);
        d3.selectAll(".grid g").filter(x => x.source === d.id).classed("highlightNodeAM", true);
        d3.selectAll(".nodes .top g").filter(x => adjacent.includes(x.id)).classed("highlightNodeAM", true);
        d3.selectAll(".grid g").filter(x => adjacent.includes(x.target)).classed("highlightNodeAM", true);
    });
    node.selectAll(".top g").on("mouseover", function (event, d) {
        d3.select(this).classed("highlightNodeAM", true);
        let adjacent = getAdjacentNodes(d, edges);
        d3.selectAll(".grid g").filter(x => x.target === d.id).classed("highlightNodeAM", true);
        d3.selectAll(".nodes .left g").filter(x => adjacent.includes(x.id)).classed("highlightNodeAM", true);
        d3.selectAll(".grid g").filter(x => adjacent.includes(x.source)).classed("highlightNodeAM", true);
    });
    node.selectAll(".left g, .top g").on("mouseout", function () {
        d3.selectAll(".nodes g, .grid g").classed("highlightNodeAM", false);
    });

    // highlight grid
    grid.selectAll("g").on("mouseover", function (event, d) {
        d3.selectAll(".grid g").filter(x => d.source === x.source || d.target === x.target).classed("highlightEdgeAM", true);
        d3.selectAll(".nodes .top g").filter(x => d.target === x.id).classed("highlightEdgeAM", true);
        d3.selectAll(".nodes .left g").filter(x => d.source === x.id).classed("highlightEdgeAM", true);
    }).on("mouseout", function () {
        d3.selectAll(".nodes g, .grid g").classed("highlightEdgeAM", false);
    }); */
}

function drawNodeLinkDiagram(nodes, edges) {
    const fontSize = 15;
    const clone = JSON.parse(JSON.stringify(edges));

    // force directed layout
    d3.forceSimulation(nodes)
        .force("link", d3.forceManyBody().strength(-300))
        .force("charge", d3.forceLink(clone).id(function (d) {
            return d.id;
        }))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("boundary", forceBoundary(0, 0, width, height))
        .tick(100)
        .stop();

    // draw edges
    const edge = g.append("g")
        .attr("class", "edges");
    edge.selectAll("g")
        .data(clone)
        .enter()
        .append("g")
        .append("line")
        .attr("class", "baseline")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y)
        .attr("fill", "none")
        .attr("stroke", "gray");

    // draw nodes
    const node = g.append("g")
        .attr("class", "nodes");
    const vis = node.selectAll("g")
        .data(nodes)
        .enter()
        .append("g")
        .attr("transform", d => "translate(" + d.x + ", " + d.y + ")");
    const text = vis.append("text")
        .text(d => d.name)
        .attr("fill", "black")
        .attr("font-size", fontSize)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle");
    var bbox = text.node().getBBox();
    vis.append("circle")
        .attr("class", "nodeCircle")
        .attr("r", bbox.width / 2 + 6)
        .attr("fill", "white")
        .lower();
    vis.append("circle")
        .attr("r", bbox.width / 2 + 6)
        .attr("fill", "white")
        .lower();

    // highlight nodes
    /* node.selectAll("g").on("mouseover", function (event, d) {
        let adjacentNodes = getAdjacentNodes(d, edges);
        let adjacentEdges = clone.filter(e => e.source.id === d.id || e.target.id === d.id).map(e => e.index);
        d3.select(this).classed("highlightNodeNLD", true);
        d3.selectAll(".nodes g").filter(n => adjacentNodes.includes(n.id)).classed("highlightNodeNLD", true);
        d3.selectAll(".edges g").filter(e => adjacentEdges.includes(e.index)).classed("highlightNodeNLD", true);
    }).on("mouseout", function () {
        d3.selectAll(".nodes g, .edges g").classed("highlightNodeNLD", false);
    });

    // highlight edges
    edge.selectAll("g")
        .append("line")
        .attr("class", "background")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y)
        .attr("fill", "none")
        .attr("stroke-width", "7px")
        .attr("pointer-events", "visible")
        .attr("fill", "none")
        .lower();
    edge.selectAll("g").on("mouseover", function (event, d) {
        d3.select(this).classed("highlightEdgeNLD", true);
        d3.selectAll(".nodes g").filter(n => n.id === d.target.id || n.id === d.source.id).classed("highlightEdgeNLD", true);
    }).on("mouseout", function () {
        d3.selectAll(".nodes g, .edges g").classed("highlightEdgeNLD", false);
    }); */
}
