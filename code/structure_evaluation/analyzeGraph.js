#!/usr/bin/env node

// Execute with "node {Path to analyzeGraph.js}"

// load logger helper
require('./helpers/logger.js')();

// Node.js functions to access files and execute code outside this file
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// Function to load and execute another script (.js file)
function loadScript(scriptPath) {
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    vm.runInThisContext(scriptContent);
    // thanks node.js for no simple import of another file
}

// variable to tell the helper scripts we are running this from here, so they can be executed individually.
global.runningMainScript = true;

// Load external scripts
loadScript('./helpers/orderings.js');
loadScript('./helpers/stairsHelper.js');
loadScript('./helpers/escalatorHelper.js');
loadScript('./helpers/runwayHelper.js');
loadScript('./helpers/exporter.js');


// toggle console log
let consoleLogging = false;
//toggle additional info
let moreInfo = consoleLogging && false;
// toggle timekeeping
let timekeeping = consoleLogging && false;
// toggle display of full runtime
let fulltime = true;

let nodeOrderKeys = ["adjacency", "alphabetical", "degree", "gansner","force", "barycenter", "cuthill", "random", "rcm"];
let edgeOrderKeys = ["alphabetical", "degree", "nodes", "random", "staircases"];

// rng start
let rng = new LCG(0);

//step-size deltas, so size between steps that's allowed, minimum: 1; maximum: number of nodes
let stepSizes = [1, 3, -1];
// -1 is just placeholder for however many nodes there are and will be substituted once known

// size of the structures to find, meaning after x amount of edges the structure is confirmed
let structureSize = 3;

// final result array filled with individual instances, all containing parameters and structures with metrics
let results = [];

// Paths for the input and output
let dirPath = './rome/';
let dataPath = dirPath + "test/" // replace with "test/" for smaller dir
let resultPath = dirPath + "results/";

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Actual starting point of the script :
(fulltime || timekeeping) ? console.time("Full runtime") : null;

console.log(`starting to read directory: ${dataPath}`);

// Example for full directory scraping
analyzeDataDir(dataPath) // scrape the full directory
    .then(() => {
        console.log(`${results.length} entries`)
        try {
            console.log("Write to file...")
            //writeCSVInBatches(results, resultPath, 1000, ",");
            writeJSONInBatches(path, fs, results, resultPath, 1000)
            if (fulltime || timekeeping) {
                console.timeEnd("Full runtime");
            }
        } catch (error) {
            console.error('Error processing file:', error);
            (fulltime || timekeeping) ? console.timeEnd("Full runtime") : null;

        }
    })
    .catch((error) => {
        console.error("An error occurred:", error);
        timekeeping ? console.timeEnd("Full runtime") : null;
    });


/**
 * Scrapes a whole directory provided by a directory path to analyze all valid files inside.
 * Must be in json format, for specifics look into 'analyzeGraph' where the file is actually read.
 * @param dir relative path from where this script is called to the desired directory
 */
function analyzeDataDir(dir = './rome/test/') {

    // The internal variable '__dirname' is the path to the current place where this script is called
    // we append the directory where all the json files reside to be read (relative from current position!)
    const directoryPath = path.join(__dirname, dir);

    try {
        // Synchronously read the directory, if async the console log breaks for obvious reasons
        const dirFiles = fs.readdirSync(directoryPath);

        // Create a promise for each file to be processed
        const fileProcessingPromises = dirFiles
            .filter(filename => path.extname(filename) === '.json') // Filter files by .json extension
            .map((filename, index) => {
                let val = readGraph(directoryPath, filename)
                if (fulltime || timekeeping) {
                    if ((index + 1) % 1000 === 0) {
                        console.log(`Processed ${index + 1} files`);
                        console.timeLog("Full runtime");
                    }
                }
                return val;
            });

        // Return a promise that resolves when all files have been processed
        return Promise.all(fileProcessingPromises);
    } catch (err) {
        console.error('Unable to scan directory:', err);
        if (fulltime || timekeeping) console.timeEnd("Full runtime");
        return Promise.reject(err);
    }
}

/**
 * Reads in a graph given as a json file through it's the filename and the directory path.
 * The data is read in here not before.
 * @param filepath full path to the json file
 * @param filename name of the json file
 */
function readGraph(filepath, filename) {

    const fullPath = path.join(filepath, filename);

    timekeeping ? console.time(`Analysis time for ${filename}`) : null;

    try {
        const jsonData = parseJsonFile(fullPath);
        consoleLogging ? console.log(`Read data from ${filename}: \r\n`) : null;
        //console.log(jsonData);

        analyzeGraph(jsonData.nodes, jsonData.links, jsonData, filename)
        // TODO: might not be 'links' for every file so might need to catch that here

        timekeeping ? console.timeEnd(`Analysis time for ${filename}`) : null;
        timekeeping ? console.log('----------------------------------------------------------\r\n') : null;

        // return something so the promise chain works for the full time tracking
        return 0;
    } catch (err) {
        console.error("Error during JSON parsing or file reading:", err);
        timekeeping ? console.timeEnd(`Analysis time for ${filename}`) : null;
    }
}

/**
 * Analyzes the graph with different given parameters, like order or stepsizes.
 * The results always have the same template to fill for each distinct configuration appended to the overall results.
 * The stepsizes only matter for stairs and escalators
 * @param nodes
 * @param edges
 * @param data
 * @param filename
 */
