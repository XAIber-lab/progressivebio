const margin = 25;
const svg = d3.select("#vis");
const g = svg.append("g").attr("transform", "translate(" + margin + ", " + margin + ")");

const width = parseInt(d3.select("#vis").style("width"), 10) - 2 * margin;
const height = parseInt(d3.select("#vis").style("height"), 10) - 2 * margin;

let visualization = "biofabric";
let nodeOrdering = "alphabetical";
let edgeOrdering = "degreecending";

let data;
// let customData;

fetch("data/" + d3.select("#dataSelect").node().value + ".json")
    .then(response => response.json())
    .then(d => {
        data = d;
        redrawVisualization();
    })
    .catch(error => {
        console.error("Error loading JSON:", error);
    });

d3.select("#visualizationSelect").on("change", function () {
    visualization = this.value;
    switch (visualization) {
        case "biofabric":
            d3.selectAll("#nodeOrderingSelect, #edgeOrderingSelect, #patternSelect").style("visibility", "visible");
            d3.select(".summary").style("display", "block");
            break;
        case "adjacency":
            d3.selectAll("#edgeOrderingSelect, #patternSelect").style("visibility", "hidden");
            d3.selectAll("#nodeOrderingSelect").style("visibility", "visible");
            d3.select(".summary").style("display", "none");
            break;
        default:
            d3.selectAll("#nodeOrderingSelect, #edgeOrderingSelect, #patternSelect").style("visibility", "hidden");
            d3.select(".summary").style("display", "none");
    }
    if (isDataSelected()) {
        redrawVisualization();
    }
});

d3.select("#dataSelect").on("change", function () {
    /* if (this.value === "dataCustom") {
        $("#modal").show();
    } else {
        $("#modal").hide();
        $("#cuthill, #barycenter, #force").removeAttr('disabled');
    } */

    fetch("data/" + this.value + ".json")
        .then(response => response.json())
        .then(d => {
            data = d;
            redrawVisualization();
        })
        .catch(error => {
            console.error("Error loading JSON:", error);
        });
});

// load custom data
/* d3.select("#buttonClose").on("click", function () {
    $("#modal").hide();
    d3.select("#fileInput").node().value = "";
    d3.select(".feedback").style("visibility", "hidden");
});
d3.select("#fileInput").on("click", function () {
    d3.select("#fileInput").node().value = "";
    d3.select(".feedback").style("visibility", "hidden");
});
d3.select("#fileInput").on("change", async function (e) {
    await fileToJSON(e.target.files[0]).then(function (input) {
        // data must match the required format
        let nodes = input["nodes"];
        let edges = input["links"];

        if (nodes === undefined || nodes.map(n => n.id).includes(undefined)
            || new Set(nodes.map(n => n.id)).size !== nodes.map(n => n.id).length   // duplicate node ids
            || edges === undefined || edges.map(e => e.source).includes(undefined) || edges.map(e => e.target).includes(undefined)
            || edges.map(e => !nodes.map(n => n.id).includes(e.source) || !nodes.map(n => n.id).includes(e.target)).some(Boolean)
            || edges.map(e => e.target === e.source).some(Boolean)) {   // self loop
            d3.select(".feedback").text("This file does not match the expected format.")
                .style("visibility", "visible").style("color", "red");
            d3.select("#buttonLoad").attr("disabled", "disabled");
        } else {
            customData = input;
            d3.select(".feedback").text("This file is ready to load.")
                .style("visibility", "visible").style("color", "green");
            d3.select("#buttonLoad").attr("disabled", null);
        }
    });
});

d3.select("#buttonLoad").on("click", function () {
    $("#modal").hide();
    d3.select("#fileInput").node().value = "";
    d3.select(".feedback").style("visibility", "hidden");

    data = customData;
    // disable pre-calculated ordering
    if (data.nodes.map(n => n["cuthill_pos"]).includes(undefined)) {
        $("#cuthill").attr("disabled", "disabled");
        if (nodeOrdering === "cuthill") {
            nodeOrdering = "alphabetical";
            $("#alphabetical").attr("selected", "selected");
        }
    }
    if (data.nodes.map(n => n["barycenter_pos"]).includes(undefined)) {
        $("#barycenter").attr("disabled", "disabled");
        if (nodeOrdering === "barycenter") {
            nodeOrdering = "alphabetical";
            $("#alphabetical").attr("selected", "selected");
        }
    }
    if (data.nodes.map(n => n["force_direct_pos"]).includes(undefined)) {
        $("#force").attr("disabled", "disabled");
        if (nodeOrdering === "force") {
            nodeOrdering = "alphabetical";
            $("#alphabetical").attr("selected", "selected");
        }
    }

    redrawVisualization();
}); */

d3.select("#nodeOrderingSelect").on("change", function () {
    nodeOrdering = this.value;
    redrawVisualization();
});

d3.select("#edgeOrderingSelect").on("change", function () {
    edgeOrdering = this.value;
    redrawVisualization();
});

d3.select("#patternSelect").on("change", function () {
    highlightPattern();
});



function redrawVisualization() {
    if (!isDataSelected()) {
        return;
    }
    g.selectAll("*").remove();
    const edges = data.links;
    const nodes = data.nodes;
    nodes.forEach(function (n) {
        n.name = n.name !== undefined ? n.name : n.id;
    });

    switch (visualization) {
        case "biofabric":
            drawBioFabric(nodes, edges);
            getPatterns(nodes, edges);
            highlightPattern();
            break;
        case "adjacency":
            drawAdjacencyMatrix(nodes, edges);
            break;
        case "nodelink":
            drawNodeLinkDiagram(nodes, edges);
            break;
    }
}

function isDataSelected() {
    if (data !== undefined) {
        d3.select(".hint").style("visibility", "hidden");
        return true;
    } else {
        d3.select(".hint").style("visibility", "visible");
        return false;
    }
}

/* function fileToJSON(file) {
    return new Promise(function (resolve, reject) {
        const fileReader = new FileReader();
        fileReader.readAsText(file);
        fileReader.onload = event => resolve(JSON.parse(event.target.result));
        fileReader.onerror = error => reject(error);
    });
} */
