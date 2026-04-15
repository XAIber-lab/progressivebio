#!/usr/bin/env node

// Execute with "node {Path to analyzeGraph.js}"

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
loadScript('./helpers/reorder.min.js')

let rng = new LCG(0);

let nodeOrderKeys = ["adjacency", "alphabetical", "annealing", "degree", "gansner", "force", "barycenter", "cuthill", "random", "rcm"];
let edgeOrderKeys = ["alphabetical", "degree", "nodes", "random", "staircases"];

let results = {};

// Paths for the input and output
let dirPath = './rome/';
let dataPath = dirPath + "test/" // replace with "test/" for smaller dir
let resultPath = dirPath + "results/";

analyzeDataDir(dataPath)


function analyzeDataDir(dir = './rome/test/') {

    // The internal variable '__dirname' is the path to the current place where this script is called
    // we append the directory where all the json files reside to be read (relative from current position!)
    const directoryPath = path.join(__dirname, dir);

    try {
        // Synchronously read the directory, if async the console log breaks for obvious reasons
        const dirFiles = fs.readdirSync(directoryPath);
        dirFiles.forEach((fileName) => {
            readGraph(directoryPath, fileName)
        })

    } catch (err) {

    }
}

function readGraph(filepath, filename) {

    const fullPath = path.join(filepath, filename);

    try {
        const jsonData = parseJsonFile(fullPath);
        console.log(`Read data from ${filename}: \r\n`);

        nodes = jsonData.nodes;
        edges = jsonData.links;

        results['nodes'] = []
        results['edges'] = []

        //console.log(jsonData);
        nodeOrderKeys.forEach((nodeOrderKey) => {
            sortNodes(nodeOrderKey, nodes, edges, jsonData, rng)
            results['nodes'].push({[nodeOrderKey]: nodes.map(node => node.id)})
        });
        edgeOrderKeys.forEach((edgeOrderKey) => {
            sortEdges(edgeOrderKey, nodes, edges, rng)
            results['edges'].push({[edgeOrderKey]: edges.map(node => node.id)})
        });

        writeJsonFile();
        //console.log(results)


        // return something so the promise chain works for the full time tracking
        return 0;
    } catch (err) {
        console.error("Error during JSON parsing or file reading:", err);
    }
}

function parseJsonFile(filePath) {
    try {
        // Read file synchronously
        const data = fs.readFileSync(filePath, 'utf8');
        // Parse JSON data
        return JSON.parse(data);
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

function writeJsonFile() {

    // writing the JSON string content to a file
    fs.writeFile(resultPath + "orderings.json", JSON.stringify({orderings: results}), (error) => {
        // throwing the error
        // in case of a writing problem
        if (error) {
            // logging the error
            console.error(error);

            throw error;

        }
    });

}











