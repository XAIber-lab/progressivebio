/**
 * Function to relay sorting of nodes to the utility functions already implemented
 */
function sortNodes(orderKey, nodes, edges, data, rng) {
    switch (orderKey) {
        case "adjacency":
            sortByNeighborhood(nodes, edges, nodes[0]);
            //TODO: check if we need this selector value or if we can replace it with something more reasonable
            break;
        case "alphabetical":
            sortAlphabetically(nodes);
            break;
        case "degree":
            sortByDegree(nodes, edges);
            break;
        case "gansner":
            sortByField(nodes, "gansner_pos");
            break;
        case "force":
            sortByField(nodes, "force_direct_pos");
            break;
        case "barycenter":
            sortByField(nodes, "barycenter_pos");
            break;
        case "cuthill":
            sortByField(nodes, "cuthill_pos");
            break;
        case "random":
            sortRandomly(nodes, rng);
            break;
        case "rcm":
            sortByRCM(nodes, edges);
            break;
        case "annealing":
            sortBySimulatedAnnealing(nodes, edges);
            break;
        default :
            sortAlphabetically(nodes)
            break;
    }
}

/**
 * Function to relay sorting of edges to the utility functions already implemented
 */
function sortEdges(orderKey, nodes, edges, rng) {
    switch (orderKey) {
        case "alphabetical":
            sortAlphabetically(edges);
            break;
        case "degree":
            sortEdgesByDegree(nodes, edges);
            break;
        case "nodes":
            sortByNodes(nodes, edges);
            break;
        case "random":
            sortRandomly(edges, rng);
            break;
        case "staircases":
            sortForStaircases(nodes, edges);
            break;
        default :
            sortByNodes(nodes, edges)
            break;
    }
}

/**
 * Function to create a random function call working off a seed to make it reproducible.
 * @param seed
 * @constructor
 */
function LCG(seed) {
    this.seed = seed;
    this.a = 1664525; // Multiplier
    this.c = 1013904223; // Increment
    this.m = 4294967296; // Modulus (2^32)
    this.random = function () {
        this.seed = (this.a * this.seed + this.c) % this.m;
        return this.seed / this.m;
    };
}

function getAdjacentNodes(node, edges) {
    return edges.filter(x => x.source === node.id).map(x => x.target)
        .concat(edges.filter(x => x.target === node.id).map(x => x.source));
}

/**
 * This function sorts the nodes based on their connection to a selected node.
 * All adjacent nodes are displayed at the top and the selected one is first.
 */
function sortByNeighborhood(nodes, edges, selected) {
    let adjacent = getAdjacentNodes(nodes, edges);
    nodes.sort((a, b) => {
        let adjacentA = adjacent.includes(a.id);
        let adjacentB = adjacent.includes(b.id);

        return adjacentA === adjacentB ? 0 : (adjacentA ? -1 : 1);
    });

    let index = nodes.findIndex(x => x.id === selected.id);
    let selectedNode = nodes.splice(index, 1)[0];
    nodes.unshift(selectedNode);
}

/**
 * This function sorts the nodes in alphabetical order of their name.
 * @param nodes
 */
function sortAlphabetically(nodes) {
    nodes.sort(function (a, b) {
        let nameA = a.name === undefined ? a.id : a.name
        let nameB = b.name === undefined ? b.id : b.name
        return (nameA > nameB) ? 1 : ((nameB > nameA) ? -1 : 0);
    });
}

/**
 * This function sorts the nodes in descending order based on their degree.
 * @param nodes
 * @param edges
 */
function sortByDegree(nodes, edges) {
    nodes.sort(function (a, b) {
        let count = function (id) {
            return edges.filter(e => e.source === id || e.target === id).length;
        };
        return (count(a.id) < count(b.id)) ? 1 : (count(b.id) < count(a.id) ? -1 : 0);
    });
}


/**
 * This function shuffles the elements of an array using the Fisher-Yates algorithm.
 * @param array
 * @returns {*} shuffled array
 */
function sortRandomly(array, rng) {
    let currentIndex = array.length;
    let randomIndex, temp;

    while (currentIndex !== 0) {
        randomIndex = Math.floor(rng.random() * currentIndex);
        currentIndex--;

        temp = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temp;
    }

    return array;
}

