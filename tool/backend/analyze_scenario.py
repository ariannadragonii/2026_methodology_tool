import json
import numpy as np
import networkx as nx
from scenario import json_to_graph_scenario, find_action_nodes, find_f_in, find_f_out, find_consumers, find_edge_between_nodes, find_outgoing_edges
from architecture import create_new_architecture, add_architecture_active_producer,add_architecture_passive_producer, add_architecture_pull_consumer, add_architecture_push_consumer, add_component, add_link, from_graph_architecture_to_json, find_components_nodes

def calculate_costs(node_params, K_sc_coeff, K_dc_b_coeff, K_dc_s_coeff, K_rc_coeff):
    f_in = node_params['f_in']
    f_out = node_params['f_out']
    ic = node_params['inputCardinality']
    outc = node_params['outputCardinality']
    c_sc_c = f_in * (K_sc_coeff * ic)
    c_sc = c_sc_c + f_out * (K_rc_coeff * outc)
    c_dc_b = f_out * (K_dc_b_coeff * ic)
    c_dc_s = f_in * (K_dc_s_coeff * ic)
    return c_sc,c_sc_c, c_dc_b, c_dc_s


# Evaluate the optimal type for a node at a specific point in the parameter space.
def evaluate_node_at_point(node_params, K_sc, K_dc_b, K_rc, K_dc_s):
    c_sc, c_sc_c, c_dc_b, c_dc_s = calculate_costs(node_params, K_sc, K_dc_b, K_dc_s, K_rc)
    vals = {'sc': c_sc, 'dcb': c_dc_b, 'dcs': c_dc_s}
    best = min(vals, key=lambda k: vals[k])
    label_map = {
        'sc': 'State-Centric',
        'dcb': 'Data-Centric (Batch)',
        'dcs': 'Data-Centric (Stream)'
    }
    return {
        'type': best,
        'label': label_map.get(best, best)
    }


