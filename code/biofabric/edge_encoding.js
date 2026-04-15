/**
 * This function encodes one given edge attribute by mapping the value to the width of the line filled in corresponding hue.
 * Edges that do not share this attribute remain plain.
 */
function coloredEdgeLines(attr, edges, attributes) {
    const scales = defineScales(attributes, edges, 1, squareSize);
    d3.selectAll("#bf .edges g").selectAll("line")
        .style("stroke", function (d) {
            return attr in d.attributes ? edgeColors(attr) : "gray";
        })
        .style("stroke-width", function (d) {
            return attr in d.attributes ? scales[attr](d.attributes[attr]) : 1;
        });
}

/**
 * This function encodes each edge attribute by a separate line.
 * These lines map the value to the width of the line filled in corresponding hue and are aligned in parallel.
 */
function parallelEdges(edges, positions, attributes) {
    const maxWidth = Math.max(1, Math.min(10, 2/3 * nodeDistance / attributes.length));
    const scales = defineScales(attributes, edges, 1, maxWidth);

    d3.selectAll("#bf .edges g").each(function (e) {
        for (let [i, [attr, value]] of Object.entries(Object.entries(e.attributes))) {
            let max = Object.keys(e.attributes).length - 1;
            d3.select(this).append("line")
                .attr("y1", positions[e.source])
                .attr("y2", positions[e.target])
                // shift edges right or left from the middle edge
                .attr("transform", "translate(" + -(Math.round(max / 2 - i) * maxWidth) + ", 0)")
                .style("stroke-width", scales[attr](value))
                .style("stroke", edgeColors(attr));
        }

        // visualize edges without attributes as plain edges
        if (Object.keys(e.attributes).length) {
            d3.select(this).select(".baseline").remove();
        }
    });
}

/**
 * This function encodes each edge attribute by a separate line.
 * These lines map the value to the curve of the line.
 * (small values are bend to the left, high values are bend to the right)
 */
function curvedEdges(edges, positions, attributes) {
    const curve = d3.line().curve(d3.curveNatural);
    const scales = defineScales(attributes, edges, -edgeDistance / 3, edgeDistance / 3);

    d3.selectAll("#bf .edges g").each(function (e) {
        let x = 0;
        let y1 = positions[e.source];
        let y2 = positions[e.target];
        for (let [attr, value] of Object.entries(e.attributes)) {
            let points = [[x, y1], [x + scales[attr](value), (y2 + y1) / 2], [x, y2]];
            d3.select(this).append("path")
                .attr("d", curve(points))
                .attr("fill", "none")
                .style("stroke-width", "2px")
                .style("stroke", edgeColors(attr));
        }

        // visualize edges without attributes as plain edges
        if (Object.keys(e.attributes).length) {
            d3.select(this).select(".baseline").remove();
        }
    });
}

/**
 * This function encodes each edge attribute by a separate line.
 * These lines map the value to the width of the line filled in corresponding hue and are aligned in parallel.
 */
function dashedEdges(edges, positions, attributes) {
    const maxWidth = Math.max(1, Math.min(10, 2/3 * edgeDistance / attributes.length));
    const scales = defineScales(attributes, edges, 10, 0);

    d3.selectAll("#bf .edges g").each(function (e) {
        for (let [i, [attr, value]] of Object.entries(Object.entries(e.attributes))) {
            let max = Object.keys(e.attributes).length - 1;
            d3.select(this).append("line")
                .attr("y1", positions[e.source])
                .attr("y2", positions[e.target])
                // shift edges right or left from the middle edge
                .attr("transform", "translate(" + -(Math.round(max / 2 - i) * maxWidth) + ", 0)")
                .style("stroke-width", maxWidth / 2)
                .style("stroke", edgeColors(attr))
                .style("stroke-dasharray", "10 " + scales[attr](value));
        }

        // visualize edges without attributes as plain edges
        if (Object.keys(e.attributes).length) {
            d3.select(this).select(".baseline").remove();
        }
    });
}

/**
 * This function encodes the edge attributes using bars. These are represented beside each other on a common baseline.
 * The numerical values are mapped to the height of the bars which are filled in the corresponding hue.
 */
