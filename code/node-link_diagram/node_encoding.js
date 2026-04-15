/**
 * This function encodes one given node attribute by mapping the value to the radius of a circle filled in corresponding hue.
 * Nodes that do not share this attribute remain plain.
 */
function nldColoredNodes(attr, nodes, attributes) {
    const scales = defineScales(attributes, nodes, min_radius, max_radius);
    d3.selectAll("#nld .nodes g circle")
        .attr("r", function (d) {
            return attr in d.attributes ? scales[attr](d.attributes[attr]) : min_radius;
        })
        .attr("fill", function (d) {
            return attr in d.attributes ? nodeColors(attr) : "#e9ecef";
        });
}

/**
 * This function encodes the node attributes in a bar chart.
 */
function nldBarsOnNodes(nodes, attributes) {
    const size = 50;
    const distanceInBetween = 0;
    const barHeight = 2/3 * size;
    const barWidth = size / attributes.length;
    const scales = defineScales(attributes, nodes, 1, barHeight);

    const node = d3.selectAll("#nld .nodes g")

    const barchart = node.append("g")
        .attr("transform", "translate(" + (-size * 0.5) + ", " + (-size * 0.5) + ")")
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
                .attr("fill", nodeColors(attr))
                .raise();
        }
    });

    node.select("text")
        .attr("y", - 1/3 * size)
        .raise();
}