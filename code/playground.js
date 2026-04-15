// Control of the visualization playground

// define the visualization space
/*
const width = 1600;
const height = 800;
const margin = 20;

const svg = d3.select("body").append("svg")
    .attr("width", width + 2 * margin)
    .attr("height", height + 2 * margin);

const g = svg.append("g")
    .attr("transform", "translate(" + margin + ", " + margin + ")");
const g1 = svg.append("g")
    .attr("transform", "translate(" + margin + ", " + margin + ")");
const g2 = svg.append("g")
    .attr("transform", "translate(" + ((width / 2) + 2 * margin) + ", " + margin + ")");
const g3 = svg.append("g")
    .attr("transform", "translate(" + margin + ", " + (height / 2 + 2 * margin) + ")");
const g4 = svg.append("g")
    .attr("transform", "translate(" + ((width / 2) + 2 * margin) + ", " + (height / 2 + 2 * margin) + ")"); */

const svg = d3.select("body").append("svg").attr("id", "vis").attr("class", "vis");
const margin = 25;
const width = parseInt(d3.select("#vis").style("width"), 10) - 2 * margin;
const height = parseInt(d3.select("#vis").style("height"), 10) - 2 * margin;
const g = svg.append("g").attr("transform", "translate(" + margin + ", " + margin + ")");

// define default settings
let number = "1";
let currentFile = d3.json("data/example_thesis.json");
let currentFilename = "data/example_thesis.json";
let loadedFile;
let currentTechnique = "";
let study = true;

let NLDNodeEncoding = "plainNodes";
let NLDEdgeEncoding = "plainEdges";
let NLDNodeAttribute = "";
let NLDEdgeAttribute = "";

let ADMNodeEncoding = "plainNodes";
let ADMEdgeEncoding = "plainEdges";
let ADMNodeAttribute = "";
let ADMEdgeAttribute = "";
let ADMNodeOrdering = "Alphabetical";
let ADMNodeShading = false;

let QLTNodeEncoding = "plainNodes";
let QLTEdgeEncoding = "plainEdges";
let QLTNodeAttribute = "";
let QLTEdgeAttribute = "";
let QLTNodeOrdering = "Alphabetical";

let BFNodeEncoding = "plainNodes";
let BFEdgeEncoding = "plainEdges";
let BFNodeAttribute = "";
let BFEdgeAttribute = "";
let BFNodeOrdering = "Alphabetical";
let BFEdgeOrdering = "Nodes";
let BFNodeShading = false;
let BFEdgeShading = false;
let BFDoubleEdges = false;
let BFNodeHighlighting = "line";

let selectedNode = null;
let selectedEdge = null;
let selectedNodeSide = "top";

/**
 * This function redraws the visualization based on the defined settings and the selected network data.
 */
function redrawVisualization() {
    svg.selectAll("g").selectAll("*").remove();
    removeCreatedDivs();

    currentFile.then(function (data) {
        // create nodes and edges
        const networkData = createNetworkData(data);
        updateOptions(networkData);

        // visualize the network
        switch (number) {
            // by one visualization technique
            case "1" :
                switch (currentTechnique) {
                    case "NLD":
                        nodelink_diagram({'g': g, 'width':width, 'height': height}, networkData)
                        //nodeLinkDiagram(g, width, height, networkData, NLDNodeEncoding, NLDEdgeEncoding, NLDNodeAttribute, NLDEdgeAttribute);
                        break;
                    case "ADM":
                        adjacency_matrix({'g': g, 'width':width, 'height': height}, networkData)
                        break;
                    case "QLT":
                        quilt(g, width, height, networkData, QLTNodeEncoding, QLTEdgeEncoding, QLTNodeOrdering, QLTNodeAttribute, QLTEdgeAttribute);
                        break;
                    case "BF":
                        biofabric({'g': g, 'width':width, 'height': height}, networkData)
                        //bioFabric(g, width, height, networkData, BFNodeEncoding, BFEdgeEncoding, BFNodeOrdering, BFEdgeOrdering, BFNodeAttribute, BFEdgeAttribute, study, BFNodeShading, BFEdgeShading, BFDoubleEdges);
                        break;
                }
                break;
            // by all visualization techniques simultaneously
            case "4" :
                nodeLinkDiagram(g1, width / 2, height / 2, networkData, NLDNodeEncoding, NLDEdgeEncoding, NLDNodeAttribute, NLDEdgeAttribute);
                adjacencyMatrix(g2, width / 2, height / 2, networkData, ADMNodeEncoding, ADMEdgeEncoding, ADMNodeOrdering, ADMNodeAttribute, ADMEdgeAttribute);
                bioFabric(g3, width / 2, height / 2, networkData, BFNodeEncoding, BFEdgeEncoding, BFNodeOrdering, BFEdgeOrdering, BFNodeAttribute, BFEdgeAttribute);
                quilt(g4, width / 2, height / 2, networkData, QLTNodeEncoding, QLTEdgeEncoding, QLTNodeOrdering, QLTNodeAttribute, QLTEdgeAttribute);
                break;
        }
    });
}