# Combines components for the dataflows of a scenario and returns the architecuture
def combine_data_flows(json_scenario, json_dataflows):
    graph_scenario = json_to_graph_scenario(json_scenario)
    graph_architecture = create_new_architecture()
    persistent_links = []
    state_centric_components = []

    # Create components and volatile links
    for node in json_scenario['nodes']:
        node_id = node['id']
        node_type = node['type']
        node_name = node['name']
    
        if node_type == 'active_p':
            add_architecture_active_producer(graph_architecture, node_id, node_name)
            continue
        elif node_type == 'passive_p':
            add_architecture_passive_producer(graph_architecture, node_id, node_name)
            continue
        elif node_type == 'pull_c':
            delivery_guarantee = node['deliveryGuarantee']
            add_architecture_pull_consumer(graph_architecture, node_id, node_name, delivery_guarantee)
            continue
        elif node_type == 'push_c': 
            delivery_guarantee = node['deliveryGuarantee']
            add_architecture_push_consumer(graph_architecture, node_id, node_name, delivery_guarantee)
            continue
        else:
            ic = node['inputCardinality']
            oc = node['outputCardinality']
            # search the node in all dataflows
            optimal_types_links = get_optimal_types(json_dataflows, node_id)
            optimal_types = list(optimal_types_links.keys())
            n_optimal_types = len(optimal_types)
            persist_state = 'sc' in optimal_types

            # If there is only one optimal type, creates a component with that optimal type
            if n_optimal_types == 1:
                optimal_type = next(iter(optimal_types_links))
                add_component(graph_architecture, node_id, node_name, node_type, ic, oc, optimal_type)
            elif n_optimal_types == 2:
                # dcs dcb
                if not persist_state:
                    optimal_type = 'dcs'
                    add_component(graph_architecture, node_id, node_name, node_type, ic, oc, optimal_type)
                    # Save links that must be persistent
                    for out_id in optimal_types_links['dcb']:
                        persistent_links.append((node_id, out_id))
                else:
                    state_centric_components.append(node_id)
                    optimal_type = 'dcs' if 'dcs' in optimal_types else 'dcb'
                    add_component(graph_architecture, node_id, node_name, node_type, ic, oc, optimal_type)
                    state_node_id = f"{node_id}_sc"
                    add_component(graph_architecture, state_node_id, node_name, node_type, ic, oc, 'sc')

                    # Link a processing to a state
                    out_links_processing = optimal_types_links[optimal_type]
                    frequencies_dataItems = []
                    for out_link_processing in out_links_processing:
                        edge = find_edge_between_nodes(graph_scenario, node_id, out_link_processing)
                        frequency = edge['frequency']
                        data_item = edge['dataItem']
                        frequencies_dataItems.append((frequency, data_item))

                    # For each different data item, keep the minimum frequency
                    min_freq_per_item = {}
                    for freq, item in frequencies_dataItems:
                            if item not in min_freq_per_item or freq < min_freq_per_item[item][0]:
                                min_freq_per_item[item] = (freq, item)
                    filtered_tuples = list(min_freq_per_item.values())

                    for tuple in filtered_tuples:
                        add_link(graph_architecture, f"new_{node}", node_id, state_node_id, tuple[0], tuple[1], 'volatile' )
                        
            elif n_optimal_types == 3:
                state_centric_components.append(node_id)
                # sc dcs dcb
                # Creates a dcs and a state
                state_node_id = f"{node_id}_sc"
                add_component(graph_architecture, node_id, node_name, node_type, ic, oc, 'dcs')
                add_component(graph_architecture, state_node_id, node_name, node_type, ic, oc, 'sc')

                for out_id in optimal_types_links['dcb']:
                    persistent_links.append((node_id, out_id))
                out_links_processing = optimal_types_links['dcs']
                frequencies_dataItems = []
                for out_link_processing in out_links_processing:
                    edge = find_edge_between_nodes(graph_scenario, node_id, out_link_processing)
                    frequency = edge['frequency']
                    data_item = edge['dataItem']
                    frequencies_dataItems.append((frequency, data_item))

                min_freq_per_item = {}
                for freq, item in frequencies_dataItems:
                        if item not in min_freq_per_item or freq < min_freq_per_item[item][0]:
                            min_freq_per_item[item] = (freq, item)
                filtered_tuples = list(min_freq_per_item.values())

                for tuple in filtered_tuples:
                    add_link(graph_architecture, f"new_{node_id}", node_id, state_node_id, tuple[0], tuple[1], 'volatile' )


    # Check persistent edge
    # An edge outgoing from a producer is persistent if it's part of a path 
    # to a consumer with deliveryGuarantee = "at least" or "exactly".
    consumers = [n for n, d in graph_scenario.nodes(data=True) if d.get('type') in ['pull_c', 'push_c']]
    for consumer in consumers:
        consumer_attrs = graph_scenario.nodes[consumer]
        delivery = consumer_attrs.get('deliveryGuarantee', '').lower()
        
        # Check if this consumer requires persistence
        # Matches: "at least", "at least once", "exactly", "exactly once"
        if 'at least' in delivery or 'exactly' in delivery:
            # Find all producers that have a path to this consumer
            producers = [n for n, d in graph_scenario.nodes(data=True) if d.get('type') in ['active_p', 'passive_p']]
            print(f"DEBUG: Found {len(producers)} producers for consumer {consumer}")
            for producer in producers:
                # Check if there's a path from this producer to this consumer
                if nx.has_path(graph_scenario, producer, consumer):
                    # Find all paths and mark only the first edge in each path
                    for path in nx.all_simple_paths(graph_scenario, producer, consumer):
                        # Mark only the first edge (outgoing from producer) in this path
                        if len(path) >= 2:
                            edge = (path[0], path[1])
                            print(edge)
                            source_id = path[0]
                            target_id = path[1]
                            persistent_links.append((source_id, target_id))

                            # persistent_links.append(source_id, target_id)
                            print(f"DEBUG: Added persistent edge from delivery guarantee: {source_id} , {target_id}")
        
    # Creates Links
    for edge in json_scenario['edges']:
        edge_id = edge['id']
        source_id = edge['source']
        dest_id = edge['target']
        frequency = edge['data']['frequency']
        data_item = edge['data']['dataItem']

        optimal_types_for_source = get_optimal_types(json_dataflows, source_id)
        if 'sc' in optimal_types_for_source and dest_id in optimal_types_for_source['sc'] and len(optimal_types_for_source) > 1:
            start_id = f"{source_id}_sc"
        else:
            start_id = source_id

        print(f"start = {start_id}")

        # Check if the link must be persistent
        is_persistent_by_consumer_req = (source_id, dest_id) in persistent_links
        is_persistent_by_dcb_rule = False
        
        dest_node_in_arch = graph_architecture.nodes.get(dest_id)
        if dest_node_in_arch and dest_node_in_arch.get('optimalType') == 'dcb':
            if graph_architecture.nodes[start_id].get('optimalType') != 'sc':
                is_persistent_by_dcb_rule = True

        if is_persistent_by_consumer_req or is_persistent_by_dcb_rule:
            optimal_type = 'persistent'
        else:
            optimal_type = 'volatile'

        add_link(graph_architecture, edge_id, start_id, dest_id, frequency, data_item, optimal_type)
        print(f"link from {start_id} to {dest_id} added with optimal_type = {optimal_type}!")

    # Pull consumers without state have persistent links
    archit_consumers = [n for n, d in graph_architecture.nodes(data=True) if d.get('type') in ['pull_c', 'push_c']]
    for archit_consumer in archit_consumers:
        archit_consumer_attrs = graph_architecture.nodes[archit_consumer]
        if archit_consumer_attrs.get('type', '') == 'pull_c':
            for predecessor_id in graph_architecture.predecessors(archit_consumer):
                predecessor_node = graph_architecture.nodes.get(predecessor_id)
                if predecessor_node and predecessor_node.get("optimalType", '') != 'sc':
                    for key in graph_architecture.get_edge_data(predecessor_id, archit_consumer):
                        edge_attrs = graph_architecture.get_edge_data(predecessor_id, archit_consumer)[key]
                        edge_attrs['optimalType'] = 'persistent'

    # Passive producers have volatile output links
    archit_producers = [n for n, d in graph_architecture.nodes(data=True) if d.get('type') in ['active_p', 'passive_p']]
    for archit_producer in archit_producers:
        archit_producer_attrs = graph_architecture.nodes[archit_producer]

        if archit_producer_attrs.get('type', '') == 'passive_p':
            for successor_id in graph_architecture.successors(archit_producer):

                edge_attrs = graph_architecture.get_edge_data(archit_producer, successor_id)[key]
                optimal_type = edge_attrs['optimalType']
                print (f"prima = {edge_attrs['optimalType']}")
                edge_attrs['optimalType'] = 'volatile'
                print (f"dopo = {edge_attrs['optimalType']}")

    json = from_graph_architecture_to_json(graph_architecture)
    print(f"\n\n json = {json}")
    return json
    

