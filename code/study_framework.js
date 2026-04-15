// Control of the study prototype

// define task file based on condition
const condition = "biofabric"; // ["adjacency_matrix" | “biofabric" | "biofabric2]
const file = condition + ".json";

const types = ["plain", "one", "two"];

let log = {"demographics": {}, "answers": []};

// g element to append the visualizations
const margin = 25;
const width = parseInt(d3.select("#vis").style("width"), 10) - 2 * margin;
const height = parseInt(d3.select("#vis").style("height"), 10) - 2 * margin;
const g = d3.select("#g").attr("transform", "translate(" + margin + ", " + margin + ")");

let selectedNode = null;
let selectedEdge = null;
let selectedNodeSide = "top";
let ADMNodeHighlighting = "different";
let BFNodeHighlighting = "line";

/**
 * This function starts the session. The order of tasks is fixed.
 * @param taskFile
 */
function start(taskFile) {
    d3.json("data/tasks/" + taskFile).then(function (tasks) {
        process(tasks);
    });
}

/**
 * This function presents the tasks in the given order. This includes loading the task, updating the progress bar and logging the answers.
 * @param tasks
 */
function process(tasks) {
    let i = 0;
    let session, current, j, task, correctAnswers, start;
    showTaskIntroduction(types[i]);

    // check the answer with the solution
    d3.select("#checkButton").on("click", function () {
        let endTime = performance.now();
        let time = endTime - start;
        let answer = getAnswer(task.answer_option);
        logAnswer(task, answer, time);
        updateProgressBar(j + 1, current.length);

        correctAnswers += checkAnswer(task.answer_option, answer, task.solution, task.text_solution);

        d3.select(this).style("display", "none");
        d3.select("#clearButton").style("display", "none");
        d3.select("#nextButton").style("display", "inline");
        disableClickEvents();
    });

    // visualize the next task or forward to the following session
    d3.select("#nextButton").on("click", function () {
        d3.select(this).style("display", "none");
        if (session === "training") {
            d3.selectAll("#successMessage,#errorMessage").style("display", "none");
            d3.selectAll("#checkButton,#clearButton").style("display", "inline");
        } else {
            d3.selectAll("#submitButton,#clearButton").style("display", "inline");
        }

        if (++j < current.length) {
            task = current[j];
            loadTask(task);
            start = performance.now();
        } else if (session === "training") {
            if (correctAnswers >= current.length * 2 / 3) {
                d3.select("#framework").style("display", "none");
                d3.select("#survey").style("display", "block");
            } else {
                d3.select("#framework").style("display", "none");
                d3.select("#cancel").style("display", "block");
                logSurvey();
            }
        } else if (++i < types.length) {
            d3.select("#framework").style("display", "none");
            d3.select("#training").style("display", "block");
            showTaskIntroduction(types[i]);
        } else {
            d3.select("#framework").style("display", "none");
            d3.select("#demographics").style("display", "block");
        }
    });

    // submit answer
    d3.select("#submitButton").on("click", function () {
        let endTime = performance.now();
        let time = endTime - start;
        let answer = getAnswer(task.answer_option);
        logAnswer(task, answer, time);
        updateProgressBar(j + 1, current.length);

        d3.select(this).style("display", "none");
        d3.select("#clearButton").style("display", "none");
        d3.select("#nextButton").style("display", "inline");
        disableClickEvents();
    });

    d3.select("#startTrainingButton").on("click", function () {
        d3.select("#header").text("Training:");
        d3.select("#training").style("display", "none");
        d3.select("#framework").style("display", "block");
        d3.selectAll("#checkButton,#clearButton").style("display", "inline");
        d3.selectAll("#submitButton,#nextButton").style("display", "none");

        session = "training";
        current = tasks[types[i]][session];
        j = 0;
        task = current[j];
        correctAnswers = 0;

        loadTask(task);
        updateProgressBar(j, current.length);

        start = performance.now();
    });

    d3.select("#startSurveyButton").on("click", function () {
        d3.select("#header").text("Task:");
        d3.select("#survey").style("display", "none");
        d3.select("#framework").style("display", "block");
        d3.selectAll("#submitButton,#clearButton").style("display", "inline");
        d3.selectAll("#checkButton,#nextButton").style("display", "none");

        session = "survey";
        current = tasks[types[i]][session];
        j = 0;
        task = current[j];

        loadTask(task);
        updateProgressBar(j, current.length);
        start = performance.now();
    });
}

/**
 * This function loads the data of the task and updates the task and visualization panel.
 * @param task
 */