function analyzeGraph(nodes, edges, data, filename) {

    let result_template = {
        file: filename,
        nodeOrder: "",
        edgeOrder: "",
        structureSize: structureSize,
        stepSize: -1,
        stairs: [],
        stairQualities: [],
        escalators: [],
        escalatorQualities: [],
        runways: [],
        runwayQualities: [],
    }

    stepSizes = stepSizes.map(size => {
        return (size === -1) ? nodes.length : size;
    }) // replace stepsize "-1" with the actual node length as a maximal step size possible for this file

    nodeOrderKeys.forEach(nodeOrderKey => {
        edgeOrderKeys.forEach(edgeOrderKey => {


            // Ordering Nodes and Edges
            timekeeping ? console.time("Ordering Nodes and Edges") : null;
            consoleLogging ? console.log(`Ordering Nodes with ${nodeOrderKey} key`) : null;
            sortNodes(nodeOrderKey, nodes, edges, data, rng)
            consoleLogging ? console.log(`Ordering Edges with ${edgeOrderKey} key`) : null;
            sortEdges(edgeOrderKey, nodes, edges, rng)
            timekeeping ? console.timeEnd("Ordering Nodes and Edges") : null;
            consoleLogging ? console.log("") : null; // formatting of console log

            result_template.nodeOrder = nodeOrderKey;
            result_template.edgeOrder = edgeOrderKey;


            /* start analyzing the ordered nodes and edges as if they were displayed by bio-fabric */

            // Runways
            timekeeping ? console.time("Analyzing runways") : null;
            let [runways, runwayQualities] = detectRunways(nodes, edges)
            timekeeping ? console.timeEnd("Analyzing runways") : null;
            consoleLogging ? console.log(`Found ${runways.length > 0 ? runways.length : "no"} runway${runways.length !== 1 ? "s" : ""}!\r\n`) : null;
            moreInfo ? console.log(runways) : null;
            moreInfo ? console.log(runwayQualities) : null;

            result_template.runways = runways.map(r => {
                return r.map(e => {
                    return e.id
                })
            });
            result_template.runwayQualities = runwayQualities;


            stepSizes.forEach((stepSize, index) => {

                // Stairs
                timekeeping ? console.time("Analyzing stairs") : null;
                let [stairs, stairQualities] = detectStairs(nodes, edges, structureSize, stepSize)
                timekeeping ? console.timeEnd("Analyzing stairs") : null;
                consoleLogging ? console.log(`Found ${stairs.length > 0 ? stairs.length : "no"} stair${stairs.length !== 1 ? "s" : ""}, with maximal stepSize ${stepSize}!\r\n`) : null;
                moreInfo ? console.log(stairs) : null;
                moreInfo ? console.log(stairQualities) : null;

                // Escalators
                timekeeping ? console.time("Analyzing escalators") : null;
                let [escalators, escalatorQualities] = detectEscalators(nodes, edges, structureSize, stepSize)
                timekeeping ? console.timeEnd("Analyzing escalators") : null;
                consoleLogging ? console.log(`Found ${escalators.length > 0 ? escalators.length : "no"} escalator${escalators.length !== 1 ? "s" : ""}, with maximal stepSize ${stepSize}!\r\n`) : null;
                moreInfo ? console.log(escalators) : null;
                moreInfo ? console.log(escalatorQualities) : null;

                result_template.stepSize = stepSize;
                result_template.stairs = stairs.map(r => {
                    return r.map(e => {
                        return e.id
                    })
                });
                result_template.stairQualities = stairQualities;
                result_template.escalators = escalators.map(r => {
                    return r.map(e => {
                        return e.id
                    })
                });
                result_template.escalatorQualities = escalatorQualities;


                let newResult = {...result_template}
                // make shallow copy so the compiler doesn't just write refs into the results array but the full struct
                results.push(newResult);
            })

            consoleLogging ? console.log('----------------------------------------------------------\r\n') : null;
        });
    });
}

/**
 * reading and parsin the json given by the filepath
 * @param filePath full path to the json file
 */
function parseJsonFile(filePath) {
    try {
        // Read file synchronously
        const data = fs.readFileSync(filePath, 'utf8');
        // Parse JSON data
        const jsonData = JSON.parse(data);
        return jsonData;
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error(`File not found: ${filePath}`);
        } else if (err instanceof SyntaxError) {
            console.error(`Error parsing JSON from file ${filePath}:`, err.message);
        } else {
            console.error(`Error reading file ${filePath}:`, err.message);
        }
        throw err;
    }
}

// Example for single file
/*analyzeData('./rome/', 'grafo113.28.json')
    .then(() => {
        if (fulltime || timekeeping) {
            console.timeEnd("Full runtime");
            console.log('----------------------------------------------------------\r\n\r\n');
        }
    })
    .catch((error) => {
        console.error("An error occurred:", error);
        if (fulltime || timekeeping) console.timeEnd("Full runtime");
    });
*/

/**
 * Start analyzing a single datafile given by filename and directory.
 * @param dir relative path from where this script is called to the desired directory
 * @param filename name of the json file
 */
/*
function analyzeData(dir = '../data', filename) {

    // see comment in analyzeDataDir for explanation of directoryPath
    const directoryPath = path.join(__dirname, dir);
    return readGraph(directoryPath, filename)
}
*/

