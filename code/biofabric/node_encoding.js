/**
 * This function encodes one given node attribute by mapping the value to the radius of a circle filled in corresponding hue.
 * Nodes that do not share this attribute remain plain.
 */
function coloredNodeCircles(attr, nodes, attributes) {
    const min_nodeRadius = 0 // nodeDistance * 0.2;
    const max_nodeRadius = nodeDistance * 0.4;
    const nodeRadiusScales = defineScales(attributes, nodes, min_nodeRadius, max_nodeRadius);

    const node = d3.selectAll("#bf .nodes g");
    node.append("circle")
        .attr("transform", "translate(-" + max_nodeRadius + ", 0)")
        .attr("r", x => attr in x.attributes ? nodeRadiusScales[attr](x.attributes[attr]) : min_nodeRadius)
        .style("fill", x => attr in x.attributes ? nodeColors(attr) : "#e9ecef");
    node.select("text")
        .attr("x", -max_nodeRadius)
        .attr("dx", "0")
        .attr("text-anchor", "middle")
        .raise();
}

/**
 * This function encodes the node attributes in a bar chart.
 */
function barsOnNodes(nodes, attributes) {
    const size = nodeDistance * 0.9;
    const distanceInBetween = 0;
    const barHeight = 2/3 * size;
    const barWidth = size / attributes.length;
    const scales = defineScales(attributes, nodes, 0, barHeight);

    const node = d3.selectAll("#bf .nodes g");

    const barchart = node.append("g")
        .attr("transform", "translate(" + (-size) + ", " + (-size * 0.5) + ")")
    barchart.append("rect")
        .attr("width", size)
        .attr("height", size)
        .style("fill", "#e9ecef");
    barchart.each(function (d) {
        for (let attr in d.attributes) {
            let j = attributes.indexOf(attr);
            d3.select(this).append("rect")
                .attr("transform", "translate(" + ((barWidth + distanceInBetween) * j) + ", " + (size - scales[attr](d.attributes[attr])) + ")")
                .attr("width", barWidth)
                .attr("height", scales[attr](d.attributes[attr]))
                .attr("fill", nodeColors(attr));
        }
    });

    node.select("text")
        .attr("x", -size * 0.5)
        .attr("y", - 1/3 * size)
        .attr("dx", 0)
        .attr("text-anchor", "middle")
        .raise();
}

/**
 * This function encodes one given node attribute by mapping the value to the width of the line filled in corresponding hue.
 * Nodes that do not share this attribute remain plain.
 */
function coloredNodeLines(attr, nodes, attributes) {
    const scales = defineScales(attributes, nodes, 1, squareSize);
    d3.selectAll("#bf .nodes g").selectAll("line")
        .style("stroke", d => attr in d.attributes ? nodeColors(attr) : "gray")
        .style("stroke-width", d => attr in d.attributes ? scales[attr](d.attributes[attr]) : 1);
}

/**
 * This function encodes each node attribute by a separate line.
 * These lines map the value to the width of the line filled in corresponding hue and are aligned in parallel.
 */
function parallelNodeLines(nodes, attributes) {
    const maxWidth = Math.max(1, Math.min(10, 2/3 * nodeDistance / attributes.length));
    const scales = defineScales(attributes, nodes, 1, maxWidth);

    d3.selectAll("#bf .nodes g").each(function (n) {
        for (let [i, [attr, value]] of Object.entries(Object.entries(n.attributes))) {
            let max = Object.keys(n.attributes).length - 1;
            d3.select(this).append("line")
                .attr("x2", widthForEdges)
                // shift lines up or down from the middle line
                .attr("transform", "translate(0, " + -(Math.round(max / 2 - i) * maxWidth) + ")")
                .style("stroke-width", scales[attr](value))
                .style("stroke", nodeColors(attr));
        }

        // visualize nodes without attributes as plain lines
        if (Object.keys(n.attributes).length) {
            d3.select(this).select(".baseline").remove();
        }
    });
}

/**
 * This function encodes each node attribute by a separate line.
 * These lines map the value to the curve of the lines.
 * (small values are bend to the bottom, high values are bend to the top)
 */
function curvedNodeLines(nodes, attributes) {
    const curve = d3.line().curve(d3.curveNatural);
    const scales = defineScales(attributes, nodes, -nodeDistance / 3, nodeDistance / 3);

    d3.selectAll("#bf .nodes g").each(function (n) {
        let x1 = 0;
        let x2 = widthForEdges;
        let y = 0;
        for (let [attr, value] of Object.entries(n.attributes)) {
            let points = [[x1, y], [(x2 + x1) / 2, y - scales[attr](value)], [x2, y]];
            d3.select(this).append("path")
                .attr("d", curve(points))
                .attr("fill", "none")
                .style("stroke-width", "2px")
                .style("stroke", nodeColors(attr));
        }

        // visualize nodes without attributes as plain lines
        if (Object.keys(n.attributes).length) {
            d3.select(this).select(".baseline").remove();
        }
    });
}

