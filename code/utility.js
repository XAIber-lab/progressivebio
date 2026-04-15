// Helpful functions for the visualization of network data.

/**
 * This function reads a file and returns the data parsed to json.
 * @param file
 * @returns {Promise<unknown>}
 */
function fileToJSON(file) {
    return new Promise(function (resolve, reject) {
        const fileReader = new FileReader();
        fileReader.readAsText(file);
        fileReader.onload = event => resolve(JSON.parse(event.target.result));
        fileReader.onerror = error => reject(error);
    });
}

/**
 * This function creates a dictionary from the given network data.
 * The nodes and edges are returned within arrays.
 * @param data
 * @returns {{nodes: *[], edges: *[]}}
 */
function createNetworkData(data) {
    const edges = data.links;
    const nodes = data.nodes;
    const rcm = data.rcm;

    nodes.forEach(function (n) {
        n.name = n.name !== undefined ? String(n.name) : n.id;
        if (n.attributes === undefined) {
            n.attributes = {};
        }
        if (n.layer === undefined) {
            n.layer = -1;
        }
    });

    edges.forEach(function (e) {
        // order source and target nodes by id
        if (e.source > e.target) {
            let temp = e.source;
            e.source = e.target;
            e.target = temp;
        }
    });

    return {"nodes": nodes, "edges": edges, "rcm": rcm};
}

/**
 * This function gets the labels of node or edge attributes.
 * @param list list of nodes or edges
 * @returns {*[]} list of categories
 */
function getAttributeLabels(list) {
    let labels = [];
    list.forEach(function (d) {
        Object.keys(d.attributes).forEach(function (l) {
            if (labels.indexOf(l) === -1) {
                labels.push(l);
            }
        });
    });

    return labels; // .sort();
}

/**
 * This function gets the layers of nodes.
 * @param nodes
 * @returns {*[]} list of layers
 */
function getLayers(nodes) {
    let layers = [];
    nodes.forEach(function (d) {
        if (layers.indexOf(d.layer) === -1) {
            layers.push(d.layer);
        }
    });

    return layers.sort();
}

/**
 * This function defines scales for each categorical attribute based on the range of the numerical values in the data.
 * @param attributes
 * @param data list of nodes or edges.
 * @param min minimal value to map to
 * @param max maximal value to map to
 * @returns {*} array of linear scales
 */
function defineScales(attributes, data, min, max) {
    let scales = {};
    attributes.forEach(function (c) {
        let filtered = data.filter(d => c in d.attributes).map(d => d.attributes[c]);
        scales[c] = d3.scaleLinear()
            .domain(d3.extent(filtered))
            .range([min, max]);
    });

    return scales;
}

function defineStandardScales(attributes, min, max) {
    let scales = {};
    attributes.forEach(function (c) {
        scales[c] = d3.scaleLinear()
            .domain([0, 1])
            .range([min, max]);
    });

    return scales;
}

function sortRandomly(list) {
    shuffle(list);
}

/**
 * This function sorts the nodes in alphabetical order of their name.
 * @param nodes
 */
function sortAlphabetically(nodes) {
    nodes.sort(function (a, b) {
        return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
    });
}

/**
 * This function sorts the given nodes or edges in descending order based on the numerical value of a given attribute.
 * @param attr
 * @param list of nodes or edges
 */
function sortByAttribute(attr, list) {
    list.sort(function (a, b) {
        let a_value = attr in a.attributes ? a.attributes[attr] : Number.NEGATIVE_INFINITY;
        let b_value = attr in b.attributes ? b.attributes[attr] : Number.NEGATIVE_INFINITY;
        return (a_value < b_value) ? 1 : ((b_value < a_value) ? -1 : 0);
    });
}

/**
 * This function sorts the given nodes or edges in descending order of the value of the first attribute then the second attribute.
 * @param attr
 * @param list of nodes or edges
 */
function sortByTwoAttributes(attr, list) {
    list.sort(function (a, b) {
        return (a.attributes[attr[0]] < b.attributes[attr[0]]) ? 1 : ((b.attributes[attr[0]] < a.attributes[attr[0]]) ?
            -1 : ((a.attributes[attr[1]] < b.attributes[attr[1]]) ? 1 : ((b.attributes[attr[1]] < a.attributes[attr[1]]) ? -1 : 0)));
    });
}

/**
 * This function sorts the nodes in descending order based on the mean of the existing numerical attributes.
 * @param list of nodes or edges
 */
