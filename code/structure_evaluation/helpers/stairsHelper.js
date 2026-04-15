let degrees = {};

function detectStairs(nodes, edges, structureSize, delta = 2) {
  const whatIsAStair = structureSize; // at least 3 steps
  //const delta = 2; // infinite or predefined (max. 2)

  degrees = {}; // reset values since JS sometimes doesn't clear the global value

  const order = {};
  nodes.forEach((d, i) => {
    order[d.id] = i;
  });

  let fixed = null;
  let direction = null;

  let previous = null;

  let stairs = [];
  let current = [];

  let fixedNodes = [];
  let types = [];
  let type = null;

  edges.forEach(function (d) {
    degrees[d.source] = (degrees[d.source] || 0) + 1;
    degrees[d.target] = (degrees[d.target] || 0) + 1;
    if (fixed != null) {
      // check further stair
      if (fixed === d.source) {
        let diff = order[d.target] - order[previous.target];
        let cross = order[d.target] - order[previous.source];
        if (direction === "increasing" && diff > 0 && diff <= delta) {
          // same upper node, increasing edge length
          if (Math.abs(diff) !== 1) {
            type = 2;
          }
          current.push(d);
        } else if (
          direction === "decreasing" &&
          diff < 0 &&
          Math.abs(diff) <= delta
        ) {
          // same upper node, decreasing edge length
          if (Math.abs(diff) !== 1) {
            type = 2;
          }
          current.push(d);
        } else if (
          fixed === previous.target &&
          direction === "decreasing" &&
          cross > 0 &&
          cross <= delta
        ) {
          // switch
          direction = "increasing";
          type = 2;
          current.push(d);
        } else if (current.length >= whatIsAStair) {
          // end of stair
          stairs.push(current);
          fixedNodes.push(fixed);
          types.push(type);
          current = [];
          fixed = null;
        } else {
          // no stair
          current = [];
          fixed = null;
        }
      } else if (fixed === d.target) {
        let diff = order[d.source] - order[previous.source];
        let cross = order[d.source] - order[previous.target];
        if (direction === "increasing" && diff < 0 && Math.abs(diff) <= delta) {
          // same lower node, increasing edge length
          if (Math.abs(diff) !== 1) {
            type = 2;
          }
          current.push(d);
        } else if (direction === "decreasing" && diff > 0 && diff <= delta) {
          // same lower node, decreasing edge length
          if (Math.abs(diff) !== 1) {
            type = 2;
          }
          current.push(d);
        } else if (
          fixed === previous.source &&
          direction === "decreasing" &&
          cross < 0 &&
          Math.abs(cross) <= delta
        ) {
          // switch
          direction = "increasing";
          type = 2;
          current.push(d);
        } else if (current.length >= whatIsAStair) {
          // end of stair
          stairs.push(current);
          fixedNodes.push(fixed);
          types.push(type);
          current = [];
          fixed = null;
        } else {
          // no stair
          current = [];
          fixed = null;
        }
      } else if (current.length >= whatIsAStair) {
        // end of stair
        stairs.push(current);
        fixedNodes.push(fixed);
        types.push(type);
        current = [];
        fixed = null;
      } else {
        // no stair
        current = [];
        fixed = null;
      }
    }

    if (fixed == null && previous !== null) {
      // new stair possible
      current.push(previous);
      type = 1;
      if (previous.source === d.source) {
        fixed = previous.source;
        let diff = order[d.target] - order[previous.target];
        if (Math.abs(diff) !== 1) {
          type = 2;
        }
        if (diff > 0 && diff <= delta) {
          // same upper node, increasing edge length
          direction = "increasing";
          current.push(d);
        } else if (diff < 0 && Math.abs(diff) <= delta) {
          // same upper node, decreasing edge length
          direction = "decreasing";
          current.push(d);
        } else {
          // no stair
          current = [];
          fixed = null;
        }
      } else if (previous.target === d.target) {
        fixed = previous.target;
        let diff = order[d.source] - order[previous.source];
        if (Math.abs(diff) !== 1) {
          type = 2;
        }
        if (diff < 0 && Math.abs(diff) <= delta) {
          // same lower node, increasing edge length
          direction = "increasing";
          current.push(d);
        } else if (diff > 0 && diff <= delta) {
          // same lower node, decreasing edge length
          direction = "decreasing";
          current.push(d);
        } else {
          // no stair
          current = [];
          fixed = null;
        }
      } else if (previous.source === d.target) {
        fixed = previous.source;
        type = 2;
        let cross = order[d.source] - order[previous.target];
        if (cross < 0 && Math.abs(cross) <= delta) {
          // switch
          direction = "increasing";
          current.push(d);
        } else {
          // no stair
          current = [];
          fixed = null;
        }
      } else if (previous.target === d.source) {
        fixed = previous.target;
        type = 2;
        let cross = order[d.target] - order[previous.source];
        if (cross > 0 && cross <= delta) {
          // switch
          direction = "increasing";
          current.push(d);
        } else {
          // no stair
          current = [];
          fixed = null;
        }
      } else {
        current = [];
      }
    }

    previous = d;
  });

  if (current.length >= whatIsAStair) {
    // end of stair
    stairs.push(current);
    fixedNodes.push(fixed);
    types.push(type);
  }

  let qualities = getQualityOfStairs(stairs, fixedNodes);
  return [stairs, qualities];
}