/**
 * This functions updates the ordering possibilities and selections on attributes based on the loaded network data.
 * @param network
 */
function updateOptions(network) {
    let nodeAttributes = getAttributeLabels(network.nodes);
    let edgeAttributes = getAttributeLabels(network.edges);

    // selection of a node attribute
    let techniques = ["NLD", "ADM", "QLT", "BF"];
    techniques.forEach(function (t) {
        d3.select("#attribute" + t).selectAll("a").remove();
        d3.select("#attribute" + t)
            .selectAll("a")
            .data(nodeAttributes)
            .enter()
            .append("a")
            .attr("id", function (d) {
                return d + t;
            })
            .attr("class", "dropdown-item")
            .attr("href", "#")
            .text(function (d) {
                return d;
            })
            .on("click", function () {
                switch (t) {
                    case "NLD":
                        changeSelectedNodeAttributeNLD(d3.select(this).attr("id").slice(0, -3));
                        break;
                    case "ADM":
                        changeSelectedNodeAttribute(d3.select(this).attr("id").slice(0, -3));
                        break;
                    case "QLT":
                        QLTNodeAttribute = d3.select(this).attr("id").slice(0, -3);
                        break;
                    case "BF":
                        changeSelectedNodeAttributeBF(d3.select(this).attr("id").slice(0, -2));
                        break;
                }
                redrawVisualization();
            });
    });
    d3.select("#attributeQLT")
        .append("a")
        .attr("id", "layerQLT")
        .attr("class", "dropdown-item")
        .attr("href", "#")
        .text("Layer")
        .on("click", function () {
            QLTNodeAttribute = d3.select(this).attr("id").slice(0, -3);
            redrawVisualization();
        });

    // selection of an edge attribute
    techniques = ["NLD", "ADM", "QLT", "BF"];
    techniques.forEach(function (t) {
        d3.select("#edgeAttribute" + t).selectAll("a").remove();
        d3.select("#edgeAttribute" + t)
            .selectAll("a")
            .data(edgeAttributes)
            .enter()
            .append("a")
            .attr("id", function (d) {
                return d + t;
            })
            .attr("class", "dropdown-item")
            .attr("href", "#")
            .text(function (d) {
                return d;
            })
            .on("click", function () {
                switch (t) {
                    case "NLD":
                        changeSelectedEdgeAttributeNLD(d3.select(this).attr("id").slice(0, -3));
                        break;
                    case "ADM":
                        changeSelectedEdgeAttribute(d3.select(this).attr("id").slice(0, -3));
                        break;
                    case "QLT":
                        QLTEdgeAttribute = d3.select(this).attr("id").slice(0, -3);
                        break;
                    case "BF":
                        changeSelectedEdgeAttributeBF(d3.select(this).attr("id").slice(0, -2));
                        break;
                }
                redrawVisualization();
            });
    });

    // node ordering possibilities
    if (nodeAttributes.length > 1) {
        nodeAttributes.unshift("Random", "Alphabetical", "Degree", "Gansner", "RCM", "Mean", );
    } else {
        nodeAttributes.unshift("Random", "Alphabetical", "Degree", "Gansner", "RCM");
    }

    techniques = ["ADM", "QLT", "BF"];
    techniques.forEach(function (t) {
        d3.select("#ordering" + t).selectAll("a").remove();
        d3.select("#ordering" + t)
            .selectAll("a")
            .data(nodeAttributes)
            .enter()
            .append("a")
            .attr("id", function (d) {
                return d + t;
            })
            .attr("class", "dropdown-item")
            .attr("href", "#")
            .text(function (d) {
                return d;
            })
            .on("click", function () {
                switch (t) {
                    case "ADM":
                        changeSelectedNodeOrdering(d3.select(this).attr("id").slice(0, -3));
                        break;
                    case "QLT":
                        QLTNodeOrdering = d3.select(this).attr("id").slice(0, -3);
                        break;
                    case "BF":
                        changeSelectedNodeOrderingBF(d3.select(this).attr("id").slice(0, -2));
                        break;
                }
                redrawVisualization();
            });
    });

    // edge ordering possibilities
    if (edgeAttributes.length > 1) {
        edgeAttributes.unshift("Index of Nodes", "Random", "Degree", "Mean", "Staircases");
    } else {
        edgeAttributes.unshift("Index of Nodes", "Random", "Degree", "Staircases");
    }

    d3.select("#edgeOrderingBF").selectAll("a").remove();
    d3.select("#edgeOrderingBF")
        .selectAll("a")
        .data(edgeAttributes)
        .enter()
        .append("a")
        .attr("id", function (d) {
            return d + "BF";
        })
        .attr("class", "dropdown-item")
        .attr("href", "#")
        .text(function (d) {
            return d;
        })
        .on("click", function () {
            changeSelectedEdgeOrderingBF(d3.select(this).attr("id").slice(0, -2));
            redrawVisualization();
        });
}

