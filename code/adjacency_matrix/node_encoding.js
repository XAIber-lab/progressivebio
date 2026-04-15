/**
 * This function colors nodes based on the given attribute. Nodes that do not share this attribute remain plain.
 * The attribute value is encoded using opacity.
 */
function coloredNodes(attr, nodes, attributes) {
    const opacityScales = defineScales(attributes, nodes, 0.5, 1);
    d3.selectAll("#adm .nodes .left, #adm .nodes .top").selectAll("rect")
        .style("fill", function (d) {
            return attr in d.attributes ? nodeColors(attr) : "#e9ecef";
        })
        .style("fill-opacity", function (d) {
            return attr in d.attributes ? opacityScales[attr](d.attributes[attr]) : 1;
        });
}

/**
 * This function encodes the node attributes in a juxtaposed table aligned to the left nodes.
 */
function juxtaposedNodeAttributes(view, nodes, positions, attributes) {
    const distanceToMatrix = 50;
    const distanceInBetween = 10;
    const barWidth = (view.width - margins.left - nodes.length * cellSize - distanceToMatrix - attributes.length * distanceInBetween) / attributes.length;
    const barHeight = cellSize - 2;
    const scales = defineScales(attributes, nodes, 0, barWidth);

    const juxtatable = d3.select("#adm")
        .append("g")
        .attr("class", "juxtatable")
        .attr("transform", "translate(" + (nodes.length * cellSize + margins.left) + ", 0)");

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
        .text(function (d) {
            return d;
        })
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


    const values = juxtatable.append("g")
        .attr("class", "values")
        .attr("transform", "translate(" + (distanceToMatrix + 0.5 * distanceInBetween) + ", " + margins.top + ")")
        .selectAll("g")
        .data(nodes)
        .enter()
        .append("g");

    values.each(function (d) {
        for (let attr in d.attributes) {
            let j = attributes.indexOf(attr);
            d3.select(this).append("rect")
                .attr("transform", "translate(" + ((barWidth + distanceInBetween) * j) + ", " + (positions[d.id][0] + 1) + ")")
                .attr("width", scales[attr](d.attributes[attr]))
                .attr("height", barHeight)
                .attr("fill", nodeColors(attr));
        }
    });

    juxtatable.append("g")
        .attr("class", "grid")
        .attr("transform", "translate(0, " + margins.top + ")")
        .selectAll("g")
        .data(nodes)
        .enter()
        .append("g")
        .append("rect")
        .attr("y", function (d) {
            return positions[d.id][0];
        })
        .attr("width", view.width - margins.left - nodes.length * cellSize)
        .attr("height", cellSize)
        .attr("fill", "none")
        .attr("stroke", "gray")
        .attr("stroke-width", "1px");
}