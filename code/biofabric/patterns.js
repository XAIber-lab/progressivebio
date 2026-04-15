let stairs = [];
let escalators = [];
let paths = [];
let runways = [];

let shortestStair = 3;
let shortestEscalator = 3;
let shortestPath = 3;
let distanceStairs = 1;
let distance1Escalators = 1;
let distance2Escalators = 1;
let distancePaths = 1;
let distanceRunways = distanceStairs;
let shortestRunway = shortestStair;

const color = d3.scaleOrdinal(d3.schemeSet1);

function detectPatterns(nodes, edges) {
    stairs = detectStairs(nodes, edges);
    paths = detectPaths(nodes, edges);
    escalators = detectEscalators(nodes, edges);
    runways = stairs;

    highlightPatterns();
    updateStatistics(nodes, edges);
}

function detectStairs(nodes, edges) {
    const whatIsAStair = shortestStair;
    const delta = distanceStairs;

    const order = {};
    nodes.forEach((d, i) => order[d.id] = i);

    let fixed = null;
    let direction = null;
    let end = false;

    let previous = null;

    let stairs = [];
    let current = [];

    edges.forEach(function (d) {
        if (fixed != null) { // check further stair
            if (fixed === d.source) {
                let diff = order[d.target] - order[previous.target];
                let cross = order[d.target] - order[previous.source];
                if (direction === "increasing" && diff > 0 && diff <= delta) { // same upper node, increasing edge length
                    current.push(d);
                } else if (direction === "decreasing" && diff < 0 && Math.abs(diff) <= delta) { // same upper node, decreasing edge length
                    current.push(d);
                } else if (fixed === previous.target && direction === "decreasing" && cross > 0 && cross <= delta) { // switch
                    direction = "increasing";
                    current.push(d);
                } else if (current.length >= whatIsAStair) { // end of stair
                    stairs.push(current);
                    current = [];
                    fixed = null;
                } else { // no stair
                    current = [];
                    fixed = null;
                }
            } else if (fixed === d.target) {
                let diff = order[d.source] - order[previous.source];
                let cross = order[d.source] - order[previous.target];
                if (direction === "increasing" && diff < 0 && Math.abs(diff) <= delta) { // same lower node, increasing edge length
                    current.push(d);
                } else if (direction === "decreasing" && diff > 0 && diff <= delta) { // same lower node, decreasing edge length
                    current.push(d);
                } else if (fixed === previous.source && direction === "decreasing" && cross < 0 && Math.abs(cross) <= delta) { // switch
                    direction = "increasing";
                    current.push(d);
                } else if (current.length >= whatIsAStair) { // end of stair
                    stairs.push(current);
                    current = [];
                    fixed = null;
                } else { // no stair
                    current = [];
                    fixed = null;
                }
            } else if (current.length >= whatIsAStair) { // end of stair
                stairs.push(current);
                current = [];
                fixed = null;
                end = true;
            } else { // no stair
                current = [];
                fixed = null;
            }
        }

        if (fixed == null && previous !== null && !end) { // new stair possible
            current.push(previous);
            if (previous.source === d.source) {
                fixed = previous.source;
                let diff = order[d.target] - order[previous.target];
                if (diff > 0 && diff <= delta) { // same upper node, increasing edge length
                    direction = "increasing";
                    current.push(d);
                } else if (diff < 0 && Math.abs(diff) <= delta) { // same upper node, decreasing edge length
                    direction = "decreasing";
                    current.push(d);
                } else { // no stair
                    current = [];
                    fixed = null;
                }
            } else if (previous.target === d.target) {
                fixed = previous.target;
                let diff = order[d.source] - order[previous.source];
                if (diff < 0 && Math.abs(diff) <= delta) { // same lower node, increasing edge length
                    direction = "increasing";
                    current.push(d);
                } else if (diff > 0 && diff <= delta) { // same lower node, decreasing edge length
                    direction = "decreasing";
                    current.push(d);
                } else { // no stair
                    current = [];
                    fixed = null;
                }
            } else if (previous.source === d.target) {
                fixed = previous.source;
                let cross = order[d.source] - order[previous.target];
                if (cross < 0 && Math.abs(cross) <= delta) { // switch
                    direction = "increasing";
                    current.push(d);
                } else { // no stair
                    current = [];
                    fixed = null;
                }
            } else if (previous.target === d.source) {
                fixed = previous.target;
                let cross = order[d.target] - order[previous.source];
                if (cross > 0 && cross <= delta) { // switch
                    direction = "increasing";
                    current.push(d);
                } else { // no stair
                    current = [];
                    fixed = null;
                }
            } else {
                current = [];
            }
        }

        end = false;
        previous = d;
    });

    if (current.length >= whatIsAStair) { // end of stair
        stairs.push(current);
    }

    return stairs;
}