/* The following code allows for interaction on the navigation bar and the selection of visualization settings */
// change number of visualizations
d3.selectAll("#numberDropDown").selectAll(".dropdown-item").on("click", function () {
    number = d3.select(this).attr("id");
    redrawVisualization();
});

// change visualized network
d3.selectAll("#dataDropDown").selectAll(".dropdown-item").on("click", function () {
    if (d3.select(this).attr("id") !== "loadData") {
        currentFile = d3.json("data/" + d3.select(this).attr("id"));
        currentFilename = "data/" + d3.select(this).attr("id");
        selectedNode = null;
        selectedEdge = null;
        redrawVisualization();
    }
});

// change visualization design
d3.selectAll("#studyDesign").on("change", function () {
    study = d3.select(this).property("checked");
    redrawVisualization();
});

// control the loading of custom data files
d3.select("#fileInput").on("change", function (e) {
    d3.selectAll("#errorMessage,#successMessage").style("display", "none");
    fileToJSON(e.target.files[0]).then(function (input) {
        let nodes = input["nodes"];
        let edges = input["links"];

        // data must match the required format
        if (nodes === undefined || nodes.map(n => n.id).includes(undefined) // || nodes.map(n => n.name).includes(undefined)
            || new Set(nodes.map(n => n.id)).size !== nodes.map(n => n.id).length // includes duplicates
            || edges === undefined || edges.map(e => e.source).includes(undefined) || edges.map(e => e.target).includes(undefined)
            || edges.map(e => !nodes.map(n => n.id).includes(e.source) || !nodes.map(n => n.id).includes(e.target)).some(Boolean)
            || edges.map(e => e.target === e.source).some(Boolean)) {
            d3.select("#errorMessage").style("display", "block");
            d3.select("#loadButton").attr("disabled", "disabled");
        } else {
            loadedFile = e.target.files[0];
            d3.select("#successMessage").style("display", "block");
            d3.select("#loadButton").attr("disabled", null);
            selectedNode = null;
            selectedEdge = null;
        }
    });
});

d3.select("#loadButton").on("click", function () {
    currentFile = fileToJSON(loadedFile);
    redrawVisualization();
});

// change visualization technique
d3.selectAll("#techniques").selectAll(".nav-item").on("click", function () {
    d3.selectAll("#techniques").selectAll(".nav-item").classed("active", false);
    d3.select(this).classed("active", true);
    d3.selectAll(".encoding").style("display", "none");

    currentTechnique = d3.select(this).select(".nav-link").attr("id");
    switch (currentTechnique) {
        case "NLD":
            d3.selectAll("#node-link-diagram").style("display", "block");
            break;
        case "ADM":
            d3.selectAll("#adjacency-matrix").style("display", "block");
            break;
        case "QLT":
            d3.selectAll("#quilt").style("display", "block");
            break;
        case "BF":
            d3.selectAll("#biofabric1").style("display", "block");
            d3.selectAll("#biofabric2").style("display", "block");
            d3.selectAll("#biofabric3").style("display", "block");
            break;
    }
    selectedNode = null;
    selectedEdge = null;
    redrawVisualization();
});

