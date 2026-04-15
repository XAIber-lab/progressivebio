let edgeLengths;
let runways;
let staircases;
// let escalators;
let paths;

let colors = d3.scaleOrdinal(["rgb(142, 56, 40)", "rgb(185, 73, 50)", "rgb(220, 145, 63)", "rgb(239, 202, 88)",
    "rgb(138, 190, 86)", "rgb(63, 96, 167)", "rgb(75, 145, 203)", "rgb(203, 137, 62)"]);

function getPatterns(nodes, edges) {
    edgeLengths = getEdgeLengths(nodes, edges);
    runways = detectRunways(nodes, edges);
    staircases = detectStairs(nodes, edges);
    // escalators = detectEscalators(nodes, edges);
    paths = detectPaths(nodes, edges);
}

function getEdgeLengths(nodes, edges) {
    let nodeIndexMap = {}
    nodes.forEach((value, index) => {
        nodeIndexMap[value.id] = index;
    });
    return edges.map(x => Math.abs(nodeIndexMap[x.source] - nodeIndexMap[x.target]));
}

let nodeDegrees = {};

function finalizeStreak(map, key, results, minLength = 3) {
    let streak = map[key]; // potential runway
    delete map[key]; // reset

    if (streak.length >= minLength) {
        results.push({streak: streak, streakIds: streak.map(e => e.id), commonId: key});

    }
}

function addToArrayMap(map, key, value) {
    // Check if the key already exists
    if (!map[key]) {
        // If not, create a new array with the value
        map[key] = [value];
    } else {
        // If it does, just push the new value to the existing array
        map[key].push(value);
    }
}

function detectRunways(nodes, edges) {
    let trackers = {};
    let results = [];
    nodeDegrees = {}; // reset values since JS sometimes doesn't clear the global value

    // we go over each edge and store the current edge_ids into the tracker
    edges.forEach((edge, index) => {

        // degree extraction for quality measure
        nodeDegrees[edge.source] = (nodeDegrees[edge.source] || 0) + 1;
        nodeDegrees[edge.target] = (nodeDegrees[edge.target] || 0) + 1;

        let oldKeys = Object.keys(trackers); // might be empty in the beginning
        addToArrayMap(trackers, edge.source, edge);
        addToArrayMap(trackers, edge.target, edge);

        // now after adding we need to verify if the trackers still look at streaks, or if they have ended

        // check which oldkeys we need to throw out
        oldKeys.forEach((key) => {
            // we assert here that if the current edge does not share node_ids with the previous streaks they are done.
            if (key !== edge.source.toString() && key !== edge.target.toString() && index !== 0) {
                finalizeStreak(trackers, key, results);
                // in here is the final check if the streak is bigger than our threshold
            }
        });
    });

    // last iteration so the final streaks may be extracted
    Object.keys(trackers).forEach((key) => {
        finalizeStreak(trackers, key, results);
    });

    let qualities = getQualityOfRunways(results);

    return [results, qualities];
}

function getQualityOfRunways(runways) {

    let qualities = [];
    runways.forEach((runway) => {
        qualities.push(runway.streak.length / nodeDegrees[runway.commonId]);
    });
    return qualities;
}