# Returns a dictionary mapping each optimalDataType of the given node_id
# to the unique list of downstream target node IDs across all dataflows
def get_optimal_types(json_dataflows, node_id):
    consolidated = {}
    for flow in json_dataflows.get("dataflows", []):
        node_entry = next(
            (node for node in flow.get("nodes", []) if node.get("id") == node_id),
            None
        )
        if not node_entry:
            continue
        opt_type = node_entry.get("optimalDataType")
        following_nodes = [
            edge["target"]
            for edge in flow.get("edges", [])
            if edge.get("source") == node_id
        ]
        consolidated.setdefault(opt_type, set()).update(following_nodes)
    return {k: list(v) for k, v in consolidated.items()}

def consolidate_optimal_types(optimal_types):
    consolidated = {}
    for opt_type, node_ids in optimal_types:
        if opt_type not in consolidated:
            consolidated[opt_type] = set() 
        consolidated[opt_type].update(node_ids)
    for key in consolidated:
        consolidated[key] = list(consolidated[key])
    return consolidated







    

#########################################################################
# CREATE SINGLE DATA FLOWS RESULTS
#########################################################################

def analyze_scenario(scenario_json, K_sc_values=None, K_dc_b_values=None, K_rc_slice_values=None, K_dc_s_values=None):
    values = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], dtype=float)
    if K_sc_values is None:
        K_sc_values = values
    if K_dc_b_values is None:
        K_dc_b_values = values
    if K_rc_slice_values is None:
        K_rc_slice_values = values
    if K_dc_s_values is None:
        K_dc_s_values = values

    scenario_graph = json_to_graph_scenario(scenario_json)
    data_flow_graphs = scenario_decomposition(scenario_graph)

    data_flow_results = []
    for data_flow_graph in data_flow_graphs:
        data_flow_result = single_data_flow_analysis(data_flow_graph,  K_sc_values, K_dc_b_values, K_rc_slice_values, K_dc_s_values)
        data_flow_results.append(data_flow_result)
    
    return data_flow_results

#########################################################################
# 1. SCENARIO DECOMPOSITION PHASE
#########################################################################
def scenario_decomposition(scenario):
    data_flows = []
    consumer_ids = find_consumers(scenario)
    for consumer_id in consumer_ids: 
        data_flow = nx.ancestors(scenario, consumer_id) | {consumer_id}
        data_flows.append(scenario.subgraph(data_flow))
    return data_flows