function detectRunways(nodes, edges) {
    const whatIsARunway = shortestRunway;
    const delta = distanceRunways;

    const order = {};
    nodes.forEach((d, i) => order[d.id] = i);

    let fixed = null;
    let direction = null;
    let end = false;

    let previous = null;

    let runways = [];
    let current = [];

    edges.forEach(function (d) {
        if (fixed != null) { // check further stair
            if (fixed === d.source) {
                let diff = order[d.target] - order[previous.target];
                let cross = order[d.target] - order[previous.source];
                if (direction === "increasing" && diff > 0 && diff <= delta) { // same upper node, increasing edge length
                    current.push(d);
                } else if (direction === "decreasing" && diff < 0 && Math.abs(diff) <= delta) { // same upper node, decreasing edge length
                    current.push(d);
                } else if (fixed === previous.target && direction === "decreasing" && cross > 0 && cross <= delta) { // switch
                    direction = "increasing";
                    current.push(d);
                } else if (current.length >= whatIsARunway) { // end of stair
                    runways.push(current);
                    current = [];
                    fixed = null;
                } else { // no stair
                    current = [];
                    fixed = null;
                }
            } else if (fixed === d.target) {
                let diff = order[d.source] - order[previous.source];
                let cross = order[d.source] - order[previous.target];
                if (direction === "increasing" && diff < 0 && Math.abs(diff) <= delta) { // same lower node, increasing edge length
                    current.push(d);
                } else if (direction === "decreasing" && diff > 0 && diff <= delta) { // same lower node, decreasing edge length
                    current.push(d);
                } else if (fixed === previous.source && direction === "decreasing" && cross < 0 && Math.abs(cross) <= delta) { // switch
                    direction = "increasing";
                    current.push(d);
                } else if (current.length >= whatIsARunway) { // end of stair
                    runways.push(current);
                    current = [];
                    fixed = null;
                } else { // no stair
                    current = [];
                    fixed = null;
                }
            } else if (current.length >= whatIsARunway) { // end of stair
                runways.push(current);
                current = [];
                fixed = null;
                end = true;
            } else { // no stair
                current = [];
                fixed = null;
            }
        }

        if (fixed == null && previous !== null && !end) { // new stair possible
            current.push(previous);
            if (previous.source === d.source) {
                fixed = previous.source;
                let diff = order[d.target] - order[previous.target];
                if (diff > 0 && diff <= delta) { // same upper node, increasing edge length
                    direction = "increasing";
                    current.push(d);
                } else if (diff < 0 && Math.abs(diff) <= delta) { // same upper node, decreasing edge length
                    direction = "decreasing";
                    current.push(d);
                } else { // no stair
                    current = [];
                    fixed = null;
                }
            } else if (previous.target === d.target) {
                fixed = previous.target;
                let diff = order[d.source] - order[previous.source];
                if (diff < 0 && Math.abs(diff) <= delta) { // same lower node, increasing edge length
                    direction = "increasing";
                    current.push(d);
                } else if (diff > 0 && diff <= delta) { // same lower node, decreasing edge length
                    direction = "decreasing";
                    current.push(d);
                } else { // no stair
                    current = [];
                    fixed = null;
                }
            } else if (previous.source === d.target) {
                fixed = previous.source;
                let cross = order[d.source] - order[previous.target];
                if (cross < 0 && Math.abs(cross) <= delta) { // switch
                    direction = "increasing";
                    current.push(d);
                } else { // no stair
                    current = [];
                    fixed = null;
                }
            } else if (previous.target === d.source) {
                fixed = previous.target;
                let cross = order[d.target] - order[previous.source];
                if (cross > 0 && cross <= delta) { // switch
                    direction = "increasing";
                    current.push(d);
                } else { // no stair
                    current = [];
                    fixed = null;
                }
            } else {
                current = [];
            }
        }

        end = false;
        previous = d;
    });

    if (current.length >= whatIsARunway) { // end of stair
        runways.push(current);
    }

    return runways;
}