function dashedNodeLines(nodes, attributes) {
    const maxWidth = Math.max(1, Math.min(10, 2/3 * nodeDistance / attributes.length));
    const nodeDashScales = defineScales(attributes, nodes, 10, 0);

    d3.selectAll("#bf .nodes g").each(function (n) {
        for (let [i, [attr, value]] of Object.entries(Object.entries(n.attributes))) {
            let max = Object.keys(n.attributes).length - 1;
            d3.select(this).append("line")
                .attr("x2", widthForEdges)
                // shift lines up or down from the middle line
                .attr("transform", "translate(0, " + -(Math.round(max / 2 - i) * maxWidth) + ")")
                .style("stroke-width", maxWidth / 2)
                .style("stroke", nodeColors(attr))
                .style("stroke-dasharray", "10 " + nodeDashScales[attr](value));
        }

        // visualize edges without attributes as plain edges
        if (Object.keys(n.attributes).length) {
            d3.select(this).select(".baseline").remove();
        }
    });
}

/**
 * This function encodes each node attribute by a bar on the node's line.
 */
function barsOnNodeLines(nodes, attributes) {
    const barHeight = Math.max(1, Math.min(30, nodeDistance * 0.8));
    const barWidth = Math.max(1, Math.min(10, widthForNodeBars / attributes.length));
    const distanceInBetween = 0;
    const scales = defineScales(attributes, nodes, 1, barHeight);

    let max = attributes.length - 1;
    d3.selectAll("#bf .nodes g").each(function (n) {
        for (let [i, attr] of Object.entries(attributes)) {
            if (attr in n.attributes) {
                let mid_x = widthForNodeBars / 2;
                let shift_x = -Math.round(max / 2 - i) * (barWidth + distanceInBetween);
                d3.select(this).append("line")
                    .attr("transform", "translate(" + (mid_x + shift_x) + ", 0)")
                    .attr("y2", - scales[attr](n.attributes[attr]))
                    .style("stroke-width", barWidth)
                    .style("stroke", nodeColors(attr));
            }
        }
    });
}

/**
 * This function encodes the node attributes in a juxtaposed table aligned to the nodes.
 */
function bfJuxtaposedNodeAttributes(view, nodes, positions, attributes) {
    const distanceToMatrix = 50;
    const distanceInBetween = 10;
    const barWidth = (view.width - margins.left - widthForEdges - distanceToMatrix - attributes.length * distanceInBetween) / attributes.length;
    const barHeight = Math.min(10, nodeDistance / 4);
    const scales = defineScales(attributes, nodes, 0, barWidth);

    const juxtatable = d3.select("#bf")
        .append("g")
        .attr("class", "juxtatableNodes")
        .attr("transform", "translate(" + (widthForEdges + margins.left) + ", 0)");

    const header = juxtatable.append("g")
        .attr("class", "header")
        .attr("transform", "translate(" + (distanceToMatrix + 0.5 * distanceInBetween) + ", 0)")
        .selectAll("g")
        .data(attributes)
        .enter()
        .append("g")
        .attr("transform", function (d, i) {
            return "translate(" + ((barWidth + distanceInBetween) * i) + ", 0)";
        });
    header.append("rect")
        .attr("width", barWidth)
        .attr("height", fontSize * 1.5)
        .attr("fill", "white")
        .attr("stroke", "gray")
        .attr("stroke-width", "1px");
    header.append("text")
        .text(x => x)
        .attr("x", barWidth * 0.5)
        .attr("dy", "1em")
        .attr("text-anchor", "middle")
        .attr("font-size", fontSize);

    const range_offset = -10
    const range = header.append("g")
        .attr("class", "range")
        .attr("transform", "translate(0, " + (margins.top * 0.75) + ")");
    range.append("line")
        .attr("x1", barWidth)
        .attr("stroke", "black")
        .attr("stroke-width", "1px")
    range.append("line")
        .attr("y2", range_offset)
        .attr("stroke", "black")
        .attr("stroke-width", "1px")
    range.append("line")
        .attr("x1", barWidth)
        .attr("x2", barWidth)
        .attr("y2", range_offset)
        .attr("stroke", "black")
        .attr("stroke-width", "1px")
    range.append("text")
        .attr("y", range_offset - 5)
        .attr("dx", "0.1em")
        .text(x => shortenNumber(scales[x].domain()[0]))
        .attr("font-size", smallFontSize)
    range.append("text")
        .attr("x", barWidth - 5)
        .attr("y", range_offset - 5)
        .attr("dx", "-0.1em")
        .text(x => shortenNumber(scales[x].domain()[1]))
        .attr("font-size", smallFontSize)
        .attr("text-anchor", "end")

    let offset = widthForEdges + distanceToMatrix + 0.5 * distanceInBetween
    d3.selectAll("#bf .nodes g").each(function (d) {
        d3.select(this).append("line")
            .attr("class", "gridline")
            .attr("transform", "translate(" + (offset - distanceToMatrix - 0.5 * distanceInBetween) + ", 0)")
            .attr("x2", view.width - margins.left - widthForEdges)
            .attr("stroke", "gray")
            .attr("stroke-width", "1px")
            .style("opacity", 0.3);

        for (let attr in d.attributes) {
            let j = attributes.indexOf(attr);
            d3.select(this).append("rect")
                .attr("transform", "translate(" + (offset + (barWidth + distanceInBetween) * j) + ", " + (- barHeight * 0.5) + ")")
                .attr("width", scales[attr](d.attributes[attr]))
                .attr("height", barHeight)
                .attr("fill", nodeColors(attr));
        }
    });
}

function enlargeSquares(x, y, width, height) {
    d3.selectAll(".square")
        .attr("transform", "translate(" + x + ", " + y +")")
        .attr("width", width ? width : squareSize)
        .attr("height", height ? height : squareSize)
}