function finalizeStair(map, key, results, indexMap, minLength = 3, maxStepSize = 1) {
    let edgeIds = map[key].edgeList;
    let pairValues = map[key].pairValues;
    let commonValue = indexMap[key];
    delete map[key] // reset

    if (edgeIds.length >= minLength) {

        //console.log("CurrStreak: ")
        //console.log(pairValues)

        let potentialStair = []
        let currPairValues = []

        let direction = 0; // should only take [-1,0,1] as values

        // additional check on the pair values to verify the stair:
        for (let i = 0; i < pairValues.length - 1; i++) {
            let j = i + 1; // Get the next element's index
            // iterate pairwise over the opposing values

            let firstValuePos = indexMap[pairValues[i]];
            let secondValuePos = indexMap[pairValues[j]]

            // get the actual positions from the index map, given nodes might be shuffled
            let difference = firstValuePos - secondValuePos;
            let newDirection = difference > 0 ? -1 : 1; // similar to a comparator function
            let tooLargeStepSize = Math.abs(difference) > maxStepSize
            let crossing = false //firstValuePos > commonValue && secondValuePos < commonValue
            //|| firstValuePos < commonValue && secondValuePos > commonValue;

            if (Math.abs(newDirection - direction) > 1  // direction switch from 1 to -1 or vice versa
                || tooLargeStepSize
                || crossing) // too large difference between stair edges
            {

                // from here on it's not a valid stair with j, but if the potential before it is long enough, we might store that
                if (potentialStair.length >= minLength - 1) { // mirrors the condition from before, but we need to make sure
                    potentialStair.push(edgeIds[i]) // we add from index i here since that one is still valid!
                    // only the new j now has met the break condition!
                    currPairValues.push(indexMap[pairValues[i]])

                    // store the result
                    results.push({
                        commonId: parseInt(key),
                        stair: potentialStair,
                        commonValue: commonValue,
                        pairValues: currPairValues
                    });
                }

                // we also reset here there may be more stairs starting with this value
                potentialStair = []
                currPairValues = []
                //console.log("reset")
                // so we add the last node because otherwise we would skip it!
            }

            // now if it's only a direction change the stairs can still just overlap and be valid,
            // however if it's breaking the maxStepSize then that's a problem!
            if (!tooLargeStepSize) {
                potentialStair.push(edgeIds[i])
                currPairValues.push(indexMap[pairValues[i]])
            }
            direction = newDirection;
        }


        // last iteration since we only iterate over pairs, but maybe make sure it's the same direction!!
        potentialStair.push(edgeIds[edgeIds.length - 1])
        currPairValues.push(indexMap[pairValues[edgeIds.length - 1]])

        // final check if remaining stuff is also a stair
        if (potentialStair.length >= minLength) { // mirrors the condition from before, but we need to make sure
            results.push({
                commonId: parseInt(key),
                stair: potentialStair,
                commonValue: commonValue,
                pairValues: currPairValues
            });
            //console.log("Add: ")
            //console.log(currPairValues)
        }
    }
}

function addToStairArrayMap(map, key, value, pairValue) {


    // Check if the key already exists
    if (!map[key]) {
        // If not, create a new object with the value
        map[key] = {edgeList: [value], pairValues: [pairValue]};
    } else {
        // If it does, just push the new value to the existing arrays
        map[key].edgeList.push(value);
        map[key].pairValues.push(pairValue);
    }
}

function detectStairs(nodes, edges, structureSize = 3, stepSize = 1) {
    stepSize = nodes.length;

    let nodeDegrees = {}
    const minimumLength = structureSize;
    let trackers = {};
    let results = [];

    let nodeIndexMap = {}
    nodes.forEach((value, index) => {
        nodeIndexMap[value.id] = index;
    });
    let edgeMap = {} // might seem useless but spares us a lot of O(n) find(...) calls

    // we go over each edge and store the current edge_ids into the tracker
    edges.forEach((edge, index) => {

        // degree extraction for quality measure
        nodeDegrees[edge.source] = (nodeDegrees[edge.source] || 0) + 1;
        nodeDegrees[edge.target] = (nodeDegrees[edge.target] || 0) + 1;

        // edgeMap for quality measures
        edgeMap[edge.id] = edge;

        let oldKeys = Object.keys(trackers) // might be empty in the beginning
        addToStairArrayMap(trackers, edge.source, edge.id, edge.target)
        addToStairArrayMap(trackers, edge.target, edge.id, edge.source)

        // now after adding we need to verify if the trackers still look at streaks, or if they have ended


        // check which oldkeys we need to throw out
        oldKeys.forEach((key) => {
            // we do exactly the same as searching for streaks, but...
            if (key !== edge.source.toString() && key !== edge.target.toString() && index !== 0) {
                finalizeStair(trackers, key, results, nodeIndexMap, minimumLength, stepSize);
                // in here we additionally check the pairValues if they are consistent
            }
        });
        //console.log(trackers)
    });

    // last iteration so the final streaks may be extracted
    Object.keys(trackers).forEach((key) => {
        finalizeStair(trackers, key, results, nodeIndexMap, minimumLength, stepSize);
    })



    //let qualities = getQualityOfStairs(results, edgeMap, nodeIndexMap, nodeDegrees);
    let qualities = [];
    let ids = nodes.map(x => x.id);
    results.forEach((result) => {
        qualities.push(compute_individual_stair_quality(result.stair, edges, ids))
        result.stairEdges = result.stair.map((id) => edgeMap[id])
    });
    return [results, qualities];
}

