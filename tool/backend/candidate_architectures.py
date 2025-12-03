import itertools
import copy
from analyze_scenario import combine_data_flows

def calculate_architecture_score(architecture):
    num_components = len(architecture.get('nodes', []))
    num_persistent_links = sum(1 for edge in architecture.get('edges', []) if edge.get('type') == 'persistent')
    score = 1000 - (num_components * 10) - (num_persistent_links * 50)
    return score

def analyze_candidates(data):
    OPTIMAL_TYPES = ['sc', 'dcb', 'dcs']
    scenario = data.get('scenario')
    original_dataflows_payload = data.get('dataflows', [])
    if not scenario:
        raise ValueError("Missing 'scenario' in the input data")
    # 1. Find all ambiguous nodes and their locations
    ambiguous_nodes_locs = []
    for i, dataflow in enumerate(original_dataflows_payload):
        for j, node in enumerate(dataflow.get('nodes', [])):
            if node.get('optimalDataType') == 'ambiguous':
                ambiguous_nodes_locs.append({'dataflow_index': i, 'node_index': j})
    
    num_ambiguous = len(ambiguous_nodes_locs)
    # If no ambiguous nodes, run combine_data_flows on the original data
    if num_ambiguous == 0:
        final_arch = combine_data_flows(scenario, data)
        final_arch['score'] = calculate_architecture_score(final_arch)
        # Ritorna una lista di architetture, come nel caso con ambiguità
        return [final_arch]
    # 2. Generate all combinations of optimal types
    all_combinations = itertools.product(OPTIMAL_TYPES, repeat=num_ambiguous)
    final_architectures = []
    # 3. For each combination, create a new resolved architecture and combine it
    for combination in all_combinations:
        # Create a deep copy to resolve ambiguities for this combination
        candidate_dataflows_payload = copy.deepcopy(original_dataflows_payload)
        
        # Apply the current combination to the ambiguous nodes
        for i, combo_type in enumerate(combination):
            loc = ambiguous_nodes_locs[i]
            df_idx = loc['dataflow_index']
            node_idx = loc['node_index']
            
            candidate_dataflows_payload[df_idx]['nodes'][node_idx]['optimalDataType'] = combo_type

        # This is the dataflow structure expected by combine_data_flows
        resolved_dataflow_for_combination = {"dataflows": candidate_dataflows_payload}
        
        # 4. Call combine_data_flows for the current candidate
        final_architecture = combine_data_flows(scenario, resolved_dataflow_for_combination)
        
        # 5. Calculate and add score
        final_architecture['score'] = calculate_architecture_score(final_architecture)
        
        final_architectures.append(final_architecture)
    
    return final_architectures