function sortByMean(list) {
    list.sort(function (a, b) {
        let a_length = Object.keys(a.attributes).length;
        let b_length = Object.keys(b.attributes).length;
        let a_mean = a_length ? Object.values(a.attributes).reduce((x, y) => x + y) / a_length : Number.NEGATIVE_INFINITY;
        let b_mean = b_length ? Object.values(b.attributes).reduce((x, y) => x + y) / b_length : Number.NEGATIVE_INFINITY;
        return (a_mean < b_mean) ? 1 : ((b_mean < a_mean) ? -1 : 0);
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

function getDegrees(nodes, edges) {
    let degrees = {};
    nodes.forEach(x => degrees[x.id] = edges.filter(e => e.source === x.id || e.target === x.id).length);
    return degrees;
}

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
 * This function sorts the nodes by Reverse Cuthill McKee to reduce bandwidth/length of edges.
 * @param network
 */
function sortByRCM(network) {
    let rcm;
    if (network.rcm) {
        rcm = network.rcm;
    } else {
        let queue = [];
        let cm = [];
        let notVisited = [];
        let degrees = {};

        network.nodes.forEach(function (n) {
            degrees[n.id] = network.edges.filter(e => e.source === n.id || e.target === n.id).length;
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
                let neighbors = network.edges.filter(e => e.source === queue[0] || e.target === queue[0])
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
}

/**
 * This function sorts the edges based on the ordering of the adjacent source nodes.
 * All outgoing edge appear beside each other. Then they are sorted within these groups of the specified ordering.
 */
function sortBySourceNodes(nodes, edges, attributes, ordering) {
    let grouped = {};
    for (let edge of edges) {
        if (!grouped[edge.source]) {
            grouped[edge.source] = [];
        }
        grouped[edge.source].push(edge);
    }

    // sort groups of identical sources individually
    for (let group in grouped) {
        switch (ordering.toLowerCase()) {
            case "random":
                sortRandomly(grouped[group]);
                break;
            case "nodes" :
                sortByNodes(nodes, grouped[group]);
                break;
            case "mean" :
                sortByMean(grouped[group]);
                break;
            case "staircases":
                sortForStaircases(nodes, grouped[group])
                break;
            default :
                if (attributes.includes(ordering)) {
                    sortByNodes(nodes, grouped[group]);
                    sortByAttribute(ordering, grouped[group]);
                } else if (Array.isArray(ordering) && ordering.map(a => attributes.includes(a)).every(Boolean)) {
                    sortByNodes(nodes, grouped[group]);
                    sortByTwoAttributes(ordering, grouped[group]);
                }
                break;
        }
    }

    edges.sort(function (a, b) {
        let as = nodes.map(n => n.id).indexOf(a.source);
        let bs = nodes.map(n => n.id).indexOf(b.source);
        let ag = grouped[a.source].indexOf(a);
        let bg = grouped[b.source].indexOf(b);

        return as > bs ? 1 : (as < bs ? -1 : (ag > bg ? 1 : (ag < bg ? -1 : 0)));
    });
}


function sortByAdjacency(nodes, edges, selected) {
    let adjacent = getAdjacentNodes(selected, edges);
    return nodes.slice().sort((a, b) => {
        let adjacentA = adjacent.includes(a.id);
        let adjacentB = adjacent.includes(b.id);

        return adjacentA === adjacentB ? 0 : (adjacentA ? -1 : 1);
    });
}

/**
 * This function sorts the nodes based on their connection to a selected node.
 * All adjacent nodes are displayed at the top and the selected one is first.
 */
function sortByNeighborhood(nodes, edges, selected) {
    let adjacent = getAdjacentNodes(selected, edges);
    nodes.sort((a, b) => {
        let adjacentA = adjacent.includes(a.id);
        let adjacentB = adjacent.includes(b.id);

        return adjacentA === adjacentB ? 0 : (adjacentA ? -1 : 1);
    });

    let index = nodes.findIndex(x => x.id === selected.id);
    let selectedNode = nodes.splice(index, 1)[0];
    nodes.unshift(selectedNode);
}

function sortByGansner(nodes) {
    nodes.sort(function (a, b) {
        return (a.gansner > b.gansner) ? 1 : ((b.gansner > a.gansner) ? -1 : 0);
    });
}

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
        if (degree_a > degree_b) { return 1; }
        else if (degree_b > degree_a) { return -1; }
        else {
            // sort edges according to length
            let length_a = ordered.indexOf(other_a) - ordered.indexOf(node_a);
            let length_b = ordered.indexOf(other_b) - ordered.indexOf(node_b);
            if (length_a > length_b) { return 1; }
            else if (length_b > length_a) { return -1; }
            else { return 0; }
        }
    });
}

/**
 * This function calculates the normalized vector between two points
 * @param a first point
 * @param b second point
 * @returns {{x: number, y: number}} norm vector
 */
function norm(a, b) {
    let vector = {x: a.x - b.x, y: a.y - b.y};
    let distance = Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2));
    return {"x": vector.x / distance, "y": vector.y / distance};
}

/**
 * This function calculates the parallel shift of the line between two points by the given distance.
 * @param distance
 * @param a first point
 * @param b second point
 * @returns {{x: number, y: number}}
 */
function shift(distance, a, b) {
    let x1_x0 = b.x - a.x;
    let y1_y0 = b.y - a.y;
    let x2_x0, y2_y0;

    if (y1_y0 === 0) {
        x2_x0 = 0;
        y2_y0 = distance;
    } else {
        let angle = Math.atan(x1_x0 / y1_y0);
        x2_x0 = -distance * Math.cos(angle);
        y2_y0 = distance * Math.sin(angle);
    }
    return {"x": x2_x0, "y": y2_y0};
}

/**
 * This function assigns each node to a layer based on their attribute with the highest value.
 * The calculation uses relative values based on the range of each attribute.
 * @param nodes
 */
function defineLayers(nodes) {
    let range = function (attr) {
        let values = nodes.filter(n => attr in n.attributes).map(n => n.attributes[attr]);
        return {"min": Math.min(...values), "max": Math.max(...values)};
    };
    nodes.forEach(function (n) {
        if (!Object.keys(n.attributes).length) {
            n.layer = -1;
        } else {
            let normalized = {};
            for (let [attr, value] of Object.entries(n.attributes)) {
                let extremes = range(attr);
                normalized[attr] = (value - extremes.min) / (extremes.max - extremes.min);
            }
            n.layer = Object.keys(normalized).reduce((a, b) => normalized[a] > normalized[b] ? a : b);
        }
    });
}

/**
 * This function determines if the layer is at even index in the list of layers.
 * Even layers are displayed horizontally, odd layers use vertical alignment.
 * @param layer
 * @param list of layers
 * @returns {boolean}
 */
function isEven(layer, list) {
    return list.indexOf(layer) % 2 === 0;
}

// function to determine if layers are consecutive
/**
 * This function determines if the two given layers are consecutive
 * @param a
 * @param b
 * @param list of layers
 * @returns {boolean}
 */
function areConsecutive(a, b, list) {
    return Math.abs(list.indexOf(a) - list.indexOf(b)) === 1;
}

/**
 * This function determines whether the second layer is followed by the first layer
 * @param a first layer
 * @param b second layer
 * @param list of layers
 * @returns {boolean}
 */
function isFollowingLayer(a, b, list) {
    return list.indexOf(a) === list.indexOf(b) + 1;
}

/**
 * This function counts the maximal amount of cells to be displayed in the vertical and horizontal. It is used for scaling purposes.
 * @param nodes
 * @param edges
 * @param layers
 * @param number of categories
 * @returns {{horizontal: number, vertical: number}}
 */
function countCells(nodes, edges, layers, number) {
    let verticalCount = 0;
    let horizontalCount = 0;
    nodes.forEach(function (n) {
        // count nodes of following layer
        let count = nodes.filter(d => isFollowingLayer(d.layer, n.layer, layers)).length;
        // add number of skip links from this node
        count += edges.filter(e => e.source === n.id && !areConsecutive(n.layer, nodes.find(c => c.id === e.target).layer, layers)).length;
        // add number of nodes with different alignment
        count += nodes.filter(d => isEven(d.layer, layers) !== isEven(n.layer, layers) && layers.indexOf(d.layer) < layers.indexOf(n.layer)).length;
        // add number of layers with same alignment
        count += layers.filter((l, i) => isEven(l, layers) === isEven(n.layer, layers) && i <= layers.indexOf(n.layer)).length;
        if (!isEven(n.layer, layers) && horizontalCount < count) {
            horizontalCount = count;
        } else if (isEven(n.layer, layers) && verticalCount < count) {
            verticalCount = count;
        }
    });
    if (!number) {
        horizontalCount = nodes.length;
    }
    return {"vertical": verticalCount, "horizontal": horizontalCount};
}

/**
 * This function shuffles the elements of an array using the Fisher-Yates algorithm.
 * @param array
 * @returns {*} shuffled array
 */
function shuffle(array) {
    let currentIndex = array.length;
    let randomIndex, temp;

    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        temp = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temp;
    }

    return array;
}

function getAdjacentNodes(node, edges) {
    return edges.filter(x => x.source === node.id).map(x => x.target)
        .concat(edges.filter(x => x.target === node.id).map(x => x.source));
}

function shortenNumber(num) {
    let truncated = Math.floor(num * 1000) / 1000;
    if (truncated !== num) {
        return num.toFixed(3);
    } else {
        return num;
    }
}