function detectPaths(nodes, edges) {
    const whatIsAPath = shortestPath; // at least three steps
    const delta = distancePaths; // infinite or predefined (max. 2)

    const order = {};
    nodes.forEach((d, i) => order[d.id] = i);

    let direction = null;
    let previous = null;

    let paths = [];
    let current = [];
    edges.forEach(function (d) {
        if (direction != null) { // check further path
            let diffSources = order[d.source] - order[previous.source];
            let diffTargets = order[d.target] - order[previous.target];
            let diffCross1 = order[d.source] - order[previous.target];
            let diffCross2 = order[d.target] - order[previous.source];
            if (direction === "decreasing") {
                if (diffSources > 0 && diffSources <= delta && diffTargets > 0 && diffTargets <= delta && diffCross1 === 0) { // path continues decreasingly
                    current.push(d);
                } else if (current.length >= whatIsAPath) { // end of path
                    paths.push(current);
                    current = [];
                    direction = null;
                } else { // no path
                    current = [];
                    direction = null;
                }
            } else if (direction === "increasing") {
                if (diffSources < 0 && Math.abs(diffSources) <= delta && diffTargets <= 0 && Math.abs(diffTargets) <= delta && diffCross2 === 0) { // path continues increasingly
                    current.push(d);
                } else if (current.length >= whatIsAPath) { // end of path
                    paths.push(current);
                    current = [];
                    direction = null;
                } else { // no path
                    current = [];
                    direction = null;
                }
            }
        }

        if (direction == null && previous !== null) { // new path possible
            current.push(previous);
            let diffSources = order[d.source] - order[previous.source];
            let diffTargets = order[d.target] - order[previous.target];
            let diffCross1 = order[d.source] - order[previous.target];
            let diffCross2 = order[d.target] - order[previous.source];
            if (diffSources > 0 && diffSources <= delta && diffTargets > 0 && diffTargets <= delta && diffCross1 === 0) {
                direction = "decreasing";
                current.push(d);
            } else if (diffSources < 0 && Math.abs(diffSources) <= delta && diffTargets <= 0 && Math.abs(diffTargets) <= delta && diffCross2 === 0) {
                direction = "increasing";
                current.push(d);
            } else {
                current = [];
            }
        }

        previous = d;
    });

    if (current.length >= whatIsAPath) { // end of path
        paths.push(current);
    }

    return paths;
}

