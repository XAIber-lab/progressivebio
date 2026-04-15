function bfCreateNodeTooltip() {
    d3.select("body")
        .append("div")
        .attr("class", "nodeTooltip")
        .style("visibility", "hidden");
}

function bfShowNodeTooltip(element, d, positions, nodes) {
    const node = nodes.find(x => x.id === d.id);
    const tooltip = d3.select(".nodeTooltip");
    if (typeof node !== "undefined" && Object.keys(node.attributes).length !== 0) {
        let message = Object.entries(node.attributes)
            .map(([key, value]) => `${key}: ${shortenNumber(value)}`)
            .join("<br>");
        tooltip.html("<small style='font-size: " + smallFontSize + "px;'>" + message + "</small>");
        var matrix = element.getScreenCTM()
            .translate(+element.getAttribute("x"), +element.getAttribute("y"));
        var yOffset = d3.select(".nodeTooltip").node().offsetHeight + 2;
        var nodeOffset = widthForEdges - margins.left
        tooltip.style("left", (window.pageXOffset + matrix.e + nodeOffset) + "px")
            .style("top", (window.pageYOffset + matrix.f - yOffset - squareSize) + "px")
            .style("visibility", "visible");
    } else {
        tooltip.style("visibility", "hidden");
    }
}

function bfHideNodeTooltip() {
    d3.select(".nodeTooltip").style("visibility", "hidden");
}

function bfCreateEdgeTooltip() {
    d3.select("body")
        .append("div")
        .attr("class", "edgeTooltip")
        .style("visibility", "hidden");
}

function bfShowEdgeTooltip(element, d, positions, edges) {
    const edge = edges.find(x => x.source === d.source && x.target === d.target);
    const tooltip = d3.select(".edgeTooltip");
    if (typeof edge !== "undefined" && Object.keys(edge.attributes).length !== 0) {
        let message = Object.entries(edge.attributes)
            .map(([key, value]) => `${key}: ${shortenNumber(value)}`)
            .join("<br>");
        tooltip.html("<small style='font-size: " + smallFontSize + "px;'>" + message + "</small>");
        var matrix = element.getScreenCTM()
            .translate(+element.getAttribute("x"), +element.getAttribute("y"));
        var yOffset = d3.select(".edgeTooltip").node().offsetHeight + 2;
        var edgeOffset = positions[edge.source] < positions[edge.target] ? positions[edge.source] : positions[edge.target];
        tooltip.style("left", (window.pageXOffset + matrix.e) + "px")
            .style("top", (window.pageYOffset + matrix.f - yOffset + edgeOffset - squareSize) + "px")
            .style("visibility", "visible");
    } else {
        tooltip.style("visibility", "hidden");
    }
}

function bfHideEdgeTooltip() {
    d3.select(".edgeTooltip").style("visibility", "hidden");
}