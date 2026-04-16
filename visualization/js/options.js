let options = { 
    solver_in_use: "gurobi",
    
    timeout_value: 50,
    // timeout_value: 25200,

    solve_split: false,
    solve_adjacency: false,

    optimization_objective: 1, // select 1 for unweighted objective function, 0 for weighted

    problem_folder: "progressive/lp_problems",
    solution_folder: "progressive/lp_solutions_precomputed",
    rewrite_exhisting_formulations: false
}

try { exports.options = options; } catch(e){} // for node.js