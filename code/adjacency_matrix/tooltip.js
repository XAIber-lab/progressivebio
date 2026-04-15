function createNodeTooltip() {
    d3.select("body")
        .append("div")
        .attr("class", "nodeTooltip")
        .style("visibility", "hidden");
}

function showNodeTooltip(element, d, nodes) {
    const node = nodes.find(x => x.id === d.id);
    const tooltip = d3.select(".edgeTooltip");
    if (typeof node !== "undefined" && Object.keys(node.attributes).length !== 0) {
        let message = Object.entries(node.attributes)
            .map(([key, value]) => `${key}: ${shortenNumber(value)}`)
            .join("<br>");
        tooltip.html("<small style='font-size: " + smallFontSize + "px;'>" + message + "</small>");
        var matrix = element.getScreenCTM()
            .translate(+element.getAttribute("x"), +element.getAttribute("y"));
        var yOffset = d3.select(".nodeTooltip").node().offsetHeight;
        var xOffset = nodes.length * cellSize
        tooltip.style("left", (window.pageXOffset + matrix.e + xOffset) + "px")
            .style("top", (window.pageYOffset + matrix.f - yOffset) + "px")
            .style("visibility", "visible");
    } else {
        tooltip.style("visibility", "hidden");
    }
}

function hideNodeTooltip() {
    d3.select(".nodeTooltip").style("visibility", "hidden");
}

function createEdgeTooltip() {
    d3.select("body")
        .append("div")
        .attr("class", "edgeTooltip")
        .style("visibility", "hidden");
}

function showEdgeTooltip(element, d, positions, edges) {
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
        tooltip.style("left", (window.pageXOffset + matrix.e + cellSize * 0.5) + "px")
            .style("top", (window.pageYOffset + matrix.f - yOffset) + "px")
            .style("visibility", "visible");
    } else {
        tooltip.style("visibility", "hidden");
    }
}

function hideEdgeTooltip() {
    d3.select(".edgeTooltip").style("visibility", "hidden");
}