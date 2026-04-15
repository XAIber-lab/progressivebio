let nldNodeEncoding = "plain";
let nldEdgeEncoding = "plain";
let nldNodeAttribute = undefined;
let nldEdgeAttribute = undefined;
let nldLayout = "forcedirected"

let min_radius, max_radius, barWidth, distanceInBetween;

function nodelink_diagram(view, data) {
    // network properties
    const nodes = data.nodes;
    const edges = data.edges;
    const nodeAttributes = getAttributeLabels(nodes);
    const edgeAttributes = getAttributeLabels(edges);

    // visualization properties
    max_radius = 30;
    min_radius = 20;
    barWidth = 10;
    distanceInBetween = 0;

    const modSet1 = ["#377eb8", "#984ea3", "#ff7f00", "#a65628", "#f781bf", "#999999"];
    nodeColors = d3.scaleOrdinal(modSet1).domain(nodeAttributes);
    const modSet2 = ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494", "#b3b3b3"];
    edgeColors = d3.scaleOrdinal(modSet2).domain(edgeAttributes);

    const g = view.g.append("g").attr("id", "nld").attr("transform", "translate(" + margins.left + ", " + margins.top + ")");
    const image = [width - margins.left - margins.right, height - margins.top - margins.bottom]

    // handle layout
    let positions = {};
    layoutNodes();

    // handle edges
    const edge = g.append("g")
        .attr("class", "edges");
    drawEdges();
    visualizeEdgeAttributes();

    // handle nodes
    const node = g.append("g")
        .attr("class", "nodes")
    drawNodes();
    visualizeNodeAttributes();

    // organizer functions
    function layoutNodes() {
        forcedirected(view, nodes, nodeAttributes, edges);
        switch(nldLayout) {
            case "forcedirected":
                break;
            case "hierarchical":
                nodes.forEach(function (d) {
                    d.x = image[0] * d.hierarchy[0];
                    d.y = image[1] * d.hierarchy[1];
                })
                break;
            case "centrality":
                nodes.forEach(function (d) {
                    d.x = image[0] * d.radial[0];
                    d.y = image[1] * d.radial[1];
                })
                break;
        }
    }

    function drawEdges() {
        edge.selectAll("g")
            .data(edges)
            .enter()
            .append("g")
            .append("line")
            .attr("class", "baseline")
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y)
            .attr("fill", "none")
            .attr("stroke", "black");
    }

    function drawNodes() {
        const vis = node.selectAll("g")
            .data(nodes)
            .enter()
            .append("g")
            .attr("transform", d => "translate(" + d.x + ", " + d.y + ")")

        vis.append("circle")
            .attr("r", min_radius)
            .attr("fill", "#e9ecef");

        vis.append("text")
            .text(d => d.name)
            .attr("fill", "black")
            .attr("font-size", fontSize)
            .attr("dy", ".35em")
            .attr("text-anchor", "middle");
    }

    function visualizeEdgeAttributes() {
        switch (nldEdgeEncoding) {
            case "plain" :
                break;
            case "color":
                nldColoredEdges(nldEdgeAttribute, edges, edgeAttributes);
                break;
            case "parallel" :
                nldParallelEdges(edges, edgeAttributes);
                break;
            case "bar" :
                nldBarsOnEdges(edges, edgeAttributes);
                break;
        }
    }

    function visualizeNodeAttributes() {
        switch (nldNodeEncoding) {
            case "plain" :
                break;
            case "color" :
                nldColoredNodes(nldNodeAttribute, nodes, nodeAttributes);
                break;
            case "bar" :
                nldBarsOnNodes(nodes, nodeAttributes);
                break;
        }
    }
}

function changeNodeEncodingNLD(encoding) {
    nldNodeEncoding = encoding;
}

function changeEdgeEncodingNLD(encoding) {
    nldEdgeEncoding = encoding;
}

function changeSelectedNodeAttributeNLD(attr) {
    nldNodeAttribute = attr;
}

function changeSelectedEdgeAttributeNLD(attr) {
    nldEdgeAttribute = attr;
}

function changeLayoutNLD(layout) {
    nldLayout = layout;
}