function loadTask(task) {
    selectedNode = null;
    selectedEdge = null;
    g.selectAll("*").remove();
    clearAnswers();

    d3.json("data/" + task.data).then(function (data) {
            const network = createNetworkData(data);
            const parameters = task.parameters;

            d3.select("#task").text(task.task);
            switch (task.technique) {
                case "adjacency_matrix":
                    adjacencyMatrix(g, width, height, network, parameters.nodeEncoding, parameters.edgeEncoding, parameters.nodeOrdering,
                        parameters.nodeAttribute, "", true);
                    d3.select(".ADMGrid").selectAll("rect").style("stroke", d3.select("#colorpicker").empty() ? "black" : d3.select("#colorpicker").property("value"));
                    break;
                case "biofabric":
                    console.log(parameters)
                    bioFabric(g, width, height, network, parameters.nodeEncoding, parameters.edgeEncoding, parameters.nodeOrdering,
                        parameters.edgeOrdering, parameters.nodeAttribute, "", true);
                    break;
            }

            if (parameters.edgeEncoding !== "plainEdges") {
                updateLegend(network);
            }
            displayAnswerOption(task.answer_option, task.possible_answers);
            enableClickEvents(task.answer_option, network.nodes);
        }
    );
}

/**
 * This function clears all answer options.
 */
function clearAnswers() {
    d3.selectAll("#node").text("Select a node on click.");
    d3.selectAll("#edge").text("Select an edge on click.");
    d3.select("#multipleNodeSelection").selectAll(".node").remove();
    d3.selectAll(".checkbox").classed("checked", false);
    d3.select("#nodes").style("display", "block");
    d3.select("#multipleEdgeSelection").selectAll(".edge").remove();
    d3.select("#edges").style("display", "block");
    d3.select("#optionSelection").selectAll(".form-check-input").property("checked", false);
    d3.select("#enter").property("value", "");
    d3.selectAll("#submitButton,#checkButton").attr("disabled", "disabled");
}

/**
 * This functions displays a legend for the edge attributes.
 * @param network
 */
function updateLegend(network) {
    const edgeAttributes = getAttributeLabels(network.edges);
    const edgeColors = d3.scaleOrdinal(d3.schemeSet1).domain(edgeAttributes);

    d3.select("#legend").selectAll("*").remove();
    edgeAttributes.forEach(function (d) {
        const attr = d3.select("#legend").append("div")
            .classed("row", true)
            .classed("justify-content-between", true);
        attr.append("div")
            .classed("col-sm-7", true)
            .append("text")
            .text(d);
        const g = attr.append("div")
            .classed("col-sm-5", true)
            .append("svg")
            .attr("width", 200)
            .attr("height", 50)
            .append("g").attr("transform", "translate(20, 15)");
        g.append("rect")
            .attr("x", 0)
            .attr("y", -10)
            .attr("width", 100)
            .attr("height", 15)
            .attr("stroke-width", 1)
            .attr("stroke", "black")
            .style("fill", edgeColors(d));
    });

}

/**
 * This function updates the click events on the visualization.
 * @param option
 * @param nodes
 */
