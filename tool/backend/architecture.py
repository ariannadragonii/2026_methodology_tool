
import networkx as nx
from scenario import add_producer, add_consumer
####################################################################################################
# Architecture Graph Lookup Functions
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
def find_components_nodes(graph):
    return [node for node in graph.nodes if node not in find_consumers(graph) + find_producers(graph)]



####################################################################################################
# Architecture Graph Managing Functions
####################################################################################################

# Creates a new graph for the architecture
def create_new_architecture():
    architecture = nx.MultiDiGraph()
    return architecture

def add_architecture_active_producer(architecture, node_id, producer_name):
    add_architecture_producer(architecture, node_id, producer_name, 'active')

def add_architecture_passive_producer(architecture, node_id, producer_name):
    add_architecture_producer(architecture, node_id, producer_name, 'passive')

# Adds a producer to a architecture
def add_architecture_producer(architecture, node_id, producer_name, type):
    architecture.add_node(
        node_id,
        name = producer_name, 
        type = f'{type}_p'
        )

def add_architecture_pull_consumer(architecture, node_id, consumer_name, delivery_guarantee):
    add_architecture_consumer(architecture, node_id, consumer_name, delivery_guarantee, 'pull')

def add_architecture_push_consumer(architecture, node_id, consumer_name, delivery_guarantee):
    add_architecture_consumer(architecture, node_id, consumer_name, delivery_guarantee, 'push')

# Adds a consumer to a architecture
def add_architecture_consumer(architecture, node_id, consumer_name, delivery_guarantee, type):
    architecture.add_node(
        node_id,
        name = consumer_name, 
        type = f'{type}_c', 
        deliveryGuarantee = delivery_guarantee
        )

# Adds a component to an architecture
def add_component(architecture, node_id, node_name, node_type, input_cardinality, output_cardinality, optimal_type):
    architecture.add_node(
        node_id,
        name = node_name, 
        type = node_type , 
        inputCardinality = input_cardinality , 
        outputCardinality = output_cardinality , 
        optimalType = optimal_type
        )
    

# Adds a link to a architecture
def add_link(scenario, id, left_node, right_node, frequency, dataItem, optimal_type):
    scenario.add_edge(
        left_node,
        right_node, 
        frequency = frequency, 
        dataItem = dataItem, 
        optimalType = optimal_type
        ) 

# Creates the json of an architecture
def from_graph_architecture_to_json(graph_architecture):
        nodes = []
        for node_id, attrs in graph_architecture.nodes(data=True):
            node_json = {
                "id": node_id,
                "name": attrs.get("name", node_id),
                "type": attrs.get("type"),
                "inputCardinality": attrs.get("inputCardinality"),
                "outputCardinality": attrs.get("outputCardinality"),
                "optimalType": attrs.get("optimalType"),
                "deliveryGuarantee": attrs.get("deliveryGuarantee")
            }
            nodes.append(node_json)

        edges = []
        for u, v, key, attrs in graph_architecture.edges(keys=True, data=True):
            edge_json = {
                "id": f"edge_{u}_{v}_{key}",
                "source": u,
                "target": v,
                "type": attrs.get("optimalType", "volatile"),
                "data": {
                    "frequency": attrs.get("frequency"),
                    "dataItem": attrs.get("dataItem")
                }
            }
            print(f"\nadded edge {edge_json}\n")
            edges.append(edge_json)

        return {"nodes": nodes, "edges": edges}
    