function getQualityOfStairs(stairs, nodes) {
  let qualities = [];
  // each stair needs to have at least one id that's the same for each edge,
  // so we can simply add the differences between them to get the step distance size

  let optimalStepSize = 1;
  let idealAvgSteps = 1;

  let singleStairGapAssessment = [];

  stairs.forEach((stair) => {
    //TODO: still implement old metric and handle cases with division by zero!

    let commonNodeId;
    let stepSizes = [];
    let sumOfDeviations = 0;
    let sumOfStepSizes = 0;
    let sumOfSquaredDeviations = 0;
    let sumOfSquaredOPTDeviations = 0;

    let i = 0,
      j = 1;

    // get the common id found through all steps
    if (stair[i]["source"] - stair[j]["source"] === 0) {
      commonNodeId = stair[i]["source"];
    } else if (stair[i]["target"] - stair[j]["target"] === 0) {
      commonNodeId = stair[i]["target"];
    } else if (stair[i]["source"] - stair[j]["target"] === 0) {
      commonNodeId = stair[i]["source"];
    } else if (stair[i]["target"] - stair[j]["source"] === 0) {
      commonNodeId = stair[i]["target"];
    } else {
      console.log("That's not a stair!");
    }

    // Get step sizes, aka. differences between the steps
    for (; i < stair.length - 1 && j < stair.length; i++, j++) {
      // i and j are defined above!
      // one step here is always composed of two neighbouring edges that have one id in common
      //console.log(i, j)
      const sourceDifference = stair[i]["source"] - stair[j]["source"];
      const targetDifference = stair[i]["target"] - stair[j]["target"];

      const stepSize = Math.abs(sourceDifference + targetDifference);
      // should always be negative but absolute value to be sure that all are same
      stepSizes.push(stepSize);
      const deviation = Math.abs(stepSize - optimalStepSize); // Ideal Step Size is 1
      sumOfDeviations += deviation;
      sumOfStepSizes += stepSize;
    }

    // calculate size of stair compared to node degree
    const StairSizeMetric = stair.length / degrees[commonNodeId];

    // Calculate Mean Deviation (MD)
    const meanStepSize = sumOfStepSizes / stepSizes.length;
    const meanDeviation = sumOfDeviations / stepSizes.length;

    // stuff for new formula
    let SquareError = Math.pow(
      (stepSizes.length + 1) / degrees[commonNodeId],
      2,
    );
    let maxStepDist = Math.max(...stepSizes);
    let minStepDist = Math.min(...stepSizes);
    let numerator = 0;

    // prepare values for Standard Deviation (SD) and Optimal Standard Deviation (OSD)

    // For a second standard deviation where we measure the deviation from the optimal average
    // similar to the optimal size in the mean deviation above, makes cross comparisons more viable
    stepSizes.forEach((stepSize) => {
      sumOfSquaredDeviations += Math.pow(stepSize - meanStepSize, 2);
      sumOfSquaredOPTDeviations += Math.pow(stepSize - idealAvgSteps, 2);

      numerator += maxStepDist - stepSize;
    });

    // Calculate Standard Deviation
    const variance = sumOfSquaredDeviations / stepSizes.length;
    const varianceToOPT = sumOfSquaredOPTDeviations / stepSizes.length;
    const standardDeviation = Math.sqrt(variance);
    const standardOPTDeviation = Math.sqrt(varianceToOPT);

    qualities.push([
      [StairSizeMetric],
      [meanDeviation, standardDeviation, standardOPTDeviation],
    ]);

    let denominator =
      (stepSizes.length + 1) * (maxStepDist - minStepDist === 0)
        ? minStepDist
        : maxStepDist - minStepDist;

    singleStairGapAssessment.push(SquareError * (1 - numerator / denominator));
  });

  qualities.push([
    singleStairGapAssessment.reduce(
      (accumulator, currentValue) => accumulator + currentValue,
      0,
    ),
  ]);
  return qualities;
}