function enableClickEvents(option, nodes) {
    switch (option) {
        case "nodeSelection":
            d3.selectAll(".checkbox").on("click", function (e, d) {
                if (d3.select(this).classed("checked")) {
                    d3.selectAll("#node").text("Select a node on click.");
                    d3.selectAll("#submitButton,#checkButton").attr("disabled", "disabled");
                    d3.select(this).classed("checked", false);
                } else {
                    d3.select("#node").datum(d).text(d.name);
                    d3.selectAll("#submitButton,#checkButton").attr("disabled", null);
                    d3.selectAll(".checkbox").classed("checked", false);
                    d3.select(this).classed("checked", true);
                }
            });
            break;

        case "edgeSelection":
            d3.selectAll(".NLDEdges").selectAll("g").on("click", function (e, d) {
                d3.select("#edge").datum(d).text(d.source.name + " - " + d.target.name);
                d3.selectAll("#submitButton,#checkButton").attr("disabled", null);
            });

            d3.selectAll(".ADMEdges,.QLTEdges,.BFEdges,.BFEdgeAttributes").selectAll("g,rect").on("click", function (e, d) {
                d3.select("#edge").datum(d).text(nodes.find(n => n.id === d.source).name + " - " + nodes.find(n => n.id === d.target).name);
                d3.selectAll("#submitButton,#checkButton").attr("disabled", null);
            });
            break;

        case "multipleNodeSelection":
            d3.selectAll(".checkbox").on("click", function (e, d) {
                if (d3.select(this).classed("checked")) {
                    d3.select(this).classed("checked", false);
                } else {
                    d3.select(this).classed("checked", true);
                }
                let selected = d3.select("#multipleNodeSelection").selectAll(".node").filter(s => s === d);
                if (selected.empty()) {
                    d3.select("#multipleNodeSelection").append("p").attr("class", "lead node my-0").datum(d).text(d.name);
                    d3.select("#nodes").style("display", "none");
                    d3.selectAll("#submitButton,#checkButton").attr("disabled", null);
                } else {
                    selected.remove();
                    if (d3.select("#multipleNodeSelection").selectAll(".node").empty()) {
                        d3.select("#nodes").style("display", "block");
                        d3.selectAll("#submitButton,#checkButton").attr("disabled", "disabled");
                    }
                }
            });
            break;

        case "multipleEdgeSelection":
            d3.selectAll(".NLDEdges").selectAll("g").on("click", function (e, d) {
                let selected = d3.select("#multipleEdgeSelection").selectAll(".edge").filter(s => s === d);
                if (selected.empty()) {
                    d3.select("#edges").style("display", "none");
                    d3.select("#multipleEdgeSelection").append("p").attr("class", "lead edge my-0").datum(d)
                        .text(d.source.name + " - " + d.target.name);
                    d3.selectAll("#submitButton,#checkButton").attr("disabled", null);
                } else {
                    selected.remove();
                    if (d3.select("#multipleEdgeSelection").selectAll(".edge").empty()) {
                        d3.select("#edges").style("display", "block");
                    }
                }
            });
            d3.selectAll(".ADMEdges,.QLTEdges,.BFEdges,.BFEdgeAttributes").selectAll("g,rect").on("click", function (e, d) {
                let selected = d3.select("#multipleEdgeSelection").selectAll(".edge").filter(s => s === d);
                if (selected.empty()) {
                    d3.select("#edges").style("display", "none");
                    d3.select("#multipleEdgeSelection").append("p").attr("class", "lead edge my-0").datum(d)
                        .text(nodes.find(n => n.id === d.source).name + " - " + nodes.find(n => n.id === d.target).name);
                    d3.selectAll("#submitButton,#checkButton").attr("disabled", null);
                } else {
                    selected.remove();
                    if (d3.select("#multipleEdgeSelection").selectAll(".edge").empty()) {
                        d3.select("#edges").style("display", "block");
                    }
                }
            });
            break;

        case "optionSelection":
            d3.select("#optionSelection").selectAll(".form-check").on("click", function () {
                d3.select("#optionSelection").selectAll(".form-check-input").property("checked", false);
                d3.select(this).select(".form-check-input").property("checked", true);
                d3.selectAll("#submitButton,#checkButton").attr("disabled", null);
            });
    }
}

function disableClickEvents() {
    g.selectAll("*").on("click", null);
}

/**
 * This function displays the required answer option. The answers can then be provided by click on the nodes or edges, or by input.
 * @param option
 * @param possibilities
 */
function displayAnswerOption(option, possibilities) {
    d3.selectAll(".answer").style("display", "none");
    d3.selectAll("#submitButton,#checkButton").attr("disabled", "disabled");
    d3.select("#" + option).style("display", "block");

    if (option === "optionSelection") {
        d3.select("#optionSelection").selectAll("*").remove();
        possibilities.forEach(function (d, i) {
            let form = d3.select("#optionSelection").append("div")
                .attr("class", "form-check");
            form.append("input")
                .attr("class", "form-check-input")
                .attr("type", "checkbox")
                .attr("value", d)
                .attr("id", "option" + i);
            form.append("label")
                .attr("class", "form-check-label")
                .attr("for", "option" + i)
                .text(d);
        });
    }
}

/**
 * This function updates the progress bar based on the current index of the task.
 * @param current index
 * @param full number of tasks
 */
function updateProgressBar(current, full) {
    d3.select(".progress-bar")
        .attr("aria-valuenow", current.toString())
        .style("width", (current / full * 100) + "%");
}

/**
 * This function retrieves the answer for the respective answer option.
 * @param option
 * @returns {*|(function(*): *)|*[]} node or edge object, array of objects or text
 */