function compute_individual_stair_quality(stair, edges, currNodeOrdering){
    let edges_involved = stair.map(id => edges.find(l => l.id === id)).filter(e => e !== undefined);
    let arr = edges_involved.map(e => [e.source, e.target]).flat()
    let node_in_common = arr.find((e, i) => arr.indexOf(e) !== i);

    let node_in_common_pos = currNodeOrdering.indexOf(node_in_common);

    // compute node degree
    let node_in_common_degree = edges.filter(d => d.source === node_in_common || d.target === node_in_common).length

    let completeness = Math.pow(stair.length / node_in_common_degree, 2)

    let arr_d = [];
    for (let i in edges_involved){
        i = parseInt(i);
        if (i === edges_involved.length - 1) continue;

        let e = edges_involved[i];
        let next_e = edges_involved[i+1];

        let sourcepos_e = currNodeOrdering.indexOf(e.source)
        let targetpos_e = currNodeOrdering.indexOf(e.target)
        let sourcepos_next_e = currNodeOrdering.indexOf(next_e.source)
        let targetpos_next_e = currNodeOrdering.indexOf(next_e.target)

        let othernodes = [sourcepos_e, targetpos_e, sourcepos_next_e, targetpos_next_e].filter(n => n !== node_in_common_pos)
        if ((othernodes[0] < node_in_common_pos && othernodes[1] > node_in_common_pos) ||
            (othernodes[0] > node_in_common_pos && othernodes[1] < node_in_common_pos))
            arr_d.push(othernodes[0] + othernodes[1])
        else arr_d.push(Math.abs(othernodes[0] - othernodes[1]))
    }

    let max_d = Math.max.apply(0, arr_d)
    let min_d = Math.min.apply(0, arr_d)

    let d_diff = (max_d === min_d? 1 : max_d - min_d)

    let topsum = 0;

    for (let d of arr_d){
        topsum += d - min_d;
    }

    let denominator = stair.length * d_diff;

    return completeness * (1 - topsum / denominator)
}

/* function compute_stair_quality(edges, r, currNodeOrdering) {

    let all_stairs_quality = 0;
    r.forEach((res) => {
        let stair = res.stair
        let edges_involved = stair.map(id => edges.find(l => l.id === id)).filter(e => e !== undefined);
        let node_in_common = res.commonId

        let node_in_common_pos = currNodeOrdering.findIndex(n => n.id === node_in_common);

        // compute node degree
        let node_in_common_degree = edges.filter(d => d.source === node_in_common || d.target === node_in_common).length

        let completeness = Math.pow(stair.length / node_in_common_degree, 2)

        let arr_d = [];
        for (let i in edges_involved) {
            i = parseInt(i);
            if (i === edges_involved.length - 1) continue;

            let e = edges_involved[i];
            let next_e = edges_involved[i + 1];

            let sourcepos_e = currNodeOrdering.findIndex(n => n.id === e.source);
            let targetpos_e = currNodeOrdering.findIndex(n => n.id === e.target);
            let sourcepos_next_e = currNodeOrdering.findIndex(n => n.id === next_e.source);
            let targetpos_next_e = currNodeOrdering.findIndex(n => n.id === next_e.target);

            let othernodes = [sourcepos_e, targetpos_e, sourcepos_next_e, targetpos_next_e].filter(n => n !== node_in_common_pos)
            if ((othernodes[0] < node_in_common_pos && othernodes[1] > node_in_common_pos) ||
                (othernodes[0] > node_in_common_pos && othernodes[1] < node_in_common_pos))
                arr_d.push(othernodes[0] + othernodes[1])
            else arr_d.push(Math.abs(othernodes[0] - othernodes[1]))
        }

        let max_d = Math.max.apply(0, arr_d)
        let min_d = Math.min.apply(0, arr_d)

        let d_diff = (max_d === min_d ? 1 : max_d - min_d)

        let topsum = 0;

        for (let d of arr_d) {
            topsum += d - min_d;
        }

        let denominator = stair.length * d_diff;

        all_stairs_quality += completeness * (1 - topsum / denominator)
    })
    return all_stairs_quality
} */