function barsOnEdges(edges, positions, attributes) {
    const barHeight = Math.max(1, Math.min(30, edgeDistance * 0.8));
    const barWidth = Math.max(1, Math.min(10, (nodeDistance - squareSize - 2) / attributes.length));
    const distanceInBetween = 0;
    const scales = defineScales(attributes, edges, 1, barHeight);

    let max = attributes.length - 1;
    d3.selectAll("#bf .edges g").each(function (e) {
        for (let [i, attr] of Object.entries(attributes)) {
            if (attr in e.attributes) {
                // centered: let mid_y = (positions[e.source] + positions[e.target]) / 2;
                let mid_y = Math.min(positions[e.source], positions[e.target]) + nodeDistance / 2;
                let shift_y = -Math.round(max / 2 - i) * (barWidth + distanceInBetween);
                if (attributes.length % 2 === 0) {
                    mid_y += (barWidth + distanceInBetween) / 2;
                }

                d3.select(this).append("line")
                    .attr("transform", "translate(0, " + (mid_y + shift_y) + ")")
                    .attr("x2", scales[attr](e.attributes[attr]))
                    .style("stroke-width", barWidth)
                    .style("stroke", edgeColors(attr));
            }
        }
    });
}

/**
 * This function encodes the edge attributes in a juxtaposed table aligned to the edge lines.
 */
function juxtaposedEdgeAttributes(view, edges, nodes, positions, attributes) {
    const distanceToMatrix = 50;
    const distanceInBetween = 10;
    const barWidth = (view.height - margins.top - margins.bottom - (nodes.length - 1) * nodeDistance - distanceToMatrix - attributes.length * distanceInBetween) / attributes.length;
    const barHeight = Math.min(10, edgeDistance / 4);
    const scales = defineScales(attributes, edges, 0, barWidth);

    const juxtatable = d3.select("#bf")
        .append("g")
        .attr("class", "juxtatableEdges")
        .attr("transform", "translate(0, " + (nodes.length * nodeDistance + margins.top) + ")");

    const header = juxtatable.append("g")
        .attr("class", "header")
        .attr("transform", "translate(0, " + (distanceToMatrix + 0.5 * distanceInBetween) + ")")
        .selectAll("g")
        .data(attributes)
        .enter()
        .append("g")
        .attr("transform", (x, i) => "translate(0, " + ((barWidth + distanceInBetween) * i) + ")");
    header.append("rect")
        .attr("y", -fontSize * 0.75)
        .attr("width", margins.left)
        .attr("height", fontSize * 1.5)
        .attr("fill", "white")
        .attr("stroke", "gray")
        .attr("stroke-width", "1px");
    header.append("text")
        .text(x => x)
        .attr("x", margins.left * 0.5)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .attr("font-size", fontSize);

    const range_offset = 10
    const range = header.append("g")
        .attr("class", "range")
        .attr("transform", "translate(" + (widthForEdges + margins.left) + ", " + (- barWidth * 0.5) + ")")
    range.append("line")
        .attr("y2", barWidth)
        .attr("stroke", "black")
        .attr("stroke-width", "1px")
    range.append("line")
        .attr("x2", range_offset)
        .attr("stroke", "black")
        .attr("stroke-width", "1px")
    range.append("line")
        .attr("y1", barWidth)
        .attr("y2", barWidth)
        .attr("x2", range_offset)
        .attr("stroke", "black")
        .attr("stroke-width", "1px")
    range.append("text")
        .attr("x", range_offset + 5)
        .attr("dy", "1em")
        .text(x => shortenNumber(scales[x].domain()[0]))
        .attr("font-size", smallFontSize)
    range.append("text")
        .attr("y", barWidth - 5)
        .attr("x", range_offset + 5)
        .attr("dy", "0.1em")
        .text(x => shortenNumber(scales[x].domain()[1]))
        .attr("font-size", smallFontSize)

    let offset = nodes.length * nodeDistance + distanceToMatrix + 0.5 * distanceInBetween
    d3.selectAll("#bf .edges g").each(function (d) {
            d3.select(this).append("line")
            .attr("class", "gridline")
            .attr("transform", "translate(0, " + (offset - distanceToMatrix - 0.5 * distanceInBetween) + ")")
            .attr("y2", view.height - margins.top - margins.bottom - nodes.length * nodeDistance)
            .attr("stroke", "gray")
            .attr("stroke-width", "1px")
            .attr("stroke-opacity", 0.3);

        for (let attr in d.attributes) {
            let j = attributes.indexOf(attr);
            d3.select(this).append("rect")
                .attr("transform", "translate(" + (- barHeight * 0.5) + ", " + (offset + (barWidth + distanceInBetween) * j - barWidth * 0.5) + ")")
                .attr("height", scales[attr](d.attributes[attr]))
                .attr("width", barHeight)
                .attr("fill", edgeColors(attr));
        }
    });
}