function detectEscalators(nodes, edges) {
    const whatIsAnEscalator = shortestEscalator; // at least three steps
    const delta1 = distance1Escalators; // infinite or predefined (max. 2)
    const delta2 = distance2Escalators; // infinite or predefined (max. 2)

    const order = {};
    nodes.forEach((d, i) => order[d.id] = i);

    let direction = null;
    let previous = null;

    let escalators = [];
    let current = [];
    edges.forEach(function (d) {
        if (direction != null) { // check further escalator
            let diffSources = order[d.source] - order[previous.source];
            let diffTargets = order[d.target] - order[previous.target];
            let diffCross1 = order[d.source] - order[previous.target];
            let diffCross2 = order[d.target] - order[previous.source];
            if (direction === "decreasing") {
                if (diffSources > 0 && diffSources <= delta1 && diffTargets > 0 && diffTargets <= delta2 && diffCross1 !== 0) { // escalator continues decreasingly
                    current.push(d);
                } else if (current.length >= whatIsAnEscalator) { // end of escalator
                    escalators.push(current);
                    current = [];
                    direction = null;
                } else { // no escalator
                    current = [];
                    direction = null;
                }
            } else if (direction === "increasing") {
                if (diffSources < 0 && Math.abs(diffSources) <= delta1 && diffTargets < 0 && Math.abs(diffTargets) <= delta2 && diffCross2 !== 0) { // escalator continues increasingly
                    current.push(d);
                } else if (current.length >= whatIsAnEscalator) { // end of escalator
                    escalators.push(current);
                    current = [];
                    direction = null;
                } else { // no escalator
                    current = [];
                    direction = null;
                }
            }
        }

        if (direction == null && previous !== null) { // new escalator possible
            current.push(previous);
            let diffSources = order[d.source] - order[previous.source];
            let diffTargets = order[d.target] - order[previous.target];
            let diffCross1 = order[d.source] - order[previous.target];
            let diffCross2 = order[d.target] - order[previous.source];
            if (diffSources > 0 && diffSources <= delta1 && diffTargets > 0 && diffTargets <= delta2 && diffCross1 !== 0) {
                direction = "decreasing";
                current.push(d);
            } else if (diffSources < 0 && Math.abs(diffSources) <= delta1 && diffTargets < 0 && Math.abs(diffTargets) <= delta2 && diffCross2 !== 0) {
                direction = "increasing";
                current.push(d);
            } else {
                current = [];
            }
        }

        previous = d;
    });

    if (current.length >= whatIsAnEscalator) { // end of escalator
        escalators.push(current);
    }

    return escalators;
}

