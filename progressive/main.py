import json, csv, os.path, sys, logging
from pathlib import Path
sys.path.append(os.path.join(os.path.dirname(os.path.realpath(__file__)), os.pardir))

from biofabric import generate_biofabric, format_biofabric_for_detect_staircases, detect_stairs, assessQualityOfStairs
from progressive_utils import define_samples,compute_batch, generalized_stair_kendall_tau_clean, kendall_tau_from_dicts, export_graph_dataset, stairs_to_edge_sets, evaluate_stair_sets

logger = logging.getLogger(__name__)
if not logger.handlers:
    log_file = "progressive/data/benchmark.log"
    Path(log_file).parent.mkdir(parents=True, exist_ok=True)
    
    # Remove any existing handlers and create fresh ones
    logging.root.handlers.clear()
    
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
        handlers=[
            logging.FileHandler(log_file, mode='w'),  # 'w' overwrites (fresh log)
            logging.StreamHandler(sys.stdout)
        ]
    )
    logger.info("Logging configured (fresh run) to file: %s", log_file)

def write_partial_graph(biofabric_nodes, biofabric_edges, output_file):
    """
    Convert BioFabric output to original graph JSON format and
    include sorted_nodes and sorted_edges attributes.

    Parameters
    ----------
    biofabric_nodes : list of dict
        Example: [{'id': 1}, {'id': 5}, {'id': 6}]
        Order in list corresponds to row index.
        
    biofabric_edges : list of dict
        Example:
        [
            {'edge_id': 4, 'column': 0, 'source_row': 0, 'target_row': 1},
            {'edge_id': 5, 'column': 1, 'source_row': 0, 'target_row': 2}
        ]

    output_file : str
        Path to output JSON file
    """

    # Reconstruct nodes
    nodes = [{"id": node["id"]} for node in biofabric_nodes]

    # Reconstruct links using row indices
    links = []
    for edge in biofabric_edges:
        source_id = biofabric_nodes[edge["source_row"]]["id"]
        target_id = biofabric_nodes[edge["target_row"]]["id"]

        links.append({
            "id": edge["edge_id"],
            "source": source_id,
            "target": target_id
        })

    # Final graph structure
    graph = {
        "nodes": nodes,
        "links": links
    }

    # Write to file
    with open(output_file, "w") as f:
        json.dump(graph, f, indent=2)

    # print(f"Graph written to {output_file}")