function getAnswer(option) {
    switch (option) {
        case "nodeSelection":
            return d3.select("#node").datum();
        case "edgeSelection":
            return d3.select("#edge").datum();
        case "multipleNodeSelection":
            let nodes = [];
            d3.selectAll(".node").each(function (d) {
                nodes.push(d);
            });
            return nodes;
        case "multipleEdgeSelection":
            let edges = [];
            d3.selectAll(".edge").each(function (d) {
                edges.push(d);
            });
            return edges;
        case "optionSelection":
            return d3.select("#optionSelection").select(".form-check-input:checked").property("value");
        case "enterAnswer":
            return d3.select("#enter").property("value");
    }
}

/**
 * This function checks the provided answer with the solution. The equality check is based on the answer option.
 * The selection of multiple nodes is treated as set. For the selection of edges the order has to correspond with the solution.
 * If the answer is correct a positive alert is displayed. If not the correct textual solution is shown.
 * @param option
 * @param answer
 * @param solution
 * @param textSolution
 */
function checkAnswer(option, answer, solution, textSolution) {
    let correct;
    switch (option) {
        case "nodeSelection":
            if (Array.isArray(solution)) {
                correct = solution.map(n => n.id === answer.id).includes(true);
            } else {
                correct = answer.id === solution.id;
            }
            break;
        case "edgeSelection":
            correct = answer.source === solution.source && answer.target === solution.target;
            break;
        case "multipleNodeSelection":
            if (answer.length !== solution.length) {
                correct = false;
            } else {
                let sortAnswer = answer.map(n => n.id).sort();
                let sortSolution = solution.map(n => n.id).sort();
                correct = sortAnswer.map((n, i) => n === sortSolution[i]).every(Boolean);
            }
            break;
        case "multipleEdgeSelection":
            if (answer.length !== solution.length) {
                correct = false;
            } else {
                correct = answer.map((n, i) => n.source === solution[i].source && n.target === solution[i].target).every(Boolean);
            }
            break;
        case "optionSelection":
            correct = answer === solution;
            break;
        case "enterAnswer":
            d3.select("#successMessage").style("display", "block")
                .text("Textual answers are checked manually afterwards.");
            return;
    }

    if (correct) {
        d3.select("#successMessage").style("display", "block")
            .text("You solved this task correctly.");
    } else {
        d3.select("#errorMessage").style("display", "block")
            .text("Your answer is incorrect. The solution is: " + textSolution + ".");
    }

    return correct;
}

/**
 * This function logs the given answer and the completion time.
 * @param task
 * @param answer
 * @param time
 */
function logAnswer(task, answer, time) {
    log.answers.push({"task": task, "answer": answer, "time": time});
}

/**
 * This function logs the provided answers and demographics from the form to the console.
 */
function logDemographics() {
    let genderInput = d3.selectAll(".genderInput").selectAll("input:checked");
    let degreeInput = d3.selectAll(".degreeInput").selectAll("input:checked");
    let familiarInput = d3.selectAll(".familiarInput").selectAll("input:checked");
    let compInput = d3.selectAll(".compInput").selectAll("input:checked");
    log.demographics = {
        "age": d3.select("#ageInput").property("value"),
        "gender": genderInput.empty() ? "" : genderInput.property("value"),
        "degree": degreeInput.empty() ? "" : degreeInput.property("value"),
        "study": d3.select("#studyInput").property("value"),
        "familiarVis": familiarInput.empty() ? "" : familiarInput.property("value"),
        "familiarComp": compInput.empty() ? "" : compInput.property("value"),
        "comment": d3.select("#commentInput").property("value")
    };
}

function logSurvey() {
    console.log(JSON.stringify(log, null, 4));
}

/* The following code allows for interaction */
// Buttons:
d3.select("#introButton").on("click", function () {
    d3.select("#start").style("display", "none");
    d3.select("#intro").style("display", "block");
    showIntroduction(condition);
});

d3.select("#structureButton").on("click", function () {
    d3.select("#intro").style("display", "none");
    d3.select("#structure").style("display", "block");
});

d3.select("#startButton").on("click", function () {
    d3.select("#structure").style("display", "none");
    d3.select("#training").style("display", "block");
    start(file);
});

d3.select("#clearButton").on("click", function () {
    clearAnswers();
    d3.selectAll("#submitButton,#checkButton").attr("disabled", "disabled");
});

d3.select("#finalButton").on("click", function () {
    logDemographics();
    logSurvey();
    d3.select("#demographics").select(".card-header").append("p").attr("class", "lead").text("Please do not close the window.");
    d3.select("#demographics").selectAll(".card-body,.card-footer").style("display", "none");
});

// Answers:
d3.select("#enter").on("keyup", function () {
    d3.selectAll("#submitButton,#checkButton").attr("disabled", this.value.length === 0 ? "disabled" : null);
});