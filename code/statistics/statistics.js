let files;

d3.select("#filesInput").on("change", function (e) {
    files = e.target.files;
    d3.select("#fileButton").attr("disabled", files.length !== 0 ? null : "disabled");
    d3.selectAll("#errorMessage,#successMessage").style("display", "none");
});

function getStatistics() {
    // set parameters
    shortestStair = d3.select("#shortestStairs").property("value");
    shortestEscalator = d3.select("#shortestEscalators").property("value");
    shortestPath = d3.select("#shortestPaths").property("value");
    shortestRunway = d3.select("#shortestRunways").property("value");
    distanceStairs = d3.select("#distanceStairs").property("value");
    distanceRunways = d3.select("#distanceRunways").property("value");
    distance1Escalators = d3.select("#distance1Escalators").property("value");
    distance2Escalators = d3.select("#distance1Escalators").property("value");
    distancePaths = d3.select("#distancePaths").property("value");


    // calculate statistics for each file
    async function processFiles(fileList) {
        let rows = [];
        let header = ["NameOfFile", "NameOfNodeOrder", "NameOfEdgeOrder", "NumberOfNodes", "DensityOfGraph", "QualityOfStairs", "QualityOfEachIndividualStair", "QualityOfRunway", "QualityOfEachIndividualRunway", "NumberOfEscalators", "LengthOfEachEscalator", "QualityOfPath"];
        rows.push(header.join(","));

        for (const file of fileList) {
            try {
                let input = await fileToJSON(file);
                let results = calculateStatistics(file.name, input)
                if (results === undefined) {return;}
                rows.push(results);
            } catch (error) {
                console.error(`Error processing file ${file}:`, error);
            }
        }

        return rows;
    }

    processFiles(files)
        .then(rows => {
            if (rows === undefined) {return;}
            let data = rows.join("\n");

            // create csv file
            const blob = new Blob([data], {type: "text/csv"});
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.setAttribute("href", url);
            a.setAttribute("download", "patterns.csv");
            a.click();
        })
        .catch(error => {
            console.error("Error processing files:", error);
        });


    // parallelize calculation
    /*Promise.all(Array.from(files).map(file => calculateStatistics(file.name, fileToJSON(file))))
        .then(dataArray => {
            console.log(dataArray)

            let data = dataArray.join("\n");
            console.log("data", data)

            // create csv file
            const blob = new Blob([data], {type: "text/csv"});
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.setAttribute("href", url);
            a.setAttribute("download", "patterns.csv");
            a.click();
        })
        .catch(error => {
            console.error("Error reading JSON files:", error);
        });*/
}

function calculateStatistics(name, input) {
    // data must match the required format
    if (!checkFile(name, input)) {
        return;
    }

    let stats = [];
    stats.push(name); // NameOfFile

    const network = createNetworkData(input);
    let nodes = network.nodes;
    let edges = network.edges;

    let nodeOrder = d3.select("#nodeOrder").property("value");
    let edgeOrder = d3.select("#edgeOrder").property("value");

    switch (nodeOrder.toLowerCase()) {
        case "random":
            sortRandomly(nodes);
            break;
        case "alphabetical" :
            sortAlphabetically(nodes);
            break;
        case "degree" :
            sortByDegree(nodes, edges);
            break;
        case "rcm" :
            sortByRCM(network);
            break;
        case "gansner":
            sortByGansner(nodes);
            break;
    }
    stats.push(nodeOrder); // NameOfNodeOrder

    switch (edgeOrder.toLowerCase()) {
        case "random":
            sortRandomly(edges);
            break;
        case "index of nodes" :
            sortByNodes(nodes, edges);
            break;
        case "degree":
            sortEdgesByDegree(nodes, edges);
            break;
        case "staircases":
            sortForStaircases(nodes, edges);
            break;
    }
    stats.push(edgeOrder); // NameOfEdgeOrder

    const n = nodes.length;
    stats.push(n); // NumberOfNodes

    const density = 2 * edges.length / (n * (n - 1));
    stats.push(density); // DensityOfGraph

    stairs = detectStairs(nodes, edges);
    const stairsQuality = assessQualityOfStairs(nodes, edges);
    stats.push(stairsQuality[0]); // QualityOfStairs
    stats.push(stairs.length !== 0 ? "[" + stairsQuality[1].join(";") + "]" : ""); // QualityOfEachIndividualStair

    runways = detectRunways(nodes, edges);
    const runwaysQuality = assessQualityOfRunways(nodes, edges);
    stats.push(runwaysQuality[0]); // QualityOfRunway
    stats.push(runways.length !== 0 ? ("[" + runwaysQuality[1].join(";") + "]") : ""); // QualityOfEachIndividualRunway

    escalators = detectEscalators(nodes, edges);
    stats.push(escalators.length); // NumberOfEscalators
    stats.push(escalators.length !== 0 ? ("[" + escalators.map(d => d.length).join(";") + "]") : ""); // LengthOfEachEscalator

    paths = detectPaths(nodes, edges);
    stats.push("TODO");
    // TODO: determine QualityOfPath

    return stats.join(",");
}

function checkFile(name, input) {
    let nodes = input["nodes"];
    let edges = input["links"];

    if (nodes === undefined || nodes.map(n => n.id).includes(undefined)
        || new Set(nodes.map(n => n.id)).size !== nodes.map(n => n.id).length) {
        d3.select("#errorMessage")
            .style("display", "block")
            .text(d3.select("#errorMessage").text() + "Please check whether all node ids are uniquely defined in \'" + name + "\'.");
        d3.select("#fileButton").attr("disabled", "disabled");
        return false;
    } else if (edges === undefined || edges.map(e => e.source).includes(undefined) || edges.map(e => e.target).includes(undefined)
        || edges.map(e => !nodes.map(n => n.id).includes(e.source) || !nodes.map(n => n.id).includes(e.target)).some(Boolean)
        || edges.map(e => e.target === e.source).some(Boolean)) {
        d3.select("#errorMessage")
            .style("display", "block")
            .text(d3.select("#errorMessage").text() + "Please check whether all edges correspond to existing node ids and no loops exist in \'" + name + "\'.");
        d3.select("#fileButton").attr("disabled", "disabled");
        return false;
    }

    return true;
}