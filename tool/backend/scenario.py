import json
import networkx as nx

# --- Valori di default per i coefficienti di costo ---
DEFAULT_K_SC = 1.0
DEFAULT_K_DC_B = 1.0
DEFAULT_K_DC_S = 1.0
DEFAULT_K_RC = 1.0


####################################################################################################
# Scenario Transaltion Functions - From Json to Graph (AGGIORNATA per i coefficienti)
####################################################################################################

# Creates a graph of a scenario starting from a json
def json_to_graph_scenario(json_scenario):

    scenario = create_new_scenario()

    for node in json_scenario["nodes"]:
        node_id = node["id"]         
        node_type = node["type"]

        if node_type == "active_p":
            add_active_producer(scenario, node_id)
        
        elif node_type == "passive_p":
            add_passive_producer(scenario, node_id)

        elif node_type == "pull_c":
            delivery = node.get("deliveryGuarantee", "")
            add_pull_consumer(scenario, node_id, delivery)
        
        elif node_type == "push_c":
            delivery = node.get("deliveryGuarantee", "")
            add_push_consumer(scenario, node_id, delivery)

        elif node_type in ("processing", "merge"):
            # Leggi i coefficienti dal JSON o usa i default se null/non presenti
            cc_sc_coeff = node.get("cc_sc_coeff", DEFAULT_K_SC)
            if cc_sc_coeff is None: cc_sc_coeff = DEFAULT_K_SC

            cc_dc_b_coeff = node.get("cc_dc_b_coeff", DEFAULT_K_DC_B)
            if cc_dc_b_coeff is None: cc_dc_b_coeff = DEFAULT_K_DC_B

            cc_dc_s_coeff = node.get("cc_dc_s_coeff", DEFAULT_K_DC_S)
            if cc_dc_s_coeff is None: cc_dc_s_coeff = DEFAULT_K_DC_S
            
            rc_coeff = node.get("rc_coeff", DEFAULT_K_RC)
            if rc_coeff is None: rc_coeff = DEFAULT_K_RC

            add_internal_node(
                scenario,
                node_id, 
                node_type,
                node.get("inputCardinality"),
                node.get("outputCardinality"),
                cc_sc_coeff=cc_sc_coeff,
                cc_dc_b_coeff=cc_dc_b_coeff,
                cc_dc_s_coeff=cc_dc_s_coeff,
                rc_coeff=rc_coeff
            )

    for edge in json_scenario["edges"]:
        source = edge["source"]    # ID del nodo sorgente
        target = edge["target"]    # ID del nodo destinazione
        frequency = edge["data"].get("frequency", "")
        dataItem = edge["data"].get("dataItem", "")
        add_edge(scenario, source, target, frequency, dataItem)

    return scenario



####################################################################################################
# Scenario Graph Lookup Functions
####################################################################################################

# returns producers of a graph
def find_producers(graph):
    producers = [node for node in graph.nodes if not list(graph.predecessors(node))]
    return producers

# returns consumers of a graph
def find_consumers(graph):
    consumers = [node for node in graph.nodes if not list(graph.successors(node))]
    return consumers

# returns internal nodes of a graph
def find_action_nodes(graph):
    return [node for node in graph.nodes if node not in find_consumers(graph) + find_producers(graph)]

# returns input frequency of a node in a graph
def find_f_in(graph, node_id): 
    preds = list(graph.predecessors(node_id))
    f_ins = []
    f_in = 0
    for pred in preds:
        f_ins.append(graph[pred][node_id]['frequency'])
        f_in = max(f_ins)
    return 1/f_in

# returns output frequency of a node in a graph
def find_f_out(graph, node_id):
    succs = list(graph.successors(node_id))
    f_outs = []
    f_out = 0
    for succ in succs:
        f_outs.append(graph[node_id][succ]['frequency'])
        f_out = max(f_outs)
    return 1/f_out

# Ritorna l'edge tra due nodi se esiste
def find_edge_between_nodes(graph, source_id, target_id):
    """
    Restituisce l'edge tra source_id e target_id se esiste, altrimenti None.
    """
    if graph.has_edge(source_id, target_id):
        return graph[source_id][target_id]
    else:
        return None

# Ritorna tutti gli archi uscenti da un nodo
def find_outgoing_edges(graph, node_id):
    """
    Restituisce una lista di tuple (target_id, edge_attr) per tutti gli archi uscenti da node_id.
    """
    return [(succ, graph[node_id][succ]) for succ in graph.successors(node_id)]
    



####################################################################################################
# Scenario Graph Managing Functions
####################################################################################################

# Creates a new graph for the scenario
def create_new_scenario():
    scenario = nx.DiGraph()
    return scenario 

def add_active_producer(scenario, producer_name):
    add_producer(scenario, producer_name, 'active')

def add_passive_producer(scenario, producer_name):
    add_producer(scenario, producer_name, 'passive')

# Adds a producer to a scenario
def add_producer(scenario, producer_name, type):
    scenario.add_node(
        producer_name, 
        type = f'{type}_p'
        )

def add_push_consumer(scenario, consumer_name, delivery_guarantee):
    add_consumer(scenario, consumer_name, delivery_guarantee, 'push')

def add_pull_consumer(scenario, consumer_name, delivery_guarantee):
    add_consumer(scenario, consumer_name, delivery_guarantee, 'pull')

# Adds a consumer to a scenario
def add_consumer(scenario, consumer_name, delivery_guarantee, type):
    scenario.add_node(
        consumer_name, 
        type = f'{type}_c', 
        deliveryGuarantee = delivery_guarantee
        )

# Adds an internal node to a scenario (AGGIORNATA per i coefficienti)
def add_internal_node(scenario, node_name, node_type, input_cardinality, output_cardinality, 
                      cc_sc_coeff=DEFAULT_K_SC, cc_dc_b_coeff=DEFAULT_K_DC_B, cc_dc_s_coeff=DEFAULT_K_DC_S, rc_coeff=DEFAULT_K_RC):
    scenario.add_node(
        node_name, 
        type = node_type , 
        inputCardinality = input_cardinality , 
        outputCardinality = output_cardinality , 
        cc_sc_coeff = cc_sc_coeff , # Nuovi attributi
        cc_dc_b_coeff = cc_dc_b_coeff ,
        cc_dc_s_coeff = cc_dc_s_coeff ,
        rc_coeff = rc_coeff
        )



# Adds an edge to a scenario
def add_edge(scenario, left_node, right_node, frequency, dataItem):
    scenario.add_edge(
        left_node, 
        right_node, 
        frequency = frequency, 
        dataItem = dataItem
        ) 