#########################################################################
# 2. DATA FLOWS SEPARATE ANALYSIS
#########################################################################
def single_data_flow_analysis(data_flow_graph, K_sc_values, K_dc_b_values, K_rc_slice_values, K_dc_s_values):
    action_nodes = find_action_nodes(data_flow_graph)
    results = []

    # Add all nodes to the results list, distinguishing between action and non-action nodes
    for node_id, node_attr in data_flow_graph.nodes(data=True):
        if node_id in action_nodes:
            # This is an action node, it will be fully processed later
            continue
        else:
            # This is a producer or consumer
            results.append({
                'id': node_id,
                'name': node_attr.get('name', node_id),
                'type': node_attr.get('type'),
                'node_params': {},
                'K_sc_values': [],
                'K_dc_b_values': [],
                'K_rc_slice_values': [],
                'K_dc_s_values': [],
                'matrices': {},
            })

    for node_id in action_nodes:
        node_attr = data_flow_graph.nodes[node_id]
        # ensure required params
        ic = node_attr.get('inputCardinality', None)
        outc = node_attr.get('outputCardinality', None)
        if ic is None or outc is None:
            # skip nodes without cardinalities
            continue

        node_params = {
            'f_in': find_f_in(data_flow_graph, node_id),
            'f_out': find_f_out(data_flow_graph, node_id),
            'inputCardinality': ic,
            'outputCardinality': outc,
        }

        # For each K_dc_s value and each K_rc slice compute optimal matrix
        node_result = {
            'id': node_id,
            'name': node_attr.get('name', node_id),
            'type': node_attr.get('type'),
            'node_params': node_params,
            'K_sc_values': K_sc_values.tolist() if isinstance(K_sc_values, np.ndarray) else list(K_sc_values),
            'K_dc_b_values': K_dc_b_values.tolist() if isinstance(K_dc_b_values, np.ndarray) else list(K_dc_b_values),
            'K_rc_slice_values': K_rc_slice_values.tolist() if isinstance(K_rc_slice_values, np.ndarray) else list(K_rc_slice_values),
            'K_dc_s_values': list(K_dc_s_values),
            'matrices': {},  # keyed by K_dc_s index -> list of matrices per K_rc slice
        }

        for i_kdc_s, K_dc_s in enumerate(K_dc_s_values):
            # for each K_rc slice compute matrices
            matrices_for_s = []
            for K_rc in K_rc_slice_values:
                # compute optimal type matrix for this slice
                # store string labels among: 'sc','dcb','dcs'
                grid = np.empty((len(K_sc_values), len(K_dc_b_values)), dtype=object)
                for i, K_sc in enumerate(K_sc_values):
                    for j, K_dc_b in enumerate(K_dc_b_values):
                        c_sc, c_sc_c, c_dc_b, c_dc_s = calculate_costs(node_params, K_sc, K_dc_b, K_dc_s, K_rc)
                        # choose the minimal among the three main options (total sc, dcb, dcs)
                        vals = {'sc': c_sc, 'dcb': c_dc_b, 'dcs': c_dc_s}
                        
                        # Find minimum cost
                        min_cost = min(vals.values())
                        
                        # Find all options with the minimum cost (handles ties)
                        min_options = [k for k, v in vals.items() if v == min_cost]
                        
                        # In case of tie, prefer dcb for consistency
                        if len(min_options) > 1:
                            if 'dcb' in min_options:
                                best = 'dcb'
                            elif 'sc' in min_options:
                                best = 'sc'
                            else:
                                best = min_options[0]
                        else:
                            best = min_options[0]

                        grid[i, j] = best
                matrices_for_s.append(grid.tolist())
            node_result['matrices'][str(i_kdc_s)] = matrices_for_s

        results.append(node_result)

    # Determine uniform node types (nodes where all matrix values are the same)
    node_types = {}
    
    print(data_flow_graph.nodes())
    # First, add producer and consumer nodes to node_types
    for node_id in data_flow_graph.nodes():
        node_attrs = data_flow_graph.nodes[node_id]
        node_type = node_attrs.get('type')
        if node_type == 'active_p':
            node_types[node_id] = 'active_p'
        elif node_type == 'passive_p':
            node_types[node_id] = 'passive_p'
        elif node_type == 'consumer':
            node_types[node_id] = 'consumer'
    
    # Then, check analyzed nodes for uniform types
    for node_result in results:
        node_id = node_result['id']
        matrices_obj = node_result['matrices']
        
        # Collect all unique values across all matrices
        unique_values = set()
        for k_dc_s_index, matrices_list in matrices_obj.items():
            for matrix in matrices_list:
                for row in matrix:
                    for val in row:
                        unique_values.add(val)
        
        print(f"DEBUG: Node {node_id} has unique values: {unique_values}")
        
        # If only one unique value, this node has a uniform type
        if len(unique_values) == 1:
            node_types[node_id] = list(unique_values)[0]
            print(f"DEBUG: Node {node_id} is UNIFORM with type: {node_types[node_id]}")
    
    print(f"DEBUG: Final uniform node_types: {node_types}")
    
    return {
        'nodes': results,
    }