/* function getQualityOfStairs(results, edgeMap, nodeIndexMap, degrees) {
    let qualities = [];
    // each stair needs to have at least one id that's the same for each edge,
    // so we can simply add the differences between them to get the step distance size

    let optimalStepSize = 1;
    let idealAvgSteps = 1;

    results.forEach((result) => {

        let stair = result.stair.map((id) => edgeMap[id])

        let commonNodeId = result.commonId;
        let stepSizes = [];
        let sumOfDeviations = 0;
        let sumOfStepSizes = 0;
        let sumOfSquaredDeviations = 0;
        let sumOfSquaredOPTDeviations = 0;


        // Get step sizes, aka. differences between the steps
        for (let i = 0; i < stair.length - 1; i++) {
            let j = i + 1;
            // one step here is always composed of two neighbouring edges that have one id in common
            //console.log(i, j)
            const sourceDifference = nodeIndexMap[stair[i]['source']] - nodeIndexMap[stair[j]['source']];
            const targetDifference = nodeIndexMap[stair[i]['target']] - nodeIndexMap[stair[j]['target']];

            //console.log(sourceDifference)
            //console.log(targetDifference)


            const stepSize = Math.abs(sourceDifference + targetDifference)
            // should always be negative but absolute value to be sure that all are same
            stepSizes.push(stepSize)
            const deviation = Math.abs(stepSize - optimalStepSize); // Ideal Step Size is 1
            sumOfDeviations += deviation;
            sumOfStepSizes += stepSize;
        }

        // calculate size of stair compared to node degree
        const StairSizeMetric = stair.length / degrees[commonNodeId]

        // Calculate Mean Deviation (MD)
        const meanStepSize = sumOfStepSizes / stepSizes.length;
        const meanDeviation = sumOfDeviations / stepSizes.length;


        // stuff for new formula
        let maxStepDist = Math.max(...stepSizes);
        let numerator = 0


        // prepare values for Standard Deviation (SD) and Optimal Standard Deviation (OSD)

        // For a second standard deviation where we measure the deviation from the optimal average
        // similar to the optimal size in the mean deviation above, makes cross comparisons more viable
        stepSizes.forEach(stepSize => {
            sumOfSquaredDeviations += Math.pow(stepSize - meanStepSize, 2);
            sumOfSquaredOPTDeviations += Math.pow(stepSize - idealAvgSteps, 2);

            numerator += (maxStepDist - stepSize)
        });

        // Calculate Standard Deviation
        const variance = sumOfSquaredDeviations / stepSizes.length;
        const varianceToOPT = sumOfSquaredOPTDeviations / stepSizes.length;
        const standardDeviation = Math.sqrt(variance);
        const standardOPTDeviation = Math.sqrt(varianceToOPT);

        qualities.push([[StairSizeMetric], [meanDeviation, standardDeviation, standardOPTDeviation]]);

    });

    return qualities;
} */

