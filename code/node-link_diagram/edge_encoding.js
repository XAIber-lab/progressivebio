function nldColoredEdges(attr, edges, attributes) {
    const max_width = Math.max(1, Math.min(10, min_radius / attributes.length))
    const scales = defineScales(attributes, edges, 1, max_width);
    d3.selectAll("#nld .edges .baseline")
        .style("stroke", function (d) {
            return attr in d.attributes ? edgeColors(attr) : "black";
        })
        .style("stroke-width", function (d) {
            return attr in d.attributes ? scales[attr](d.attributes[attr]) : 1;
        });
}

function nldParallelEdges(edges, attributes) {
    const max_width = Math.max(1, Math.min(10, min_radius / attributes.length));
    const scales = defineScales(attributes, edges, 1, max_width);

    d3.selectAll("#nld .edges g").each(function (e) {
        for (let [i, [attr, value]] of Object.entries(Object.entries(e.attributes))) {
            let max = Object.keys(e.attributes).length - 1;
            d3.select(this).append("line")
                .attr("x1", e.source.x)
                .attr("y1", e.source.y)
                .attr("x2", e.target.x)
                .attr("y2", e.target.y)
                // shift edges right or left from the middle edge
                .attr("transform", function () {
                    let translation = shift(Math.round(max / 2 - i) * (max_width + 2), e.source, e.target);
                    return "translate(" + translation.x + "," + translation.y + ")";
                })
                .style("stroke-width", scales[attr](value))
                .style("stroke", edgeColors(attr));
        }

        // visualize edges without attributes as plain edges
        if (Object.keys(e.attributes).length) {
            d3.select(this).select(".baseline").remove();
        }
    });
}

function nldBarsOnEdges(edges, attributes) {
    const scales = defineScales(attributes, edges, 1, 30);

    let max = attributes.length - 1;
    d3.selectAll("#nld .edges g").each(function (e) {
        for (let [i, attr] of Object.entries(attributes)) {
            if (attr in e.attributes) {
                let mid_x = (e.source.x + e.target.x) / 2;
                let mid_y = (e.source.y + e.target.y) / 2;
                let normalized = norm(e.source, e.target);
                let shift_x = Math.round(max / 2 - i) * (barWidth + distanceInBetween) * normalized.x;
                let shift_y = Math.round(max / 2 - i) * (barWidth + distanceInBetween) * normalized.y;

                d3.select(this).append("line")
                    .attr("x1", mid_x + shift_x)
                    .attr("y1", mid_y + shift_y)
                    .attr("x2", mid_x + shift_x + scales[attr](e.attributes[attr]) * normalized.y)
                    .attr("y2", mid_y + shift_y - scales[attr](e.attributes[attr]) * normalized.x)
                    .style("stroke-width", barWidth)
                    .style("stroke", edgeColors(attr));
            }
        }
    });
}