if (!global.runningMainScript) {
  console.log("this is a test run:");

  degrees = {};

  test_stairs = [
    [
      [
        { id: 0, source: 0, target: 1 },
        { id: 1, source: 0, target: 2 },
        { id: 2, source: 0, target: 3 },
      ],
      [
        { id: 3, source: 4, target: 5 },
        { id: 4, source: 4, target: 6 },
        { id: 5, source: 4, target: 7 },
        { id: 6, source: 4, target: 8 },
        { id: 6, source: 4, target: 9 },
      ],
      // first value always 1 since there are no other edges than the ones in the stairs for this test data!
      // all 0,0,0 for step-sizes [1,1] and [1,1,1,1], respectively, since they are optimal, for MD, SD, and OSD.
    ],
    [
      [
        { id: 0, source: 0, target: 2 },
        { id: 1, source: 0, target: 4 },
        { id: 2, source: 0, target: 6 },
      ],
      // 1,0,1 for step-sizes [2,2]
      // 1 MD means that on average the deviation from the optimal (step-size = 1) is 1 too large
      // 0 SD means that internally there is uniformity in the step sizes (not measured from the optimal)
      // 1 OSD means here that compared to the expected optimal value (where all step sizes are 1) we diverge on average 1 away,
      // similar to the MD result which also needs an optimal baseline (step-size = 1)
    ],
    [
      [
        { id: 0, source: 0, target: 1 },
        { id: 1, source: 0, target: 2 },
        { id: 2, source: 0, target: 4 },
      ],
      // 0.5,0.5, 0.707... for step-sizes [1,2]
      // 0.5 MD means that on average the deviation from the optimal (step-size = 1) is 0.5 away (1 out of 2 steps is too large)
      // 0.5 SD means that internally there is an average offset by 0.5 from the mean
      // 0.707 OSD means here that compared to the expected value (where all step sizes are 1) there is an average offset of 0.7 from the optimal mean
    ],
    [
      [
        { id: 0, source: 0, target: 1 },
        { id: 1, source: 0, target: 2 },
        { id: 3, source: 0, target: 3 },
        { id: 4, source: 0, target: 4 },
        { id: 5, source: 0, target: 6 },
      ],
      // 0.25, 0.433..., 0.5... for step-sizes [1,1,1,2]
      // 0.2 MD means that on average the deviation from the optimal (step-size = 1) is 0.25 away (1 out of 4 steps is too large by 1)
      // 0.433... SD means that internally there is an average offset by 0.433... from the mean
      // 0.5... OSD means here that compared to the expected value (where all step sizes are 1) there is an average offset of 0.5... from the optimal mean,
    ],
    [
      [
        { id: 0, source: 0, target: 1 },
        { id: 1, source: 0, target: 2 },
        { id: 3, source: 0, target: 3 },
        { id: 4, source: 0, target: 5 },
        { id: 5, source: 0, target: 7 },
      ],
      // 0.5, 0.5..., 0.707... for [1,1,2,2] // similar to before but step sizes are more equally distributed
      // explanations like two above, we get the same result since relative deviations haven't changed
    ],
    [
      [
        { id: 0, source: 0, target: 1 },
        { id: 1, source: 0, target: 2 },
        { id: 3, source: 0, target: 3 },
        { id: 4, source: 0, target: 5 },
        { id: 5, source: 0, target: 7 },
        { id: 5, source: 0, target: 9 },
      ],
      // 0.6, 0.489..., 0.774... for [1,1,2,2,2]
      // Here we added one more sub-optimal step, which locally improves (SD decreases) but OSD jumps up.
    ],
    [
      [
        { id: 0, source: 0, target: 1 },
        { id: 1, source: 0, target: 2 },
        { id: 3, source: 0, target: 3 },
        { id: 4, source: 0, target: 4 },
        { id: 5, source: 0, target: 5 },
        { id: 5, source: 0, target: 6 },
        { id: 5, source: 0, target: 7 },
        { id: 5, source: 0, target: 8 },
        { id: 5, source: 0, target: 10 },
      ],
      // 0.125, 0.330..., 0.353... for [1,1,1,1,1,1,1,2]
      // Lastly, we show how much deviation from the optimal mean we get by having only one step with a larger difference.
      // all values appear better than before (closer to 0), which makes intuitive sense, since the outlier is not bad on average
    ],
    [
      [
        { id: 0, source: 0, target: 1 },
        { id: 1, source: 0, target: 2 },
        { id: 3, source: 0, target: 3 },
        { id: 4, source: 0, target: 4 },
        { id: 5, source: 0, target: 5 },
        { id: 5, source: 0, target: 6 },
        { id: 5, source: 0, target: 7 },
        { id: 5, source: 0, target: 8 },
        { id: 5, source: 0, target: 20 },
      ],
      // 1.375, 3.637..., 3.889...
      // Adding even more distance we see the averages get diluted by the outlier
    ],
  ];

  // TODO: work out metric for all stairs in a graph not just for individual ones

  // TODO maybe add some quality focused on continuation so having a larger step in the middle is worse than at the end?

  test_stairs.forEach((config) => {
    degrees = {}; // reset degrees
    config.forEach((stair) => {
      stair.forEach((edge) => {
        degrees[edge.source] = (degrees[edge.source] || 0) + 1;
        degrees[edge.target] = (degrees[edge.target] || 0) + 1;
      });
    });
    let nodes = Object.keys(degrees).map((x) => parseInt(x, 10)); // extract nodes
    let results = getQualityOfStairs(config, nodes);
    console.log(results);
  });
}
