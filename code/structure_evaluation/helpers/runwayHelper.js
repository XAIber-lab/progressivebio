let nodeDegrees = {}

function detectRunways(nodes, edges) {

    const whatIsARunway = 3; // at least 3 consecutive parts
    let streakNodeID = null;
    let currentStreak = [];
    let resultStreaks = [];
    let resultStreakNodes = [];
    nodeDegrees = {} // reset values since JS sometimes doesn't clear the global value

    edges.forEach((edge, index) => {

        nodeDegrees[edge.source] = (nodeDegrees[edge.source] || 0) + 1;
        nodeDegrees[edge.target] = (nodeDegrees[edge.target] || 0) + 1;
        // Check if the edge continues the current streak
        if (streakNodeID === null || edge.source === streakNodeID || edge.target === streakNodeID) {
            // Start a new streak or continue the current streak
            if (currentStreak.length === 0) {
                streakNodeID = edge.source === streakNodeID || streakNodeID === null ? edge.source : edge.target;
            }
            currentStreak.push(edge);
        } else {
            // If the streak is broken and long enough, add it to resultStreaks
            if (currentStreak.length >= whatIsARunway) {
                resultStreaks.push([...currentStreak]);
                resultStreakNodes.push(streakNodeID);

            }
            // Start a new streak with the current edge
            currentStreak = [edge];
            streakNodeID = edge.source; // Initialize streakNodeID with the current edge's source
        }

        // Handle the last streak in the list
        if (index === edges.length - 1 && currentStreak.length >= whatIsARunway) {
            resultStreaks.push([...currentStreak]);
            resultStreakNodes.push(streakNodeID);
        }
    });

    let qualities = getQualityOfRunways(resultStreaks, resultStreakNodes)

    return [resultStreaks, qualities];
}

function getQualityOfRunways(runways, streakNodes) {

    let qualities = [];
    runways.forEach((runway, index) => {
        qualities.push(runway.length / nodeDegrees[streakNodes[index]])
    })
    return qualities;
}