/* function detectEscalators(nodes, edges, structureSize = 3) {

    const nodeOrderToIndex = {}; // ID to Index structure, so we know the position in the current ordering
    nodes.forEach((d, i) => nodeOrderToIndex[d.id] = i);

    let escalators = [];
    let current = []; // there should always be at least one in here so we can check for the next


    edges.forEach((edge, index) => {

        if (index === 0) {
            current = [edge];
            return; // skip this iteration, imagine continue in a for or while loop
        }

        let prevSource = current[current.length - 1].source;
        let prevTarget = current[current.length - 1].target;

        if (nodeOrderToIndex[edge.source] !== nodeOrderToIndex[prevSource]
            && nodeOrderToIndex[edge.target] !== nodeOrderToIndex[prevTarget]
            && (nodeOrderToIndex[edge.source] < nodeOrderToIndex[prevTarget]
                && nodeOrderToIndex[edge.target] > nodeOrderToIndex[prevSource]) ||
            (nodeOrderToIndex[edge.target] < nodeOrderToIndex[prevSource]
                && nodeOrderToIndex[edge.source] > nodeOrderToIndex[prevTarget])
        ) {
            current.push(edge);
        } else {
            // break condition
            if (current.length >= structureSize) {
                escalators.push(current);
            }
            current = [edge]; // reset current for the next iteration so there is always something in here
        }
    });

    // final check after going through everything
    if (current.length >= structureSize) {
        escalators.push(current);
    }


    let qualityMetric = escalators.map(e => e.length);
    let results = []
    escalators.forEach((result) => {
        results.push({"escalator": result.map(x => x.id), "escalatorEdges": result})
    });
    return [results, qualityMetric];
} */

