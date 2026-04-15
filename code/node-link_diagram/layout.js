function forcedirected(view, nodes, attributes, edges) {
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink().id(function (d) {
            return d.id;
        }))
        .force("charge", d3.forceManyBody().strength(-500)
            .distanceMin((barWidth + distanceInBetween) * attributes.length + 2 * max_radius)
            .distanceMax(Math.min(view.width, view.height) / 2))
        .force("center", d3.forceCenter(view.width / 2, view.height / 2))
        .force("collide", d3.forceCollide()
            .strength(1)
            .radius(max_radius))
        // additional boundaries to fit the visualization space
        .force("boundary", forceBoundary(max_radius, max_radius, view.width - max_radius, view.height - max_radius))
        .stop();

    simulation.force("link")
        .links(edges)
        .distance(Math.min(view.width, view.height) / Math.sqrt(nodes.length));

    simulation.tick(400);
}