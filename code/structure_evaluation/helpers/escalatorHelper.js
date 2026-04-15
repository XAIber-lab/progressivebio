function detectEscalators(nodes, edges, structureSize, delta = 2) {
    const whatIsAnEscalator = structureSize; // at least so many steps
    const delta1 = delta; // infinite or predefined (max. 2)
    const delta2 = delta; // infinite or predefined (max. 2)

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
            if (direction === "decreasing") {
                if (diffSources === 1 && diffTargets === 1) { // escalator continues decreasingly
                    current.push(d);
                } else if (diffSources === 1 && diffTargets > 0 && diffTargets <= delta2) { // end of escalator
                    current.push(d);
                    escalators.push(current);
                    current = [];
                    direction = null;
                } else if (current.length >= whatIsAnEscalator) { // end of escalator
                    escalators.push(current);
                    current = [];
                    direction = null;
                } else { // no escalator
                    current = [];
                    direction = null;
                }
            } else if (direction === "increasing") {
                if (diffSources === -1 && diffTargets === -1) { // escalator continues increasingly
                    current.push(d);
                } else if (diffSources === -1 && diffTargets < 0 && Math.abs(diffTargets) <= delta2) { // end of escalator
                    current.push(d);
                    escalators.push(current);
                    current = [];
                    direction = null;
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
            if (diffSources > 0 && diffSources <= delta1 && diffTargets > 0 && diffTargets === 1) {
                direction = "decreasing"
                current.push(d);
            } else if (diffSources < 0 && Math.abs(diffSources) <= delta1 && diffTargets < 0 && Math.abs(diffTargets) === 1) {
                direction = "increasing"
                current.push(d);
            } else {
                current = [];
            }
        }

        previous = d;
    })

    if (current.length >= whatIsAnEscalator) { // end of escalator
        escalators.push(current);
    }

    let qualityMetric = escalators.map(e => e.length)

    return [escalators, qualityMetric];
}