/**
 * This function sorts the nodes by Reverse Cuthill McKee to reduce bandwidth/length of edges.
 * @param nodes
 * @param edges
 */
function sortByRCM(nodes, edges) {

    const graph = reorder.graph().nodes(nodes).links(edges).init();
    let ordering = reorder.reverse_cuthill_mckee_order(graph);
    /*
    let rcm;
    if (network.rcm) {
        rcm = network.rcm;
    } else {
        let queue = [];
        let cm = [];
        let notVisited = [];
        let degrees = {};

        network.nodes.forEach(function (n) {
            degrees[n.id] = network.links.filter(e => e.source === n.id || e.target === n.id).length;
            notVisited.push([n.id, degrees[n.id]]);
        });

        while (notVisited.length) {
            // start with node with the smallest degree:
            let minNodeIndex = 0;

            notVisited.forEach(function (n, i) {
                if (notVisited[i][1] < notVisited[minNodeIndex][1]) {
                    minNodeIndex = i;
                }
            });

            queue.push(notVisited[minNodeIndex][0]);
            notVisited = notVisited.filter(d => d[0] !== queue[0]);

            while (queue.length) {
                let toSort = [];
                let neighbors = network.links.filter(e => e.source === queue[0] || e.target === queue[0])
                    .map(function (e) {
                        if (e.target === queue[0]) {
                            return e.source;
                        } else {
                            return e.target;
                        }
                    });
                neighbors.forEach(function (n) {
                    if (notVisited.filter(d => d[0] === n).length) {
                        toSort.push(n);
                        notVisited = notVisited.filter(d => d[0] !== n);
                    }
                });
                toSort.sort(function (a, b) {
                    return (degrees[a] < degrees[b]) ? 1 : ((degrees[b] < degrees[a]) ? -1 : 0);
                });
                queue.push(...toSort);
                cm.push(queue.shift());
            }
        }
        rcm = cm.reverse();
    }


    network.nodes.sort(function (a, b) {
        return (rcm.indexOf(a.id) > rcm.indexOf(b.id)) ? 1 : (rcm.indexOf(a.id) < rcm.indexOf(b.id) ? -1 : 0);
    });
    */
    nodes.sort((a, b) => {
        return (ordering[a.id] > ordering[b.id]) ? 1 : ((ordering[b.id] > ordering[a.id]) ? -1 : 0)
    });

}

/**
 * Ordering function to sort the edges based on their component nodes degrees
 * @param nodes
 * @param edges
 */
function sortEdgesByDegree(nodes, edges) {
    let sorted = JSON.parse(JSON.stringify(nodes));
    sortByDegree(sorted, edges);
    let order = sorted.map(x => x.id);

    edges.sort((a, b) => {
        let a0 = order.indexOf(a.source);
        let a1 = order.indexOf(a.target);
        let b0 = order.indexOf(b.source);
        let b1 = order.indexOf(b.target);
        if (a0 > a1) {
            [a0, a1] = [a1, a0];
        }
        if (b0 > b1) {
            [b0, b1] = [b1, b0];
        }
        return (a0 > b0) ? 1 : (b0 > a0 ? -1 : (a1 > b1) ? 1 : (b1 > a1 ? -1 : 0));
    });
}

/**
 * This function sorts the edges based on the ordering of the adjacent nodes.
 * @param nodes
 * @param edges
 */
function sortByNodes(nodes, edges) {
    edges.sort(function (a, b) {
        let map = function (id) {
            return nodes.map(n => n.id).indexOf(id);
        };
        let a1 = map(a.source) < map(a.target) ? map(a.source) : map(a.target);
        let a2 = map(a.source) < map(a.target) ? map(a.target) : map(a.source);
        let b1 = map(b.source) < map(b.target) ? map(b.source) : map(b.target);
        let b2 = map(b.source) < map(b.target) ? map(b.target) : map(b.source);

        return a1 > b1 ? 1 : (a1 < b1 ? -1 : (a2 > b2 ? 1 : (a2 < b2 ? -1 : 0)));
    });
}


/**
 * This function sorts the nodes based on pre-calculated ordering indices.
 */
function sortByField(nodes, fieldName) {
    nodes.sort(function (a, b) {
        return (a[fieldName] > b[fieldName]) ? 1 : ((b[fieldName] > a[fieldName]) ? -1 : 0);
    });
}