def run_experiment(files, n_iterations, methods, output_csv="progressive/data/results.csv"):
    """
    Runs experiments and writes results to CSV with columns:
    file,sample,method,result
    """
    logger.info(
        "Starting run_experiment with %d files, %d iterations, methods=%s, output_csv=%s",
        len(files), n_iterations, methods, output_csv
    )

    with open(output_csv, "w", newline="") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["file","sample","iteration","method","KT","KT_gen","s_qualityGT","s_qualityRel",
                         "s_qualityAbs","jaccard","num_node","num_edges","node_coverage"])  # header

        c = 0 # TODO: REMOVE in prod
        for file_idx, file_path in enumerate(files, start=1):
            
            # TODO: REMOVE in prod
            # if c==0:
            #     file_idx=0
            #     file_path = "progressive/synthetic_graphs/bipartite_complete_N500_E62500.json"
            # isOk = False
            # for net in ["hybrid_ring_mesh_N10_E16","mesh_N9_E12","hybrid_path_ER_N10_E16","hybrid_WS_star_N10_E33","hybrid_SBM_mesh_N10_E19"]:
            #     if net in file_path:
            #         isOk=True
            # if not isOk: continue
            
            logger.info("Processing file %d/%d: %s", file_idx, len(files), file_path)
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
            except Exception as e:
                logger.exception("Failed to load JSON from %s: %s", file_path, e)
                continue

            nodes = data.get("nodes", [])
            edges = data.get("links", [])
            for i, e in enumerate(edges):
                e["id"] = i
            logger.debug("Loaded graph '%s' with %d nodes and %d edges",
                         file_path, len(nodes), len(edges))

            try:
                GT_node_rows, GT_edge_columns, GT_fabric_edges = generate_biofabric(nodes, edges)
                GT_node_srt, GT_edges_srt = format_biofabric_for_detect_staircases(GT_node_rows, GT_fabric_edges)
                GT_stairs = detect_stairs(GT_node_srt, GT_edges_srt)
                GT_quality = assessQualityOfStairs(nodes,edges,GT_stairs)
            except Exception as e:
                logger.exception("Failed to compute GT biofabric / stairs for %s: %s", file_path, e)
                continue

            samples = define_samples(len(edges), n_iterations)
            logger.info("Defined %d samples for file %s", len(samples), file_path)

            for s_idx, s in enumerate(samples, start=1):
                logger.debug("Processing sample %d/%d (size=%s) for file %s", s_idx, len(samples), s, file_path)
                for m in methods:
                    logger.debug("Computing method '%s' on sample %s for file %s", m, s, file_path)
                    try:
                        batch_nodes, batch_edges = compute_batch(nodes, edges, s, m)

                        prog_node_rows, prog_edge_columns, prog_fabric_edges = generate_biofabric(batch_nodes, batch_edges)
                        prog_node_srt, prog_edges_srt = format_biofabric_for_detect_staircases(prog_node_rows, prog_fabric_edges)
                        prog_stairs = detect_stairs(prog_node_srt, prog_edges_srt)
                        
                        prog_quality_relative = assessQualityOfStairs(batch_nodes,batch_edges,prog_stairs)
                        prog_quality_absolute = assessQualityOfStairs(nodes,edges,prog_stairs)
                        
                        # Convert to edge sets
                        gt_stairs_edges = stairs_to_edge_sets(GT_stairs)
                        det_stairs_edges = stairs_to_edge_sets(prog_stairs)
                        metrics = evaluate_stair_sets(gt_stairs_edges, det_stairs_edges)
                        jaccard = metrics['mean_jaccard']
                        
                        # TODO: REMOVE in prod
                        # ### START: STORE PARTIAL RESULTS 
                        # netname = file_path.split("\\")[len(file_path.split("\\"))-1].replace(".json","")
                        # partpath = "partial/"+netname+"/"+m
                        # Path(partpath).mkdir(parents=True, exist_ok=True)
                        # write_partial_graph(prog_node_srt,prog_fabric_edges,partpath+"/iteration"+str(s_idx)+".json")
                        # ### END: STORE PARTIAL RESULTS

                        result_std = kendall_tau_from_dicts(GT_node_rows, prog_node_rows)
                        result_gen, per_stair = generalized_stair_kendall_tau_clean(
                            rank_gt=GT_node_rows,
                            stairs_gt=GT_stairs,     # ground truth stairs
                            rank_cmp=prog_node_rows,
                            stairs_cmp=prog_stairs,   # optional; helps match “corresponding” stairs by anchor
                            nodes_gt=nodes,
                            edges_gt=edges,
                            nodes_cmp=batch_nodes,
                            edges_cmp=batch_edges
                        )
                        
                        graph_path = file_path.split("\\")
                        graph_name = graph_path[len(graph_path)-1].replace(".json","")

                        writer.writerow([graph_name, s, s_idx, m, 
                                         result_std, result_gen, 
                                         GT_quality[0],prog_quality_relative[0],prog_quality_absolute[0],
                                         jaccard,
                                         len(nodes), len(edges), len(batch_nodes)/len(nodes)])
                        logger.debug(
                            "Wrote result: graph=%s, sample=%s, method=%s, KT=%.4f, KT_gen=%.4f",
                            graph_name, s, m, result_std, result_gen
                        )
                    except Exception as e:
                        logger.exception(
                            "Error during computation for file=%s, sample=%s, method=%s: %s",
                            file_path, s, m, e
                        )

            logger.info("Finished file %s (%d/%d)", file_path, file_idx, len(files))
            # TODO: REMOVE in prod
            c += 1 
            if c == 50:
                logger.warning("Stopping early after processing 5 files (c==5 guard).")
                break
            
    logger.info("Completed run_experiment. Results written to %s", output_csv)

if __name__ == "__main__":
    folder_graphs="progressive/synthetic_graphs/"
    folder_benchmark = "progressive/rome_benchmark/"
    
    #TODO: change in prod if necessary more graphs
    # sizes = (10, 50, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 1000)
    sizes = (10, 50, 150)
    create_syntetic = False 
    if create_syntetic: export_graph_dataset(folder_graphs, sizes, seed=42)
    
    n_iterations = 10
    methods = ["degree","closeness","betweeness","rmc","random","spectral","pakerank"]
    
    files_controlled = [str(p) for p in Path(folder_graphs).iterdir() if p.is_file()]
    output_file = "progressive/data/results_synthetic.csv"
    save_plot="progressive/data/benchplot_synthetic.png"
    run_experiment(files_controlled, n_iterations, methods,output_file)
        
    files_bench = [str(p) for p in Path(folder_benchmark).iterdir() if p.is_file()]
    output_file = "progressive/data/results_benchmark.csv"
    save_plot="progressive/data/benchplot_benchmark.png"
    run_experiment(files_bench, n_iterations, methods,output_file)        
    