function detectPaths(nodes, edges, structureSize = 3) {
    // const delta = 2
    const whatIsAPath = structureSize; // at least so many steps

    const order = {};
    nodes.forEach((d, i) => order[d.id] = i);

    let direction = null;
    let previous = null;

    let paths = [];
    let current = [];
    edges.forEach(function (d) {
        // Check if the edge continues the current streak
        if (direction != null) {
            /* let diff1 = order[d.source] - order[previous.source];
            let diff2 = order[d.target] - order[previous.target]; */
            if (direction === "increasing" && d.target === previous.source) { // && Math.abs(diff2) <= delta
                // path continues increasingly
                current.push(d);
            } else if (direction === "decreasing" && d.source === previous.target) { // && Math.abs(diff1) <= delta
                // path continues decreasingly
                current.push(d);
            } else {
                if (current.length >= whatIsAPath) { // end of path
                    paths.push(current);
                }
                current = [];
                direction = null;
            }
        }

        if (direction == null && previous !== null) { // new path possible
            current.push(previous);
            /* let diff1 = order[d.source] - order[previous.source];
            let diff2 = order[d.target] - order[previous.target]; */
            if (d.target === previous.source) { // && Math.abs(diff2) <= delta
                direction = "increasing";
                current.push(d);
            } else if (d.source === previous.target) { // && Math.abs(diff1) <= delta
                direction = "decreasing";
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

    let results = []
    paths.forEach((result) => {
        results.push({"path": result.map(x => x.id), "pathEdges": result})
    });

    return results;
}

function highlightPattern() {
    if (!isDataSelected()) {
        return;
    }
    const pattern = d3.select("#patternSelect").node().value;

    let streak = [];
    switch (pattern) {
        case "runway":
            streak = runways[0];
            break;
        case "staircase":
            streak = staircases[0].map(x => x.stairEdges);
            break;
        /* case "escalator":
            streak = escalators[0].map(x => x.escalatorEdges);
            break; */
        case "path":
            streak = paths.map(x => x.pathEdges);
            break;
    }

    d3.selectAll(".background, .source, .target").attr("fill-opacity", 0);
    d3.selectAll("*").classed("runwayHighlight", false).classed("staircaseHighlight", false).classed("escalatorHighlight", false).classed("pathHighlight", false)

    if (pattern === "runway") {
        // highlight streak node only
        streak.forEach(function (d, i) {
            d["streak"].forEach(function (runway) {
                d3.selectAll(".edges g").filter(x => x.target === runway.target && x.source === runway.source && x.source === parseInt(d["commonId"]))
                    .classed(pattern + "Highlight", true)
                    .select(".source")
                    .attr("fill", colors(i))
                    .attr("fill-opacity", 0.5);
                d3.selectAll(".edges g").filter(x => x.target === runway.target && x.source === runway.source && x.target === parseInt(d["commonId"]))
                    .classed(pattern + "Highlight", true)
                    .select(".target")
                    .attr("fill", colors(i))
                    .attr("fill-opacity", 0.5);
            });
        });
    } else {
        // highlight full edge
        streak.forEach(function (p, i) {
            p.forEach(d => d3.selectAll(".edges g").filter(x => x.target === d.target && x.source === d.source)
                .classed(pattern + "Highlight", true)
                .select(".background")
                .attr("fill", colors(i))
                .attr("fill-opacity", 0.5));
        });
    }

    // quality tooltip
    d3.selectAll("." + pattern + "Highlight > .background, .runwayHighlight > .source, runwayHighlight > .target")
        .on("mouseover", function (event, d) {
        const tooltip = d3.select(".patternTooltip").classed("hide", false).classed("show", true);
            //.style("visibility", "visible")

        let index, quality, message;
        switch (pattern) {
            case "runway":
                index = runways[0].findIndex(x => x.streakIds.includes(d.id))
                quality = Math.round( runways[1][index] * 100) / 100
                message = runways[0][index].streakIds.length + " Edges, Quality: " + quality
                break;
            case "staircase":
                index = staircases[0].findIndex(x => x.stair.includes(d.id))
                quality = Math.round( staircases[1][index] * 100) / 100
                message = staircases[0][index].stair.length + " Edges, Quality: " + quality
                break;
            /* case "escalator":
                index = escalators[0].findIndex(x => x.escalator.includes(d.id))
                message = escalators[1][index] + " Edges"
                break; */
            case "path":
                index = paths.findIndex(x => x.path.includes(d.id))
                message = paths[index].path.length + " Edges"
                break;
        }
        tooltip.html("<div class='textTooltip'>" + message + "</div>");

        let matrix = this.getScreenCTM()
            .translate(+this.getAttribute("x"),
                +this.getAttribute("y"));
        var yOffset = tooltip.node().offsetHeight + 5;
        tooltip.style("left", (window.pageXOffset + matrix.e + 0.5 * this.getAttribute("width")) + "px")
            .style("top",(window.pageYOffset + matrix.f - yOffset) + "px");
    }).on("mouseout", () => d3.select(".patternTooltip").classed("show", false).classed("hide", true));//d3.select(".patternTooltip").style("visibility", "hidden"));

    // summary
    let avgEdgeLength = Math.round(edgeLengths.reduce((acc, val) => acc + val, 0) / edgeLengths.length * 100) / 100;
    let numStaircases = staircases[0].length;
    let stairsQuality = 0;
    if (numStaircases !== 0) {
        stairsQuality = Math.round(staircases[1].reduce((acc, val) => acc + val, 0) / numStaircases * 100) / 100;
    }
    let numRunways = runways[0].length;
    let runwaysQuality = 0;
    if (numRunways !== 0) {
        runwaysQuality = Math.round(runways[1].reduce((acc, val) => acc + val ** 2, 0) / numRunways * 100) / 100;
    }
    let summary = "Summary statistics: "
        + numStaircases + " staircase" + (numStaircases === 1 ? "" : "s") + (numStaircases === 0 ? "" : " with an overall quality of " + stairsQuality) + ", "
        + numRunways + " runway" + (numRunways === 1 ? "" : "s")
        + (numRunways === 0 ? "" : " with an overall quality of " + runwaysQuality)
        + " and an average edge length of " + avgEdgeLength + ".";
    d3.select(".summary").text(summary);
}