/**
 * This function orders the edges based on a heuristic to gain more stair like components in the graph.
 * @param nodes
 * @param edges
 */
function sortForStaircases(nodes, edges) {
    // node ordering already applied at this step
    let ordered = nodes.map(x => x.id);

    // get ordering on degree
    let sorted = JSON.parse(JSON.stringify(nodes));
    sortByDegree(sorted, edges);
    let degrees = sorted.map(x => x.id)

    edges.sort((a, b) => {
        // sort edges according to degree
        let node_a = degrees.indexOf(a.source) < degrees.indexOf(a.target) ? a.source : a.target;
        let other_a = degrees.indexOf(a.source) < degrees.indexOf(a.target) ? a.target : a.source;
        let degree_a = degrees.indexOf(node_a);
        let node_b = degrees.indexOf(b.source) < degrees.indexOf(b.target) ? b.source : b.target;
        let other_b = degrees.indexOf(b.source) < degrees.indexOf(b.target) ? b.target : b.source;
        let degree_b = degrees.indexOf(node_b);
        if (degree_a > degree_b) {
            return 1;
        } else if (degree_b > degree_a) {
            return -1;
        } else {
            // sort edges according to length
            let length_a = ordered.indexOf(other_a) - ordered.indexOf(node_a);
            let length_b = ordered.indexOf(other_b) - ordered.indexOf(node_b);
            if (length_a > length_b) {
                return 1;
            } else if (length_b > length_a) {
                return -1;
            } else {
                return 0;
            }
        }
    });
}

/**
 * This function tries to optimize for minimal edge length using simulated annealing
 * @param nodes
 * @param edges
 */
function sortBySimulatedAnnealing(nodes, edges) {
    let ordered = nodes.map(x => x.id);
    let currentLayout = [...ordered];
    let currentEnergy = calculateEnergy(currentLayout, edges);
    //console.log(currentEnergy)
    let temperature = 200.0; // Initial temperature, may need tuning
    let bestLayout = [...currentLayout];
    let bestEnergy = currentEnergy;

    while (temperature > 1) {
        let neighborLayout = generateNeighbor(currentLayout);
        let neighborEnergy = calculateEnergy(neighborLayout, edges);

        if (acceptNeighbor(currentEnergy, neighborEnergy, temperature)) {
            currentLayout = [...neighborLayout];
            currentEnergy = neighborEnergy;

            if (currentEnergy < bestEnergy) {
                bestLayout = [...currentLayout];
                bestEnergy = currentEnergy;
            }
        }

        temperature = updateTemperature(temperature);
    }
    //console.log(bestEnergy)

    const layoutIndexMap = bestLayout.reduce((acc, id, index) => {
        acc[id] = index;
        return acc;
    }, {});

    nodes.sort((a, b) => {
        return (layoutIndexMap[a.id] > layoutIndexMap[b.id]) ? 1 : ((layoutIndexMap[b.id] > layoutIndexMap[a.id]) ? -1 : 0)
    });
}

function calculateEnergy(layout, edges) {
    let energy = 0;
    edges.forEach(edge => {
        const distance = Math.abs(layout[edge.source] - layout[edge.target]);
        energy += distance;
    });
    return energy;
}

function generateNeighbor(layout) {
    let newLayout = [...layout];
    const index1 = Math.floor(Math.random() * newLayout.length);
    let index2 = Math.floor(Math.random() * newLayout.length);
    while (index1 === index2) { // Ensure we have two distinct indices
        index2 = Math.floor(Math.random() * newLayout.length);
    }
    // Swap the positions of two nodes
    [newLayout[index1], newLayout[index2]] = [newLayout[index2], newLayout[index1]];
    return newLayout;
}

function acceptNeighbor(currentEnergy, neighborEnergy, temperature) {
    if (neighborEnergy < currentEnergy) {
        return true; // Always accept if the neighbor is an improvement
    }
    // Accept with a certain probability if the neighbor is worse
    const probability = Math.exp((currentEnergy - neighborEnergy) / temperature);
    return Math.random() < probability;
}

function updateTemperature(currentTemperature) {
    const coolingRate = 0.99; // Decrease temperature by 1% each time
    return currentTemperature * coolingRate;
}
