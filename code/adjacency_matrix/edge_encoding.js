/**
 * This function encodes one given edge attribute by mapping the value to the size of the square filled in corresponding hue.
 * Nodes that do not share this attribute remain plain.
 */
function squaredEdges(attr, edges, attributes) {
    const scales = defineScales(attributes, edges, 1, cellSize);
    d3.selectAll("#adm .edges rect")
        .attr("width", function (d) {
            return attr in d.attributes ? scales[attr](d.attributes[attr]) : cellSize;
        })
        .attr("height", function (d) {
            return attr in d.attributes ? scales[attr](d.attributes[attr]) : cellSize;
        })
        .attr("fill", function (d) {
            return attr in d.attributes ? edgeColors(attr) : "gray";
        })
        .attr("transform", function (d) {
            return attr in d.attributes ? "translate(" + (cellSize / 2 - scales[attr](d.attributes[attr]) / 2) + ", "
                + (cellSize / 2 - scales[attr](d.attributes[attr]) / 2) + ")" : "translate(0, 0)";
        });

}

function opaqueEdges(attr, edges, attributes) {
    const opacityScales = defineScales(attributes, edges, 0.3, 1);
    d3.selectAll("#adm .edges rect")
        .style("fill-opacity", function (d) {
        return attr in d.attributes ? opacityScales[attr](d.attributes[attr]) : 0;
    });
}

/**
 * This function divides the cell into inner and outer square to encode two attributes.
 * The space is filled by differentiating hue and the attribute value is encoded by opacity.
 */
function dividedEdges(edges, attributes) {
    const opacityScales = defineScales(attributes, edges, 0.3, 1);

    // encode first attribute in outer space
    let first = attributes[0];
    d3.selectAll("#adm .edges rect")
        .attr("fill", edgeColors(first))
        .attr("fill-opacity", function (d) {
            return first in d.attributes ? opacityScales[first](d.attributes[first]) : 0;
        });

    d3.selectAll("#adm .edges g")
        .append("rect")
        .attr("transform", "translate(" + (cellSize * 0.25) + ", " + (cellSize * 0.25) + ")")
        .attr("width", cellSize / 2)
        .attr("height", cellSize / 2)
        .attr("fill", "white");

    let second = attributes[1];
    d3.selectAll("#adm .edges g")
        .append("rect")
        .attr("transform", "translate(" + (cellSize * 0.25) + ", " + (cellSize * 0.25) + ")")
        .attr("width", cellSize / 2)
        .attr("height", cellSize / 2)
        .attr("fill", edgeColors(second))
        .attr("fill-opacity", function (d) {
            return second in d.attributes ? opacityScales[second](d.attributes[second]) : 0;
        });
}

/**
 * This function encodes multiple edge attribute in a bar chart.
 */
function barsEdges(edges, attributes) {
    const distanceInBetween = 0;
    const barWidth = cellSize / attributes.length;
    const scales = defineScales(attributes, edges, 0, cellSize);

    d3.selectAll("#adm .edges g").each(function (d) {
        d3.select(this).select("rect")
            .attr("fill", d.attributes.length === 0 ? "gray" : "none")

        for (let attr in d.attributes) {
            let j = attributes.indexOf(attr);
            d3.select(this).append("rect")
                .attr("transform", "translate(" + ((barWidth + distanceInBetween) * j) + ", " + (cellSize - scales[attr](d.attributes[attr])) + ")")
                .attr("width", barWidth)
                .attr("height", scales[attr](d.attributes[attr]))
                .attr("fill", edgeColors(attr));
        }
    });
}