function enableChangeOfParameters(nodes, edges, number) {
    const patterns = ["Stairs", "Paths", "Escalators", "Runways"];
    patterns.forEach(function (d) {
        const params = d3.select("body")
            .append("div")
            .attr("id", "parameters" + d)
            .attr("class", "parameters")
            .attr("className", "form-group mx-auto")
            .style("display", "flex")
            .style("visibility", "hidden");

        const shortest = params.append("div").attr("class", "px-3");
        shortest.append("label")
            .attr("htmlFor", "shortest" + d)
            .style("display", "block")
            .text("Shortest");
        const shortestSelection = shortest.append("select")
            .attr("id", "shortest" + d)
            .attr("class", "shortest")
            .attr("className", "form-control");
        for (let i = 2; i <= number; i++) {
            if (i === 3) { // default is 3
                shortestSelection.append("option").attr("value", i).attr("selected", true).text(i);
            } else {
                shortestSelection.append("option").attr("value", i).text(i);
            }
        }

        if (d === "Escalators") {
            const distance1 = params.append("div");
            distance1.append("label")
                .attr("htmlFor", "distance1" + d)
                .style("display", "block")
                .text("Distance (upper)");
            const distance1Selection = distance1.append("select")
                .attr("id", "distance1" + d)
                .attr("class", "distance")
                .attr("className", "form-control");
            distance1Selection.append("option").attr("value", edges.length).text("infinite");
            distance1Selection.append("option").attr("value", 1).attr("selected", true).text(1);
            for (let i = 2; i < edges.length; i++) {
                distance1Selection.append("option").attr("value", i).text(i);
            }
            const distance2 = params.append("div").attr("class", "px-3");
            distance2.append("label")
                .attr("htmlFor", "distance2" + d)
                .style("display", "block")
                .text("Distance (lower)");
            const distance2Selection = distance2.append("select")
                .attr("id", "distance2" + d)
                .attr("class", "distance")
                .attr("className", "form-control");
            distance2Selection.append("option").attr("value", edges.length).text("infinite");
            distance2Selection.append("option").attr("value", 1).attr("selected", true).text(1);
            for (let i = 2; i < edges.length; i++) {
                distance2Selection.append("option").attr("value", i).text(i);
            }
        } else {
            const distance = params.append("div");
            distance.append("label")
                .attr("htmlFor", "distance" + d)
                .style("display", "block")
                .text("Distance");
            const distanceSelection = distance.append("select")
                .attr("class", "distance")
                .attr("id", "distance" + d)
                .attr("className", "form-control");
            distanceSelection.append("option").attr("value", edges.length).text("infinite");
            distanceSelection.append("option").attr("value", 1).attr("selected", true).text(1); // default is 1
            for (let i = 2; i < edges.length; i++) {
                distanceSelection.append("option").attr("value", i).text(i);
            }
        }
    });

    const element = d3.select("svg").select("g").node().getBoundingClientRect();
    d3.selectAll(".parameters").style("left", (element.left + margins.left * 2) + "px")
        .style("top", (element.top) + "px");

    d3.selectAll(".shortest").on("change", function (_) {
        let pattern = d3.select(this).property("id").slice(8);
        let value = d3.select(this).property("value");
        switch (pattern) {
            case "Stairs":
                shortestStair = value;

                break;
            case "Paths":
                shortestPath = value;
                break;
            case "Escalators":
                shortestEscalator = value;
        }

        detectPatterns(nodes, edges); // overhead
    });

    d3.selectAll(".distance").on("change", function (_) {
        let pattern = d3.select(this).property("id").slice(8);
        let value = d3.select(this).property("value");
        switch (pattern) {
            case "Stairs":
                distanceStairs = value;
                break;
            case "Paths":
                distancePaths = value;
                break;
            case "1Escalators":
                distance1Escalators = value;
                break;
            case "2Escalators":
                distance2Escalators = value;
                break;
        }

        detectPatterns(nodes, edges); // overhead
    });
}

function highlightPatterns() {
    const pattern = d3.selectAll("#patterns .nav-item.active").select(".nav-link").attr("id");

    let list = [];
    switch (pattern) {
        case "stairs":
            list = stairs;
            break;
        case "paths":
            list = paths;
            break;
        case "escalators":
            list = escalators;
            break;
    }

    d3.selectAll("#bf .edges g .background").attr("fill-opacity", 0);
    list.forEach(function (pattern, i) {
        pattern.forEach(d => d3.selectAll("#bf .edges g").filter(x => x.target === d.target && x.source === d.source)
            .select(".background")
            .attr("fill", color(i))
            .attr("fill-opacity", 0.3));
    });
}

function addStatistics(nodes, edges) {
    const element = d3.select("svg").select("g").node().getBoundingClientRect();

    // stats on edge length
    const ids = nodes.map(x => x.id);
    const lengths = edges.map(x => Math.abs(ids.indexOf(x.source) - ids.indexOf(x.target)));
    const sum = lengths.reduce((acc, num) => acc + num, 0);
    const average = sum / lengths.length;
    const max = Math.max(...lengths);
    const min = Math.min(...lengths);

    const statsLength = d3.select("body")
        .append("div")
        .attr("id", "statisticsLength")
        .attr("className", "mx-auto")
        .style("display", "flex")
        .style("left", (element.left + margins.left * 10) + "px")
        .style("top", element.top + "px");

    statsLength.append("p").attr("class", "px-3").style("font-weight", "bold").text("Edge length");
    statsLength.append("p").attr("class", "px-2").text("min: " + min);
    statsLength.append("p").attr("class", "px-2").text("avg: " + parseFloat(average.toFixed(3)));
    statsLength.append("p").attr("class", "px-2").text("max: " + max);

    // stats on patterns
    const patterns = ["Stairs", "Paths", "Escalators", "Runways"];
    patterns.forEach(function (d) {
        let stats = d3.select("body")
            .append("div")
            .attr("id", "statistics" + d)
            .attr("class", "statistics")
            .attr("className", "mx-auto")
            .style("display", "flex")
            .style("visibility", "hidden")
            .style("left", (element.left + margins.left * 10) + "px")
            .style("top", (element.top + margins.top * .5) + "px");

        stats.append("p").attr("class", "px-3").style("font-weight", "bold").text(d);
        stats.append("p").attr("class", "quality px-2").text("");
    });
}

