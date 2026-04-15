function showIntroduction(condition) {
    const data = d3.json("data/example.json");
    d3.select("#condition").text(condition === "adjacency_matrix" ? "Adjacency Matrix" : "BioFabric");
    const margin = 25;
    const width = parseInt(d3.select("#intro").select("svg").style("width"), 10) - 2 * margin;
    const height = parseInt(d3.select("#intro").select("svg").style("height"), 10) - 2 * margin;
    d3.select("#intro").selectAll("g").attr("transform", "translate(" + margin + ", " + margin + ")");

    if (condition === "biofabric") {
        d3.select("#nodeDescription").text("The visualization technique BioFabric represents nodes as horizontal lines.");
        d3.select("#edgeDescription").text("An edge is visualized as a vertical line that connects the corresponding nodes. " +
            "The ends of an edge are emphasized with little squares.");
        d3.select("#attributeDescription").text("Each attribute is visualized in a separate row below the edges. " +

            "The numerical values are encoded using vertical bars that are filled relatively to the overall range of the corresponding attribute.");
        d3.select("#orderingDescription").text("BioFabric allows ordering the edges based on attributes. We take advantage of this in attribute-based tasks.");
    } else if (condition === "biofabric2") {
        d3.select("#nodeDescription").text("The visualization technique BioFabric represents nodes as horizontal lines.");
        d3.select("#edgeDescription").text("An edge is visualized as a vertical line that connects the corresponding nodes. " +
            "The ends of an edge are emphasized with little squares.");
        d3.select("#attributeDescription").text("Each attribute is visualized in a separate bar adapted to the edges. " +
            "The numerical values are encoded using the bar's height.");
        d3.select("#orderingDescription").text("BioFabric allows ordering the edges based on attributes. We take advantage of this in attribute-based tasks.");
    } else {
        d3.select("#nodeDescription").text("The Adjacency Matrix is symmetric. The nodes are represented in the headers.");
        d3.select("#edgeDescription").text("An edge is visualized by filling the intersection cell of the corresponding nodes.");
        d3.select("#attributeDescription").text("To visualize the attributes a bar chart is embedded into the cell. Each attribute is represented separately. " +
            "The numerical values are encoded using vertical bars that are filled relatively to the overall range of the corresponding attribute.");
    }

    data.then(function (data) {
        const network = createNetworkData(data);
        if (condition === "biofabric") {
            bioFabric(d3.select("#nodesVis"), width, height, network, "plainNodes", "plainEdges", "RCM", "Nodes", "", "", true);
            d3.select("#nodesVis").select(".BFEdges").selectAll("g").style("display", "none");
            bioFabric(d3.select("#edgesVis"), width, height, network, "plainNodes", "plainEdges", "RCM", "Nodes", "", "", true);
            bioFabric(d3.select("#attributesVis"), width, height, network, "plainNodes", "juxtaposedEdges", "RCM", "Years of Friendship", "", "", true);
        } else if (condition === "biofabric2") {
            bioFabric(d3.select("#nodesVis"), width, height, network, "plainNodes", "plainEdges", "RCM", "Nodes", "", "", true);
            d3.select("#nodesVis").select(".BFEdges").selectAll("g").style("display", "none");
            bioFabric(d3.select("#edgesVis"), width, height, network, "plainNodes", "plainEdges", "RCM", "Nodes", "", "", true);
            bioFabric(d3.select("#attributesVis"), width, height, network, "plainNodes", "barsOnEdges", "RCM", "Years of Friendship", "", "", true);
        } else {
            adjacencyMatrix(d3.select("#nodesVis"), width, height, network, "plainNodes", "plainEdges", "RCM", "", "", true);
            d3.select("#nodesVis").select(".ADMEdges").selectAll("g").style("display", "none");
            adjacencyMatrix(d3.select("#edgesVis"), width, height, network, "plainNodes", "plainEdges", "RCM", "", "", true);
            adjacencyMatrix(d3.select("#attributesVis"), width, height, network, "plainNodes", "multipleEdges", "RCM", "", "", true);
        }

        const edgeAttributes = getAttributeLabels(network.edges);
        const edgeColors = d3.scaleOrdinal(d3.schemeSet1).domain(edgeAttributes);
        d3.selectAll(".attr").each(function () {
            d3.select(this).style("color", edgeColors(d3.select(this).text()));
        });
    });
}

function showTaskIntroduction(type) {
    if (type === "plain") {
        d3.select("#taskIntroduction").text("In this session, you are asked to find all friends of person X.")
    } else if (type === "one") {
        d3.select("#taskIntroduction").text("In this session, you are asked to find a friend of person X whose friendship has the second highest value in attribute Y.")
        d3.select("#caution").text("In some tasks multiple solutions are possible. Do not hesitate to choose the first solution you have found. " +
            "Also there may be multiple friendships with the highest value on the specified attribute.")
    } else {
        d3.select("#taskIntroduction").text("In this session, you are asked to find all friends of person X whose friendship has a higher value in attribute Y than in attribute Z.")
        d3.select("#caution").text("There may be friendships with equally high values on the specified attributes. These do not fulfill the requirement.")
    }
}