// change encodings of the node-link diagram
d3.selectAll("#nodeNLD").selectAll(".nav-item").on("click", function () {
    d3.selectAll("#nodeNLD").selectAll(".nav-item").classed("active", false);
    d3.select(this).classed("active", true);
    changeNodeEncodingNLD(d3.select(this).select(".nav-link").attr("id").slice(0, -3));
    redrawVisualization();
});

d3.selectAll("#edgeNLD").selectAll(".nav-item").on("click", function () {
    d3.selectAll("#edgeNLD").selectAll(".nav-item").classed("active", false);
    d3.select(this).classed("active", true);
    changeEdgeEncodingNLD(d3.select(this).select(".nav-link").attr("id").slice(0, -3));
    redrawVisualization();
});

d3.selectAll("#layoutNLD").selectAll(".dropdown-item").on("click", function () {
    changeLayoutNLD(d3.select(this).attr("id").slice(0, -3));
    redrawVisualization();
});

// change encodings of the adjacency matrix
d3.selectAll("#colorpicker").on("change", function () {
    d3.selectAll("#adm .grid rect").attr("stroke", d3.select("#colorpicker").property("value"));
});

d3.selectAll("#nodeADM").selectAll(".nav-item").on("click", function () {
    d3.selectAll("#nodeADM").selectAll(".nav-item").classed("active", false);
    d3.select(this).classed("active", true);
    changeNodeEncoding(d3.select(this).select(".nav-link").attr("id").slice(0, -3));
    redrawVisualization();
});

d3.selectAll("#edgeADM").selectAll(".nav-item").on("click", function () {
    d3.selectAll("#edgeADM").selectAll(".nav-item").classed("active", false);
    d3.select(this).classed("active", true);
    changeEdgeEncoding(d3.select(this).select(".nav-link").attr("id").slice(0, -3));
    redrawVisualization();
});

d3.selectAll("#nodeShadingADM").on("change", function () {
    ADMNodeShading = d3.select(this).property("checked");
    redrawVisualization();
});

// change encodings of the quilt
d3.selectAll("#nodeQLT").selectAll(".nav-item").on("click", function () {
    d3.selectAll("#nodeQLT").selectAll(".nav-item").classed("active", false);
    d3.select(this).classed("active", true);
    QLTNodeEncoding = d3.select(this).select(".nav-link").attr("id").slice(0, -3);
    redrawVisualization();
});

d3.selectAll("#edgeQLT").selectAll(".nav-item").on("click", function () {
    d3.selectAll("#edgeQLT").selectAll(".nav-item").classed("active", false);
    d3.select(this).classed("active", true);
    QLTEdgeEncoding = d3.select(this).select(".nav-link").attr("id").slice(0, -3);
    redrawVisualization();
});

// change encodings of the BioFabric
d3.selectAll("#nodeBF").selectAll(".nav-item").on("click", function () {
    d3.selectAll("#nodeBF").selectAll(".nav-item").classed("active", false);
    d3.select(this).classed("active", true);
    changeNodeEncodingBF(d3.select(this).select(".nav-link").attr("id").slice(0, -2));
    redrawVisualization();
});

d3.selectAll("#edgeBF").selectAll(".nav-item").on("click", function () {
    d3.selectAll("#edgeBF").selectAll(".nav-item").classed("active", false);
    d3.select(this).classed("active", true);
    changeEdgeEncodingBF(d3.select(this).select(".nav-link").attr("id").slice(0, -2));
    redrawVisualization();
});

d3.selectAll("#nodeShadingBF").selectAll(".dropdown-item").on("click", function () {
    BFNodeShading = d3.select(this).attr("id").slice(0, -6);
    redrawVisualization();
});

d3.selectAll("#edgeShadingBF").selectAll(".dropdown-item").on("click", function () {
    BFEdgeShading = d3.select(this).attr("id").slice(0, -6);
    redrawVisualization();
});

d3.selectAll("#doubleEdgesBF").on("change", function () {
    BFDoubleEdges = d3.select(this).property("checked");
    switchDoubleEdgesBF(d3.select(this).property("checked"));
    redrawVisualization();
});

d3.selectAll("#nodeHighlightingBF").selectAll(".dropdown-item").on("click", function () {
    BFNodeHighlighting = d3.select(this).attr("id").slice(0, -10);
    redrawVisualization();
});