function updateStatistics(nodes, edges) {
    const patterns = ["Stairs", "Paths", "Escalators", "Runways"];
    patterns.forEach(function (d) {
        let quality = "";
        switch (d) {
            case "Stairs":
                quality = parseFloat(assessQualityOfStairs(nodes, edges)[0].toFixed(3));
                break;
            case "Paths":
                quality = "to be defined";
                break;
            case "Escalators":
                quality = escalators.length;
                break;
            case "Runways":
                quality = parseFloat(assessQualityOfRunways(nodes, edges)[0].toFixed(3));
                break;
        }

        d3.selectAll("#statistics" + d).select(".quality").text(quality);
    });
}

function assessQualityOfStairs(nodes, edges) {
    if (stairs.length === 0) {
        return [0, ""];
    }

    const degrees = getDegrees(nodes, edges);
    let sum = 0;
    let centers = [];

    let individual = []; // quality of individual stair

    stairs.forEach(function (stair) {
        // get center node
        let involved = [].concat(...stair.map(link => [link.source, link.target]));
        involved.sort((a, b) => involved.filter(v => v === a).length - involved.filter(v => v === b).length);
        let center = involved.pop();
        centers.push(center);

        // add to sum how much of the adjacent edges the stair covers
        sum += stair.length / degrees[center];

        let missedIndividual = edges.filter(d => (center === d.source || center === d.target) && !stair.some(item => item.source === d.source && item.target === d.target)).length;
        individual.push(stair.length / degrees[center] / (1 + missedIndividual));
    });

    // get missing steps, i.e. nodes that are not covered in one of our stairs for the same staircase
    let allSteps = [].concat.apply([], stairs);
    let missed = edges.filter(d => !allSteps.some(item => item.source === d.source && item.target === d.target)
        && centers.some(x => x === d.source || x === d.target)).length;

    return [sum / stairs.length / (1 + missed), individual];
}

function assessQualityOfRunways(nodes, edges) {
    if (runways.length === 0) {
        return [0, ""];
    }

    const degrees = getDegrees(nodes, edges);
    let sum = 0;
    let centers = [];

    let individual = []; // quality of individual runway

    runways.forEach(function (runway) {
        // get center node
        let involved = [].concat(...runway.map(link => [link.source, link.target]));
        involved.sort((a, b) => involved.filter(v => v === a).length - involved.filter(v => v === b).length);
        let center = involved.pop();
        centers.push(center);

        // add to sum how much of the adjacent edges the runway covers
        sum += runway.length / degrees[center];

        let missedIndividual = edges.filter(d => (center === d.source || center === d.target) && !runway.some(item => item.source === d.source && item.target === d.target)).length;
        individual.push(runway.length / degrees[center] / (1 + missedIndividual));
    });

    // get missing steps, i.e. nodes that are not covered in one of our runways for the same runway
    let allSteps = [].concat.apply([], runways);
    let missed = edges.filter(d => !allSteps.some(item => item.source === d.source && item.target === d.target)
        && centers.some(x => x === d.source || x === d.target)).length;

    return [sum / runways.length / (1 + missed), individual];
}
