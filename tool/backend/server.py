
from flask import Flask, request, jsonify
from analyze_scenario import analyze_scenario, evaluate_node_at_point, combine_data_flows
from scenario import json_to_graph_scenario, find_action_nodes
from candidate_architectures import analyze_candidates
import traceback

app = Flask(__name__)

@app.route('/candidate-architectures', methods=['POST'])
def candidate_architectures():
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({'error': 'Missing data'}), 400
        
        # analyze_candidates ora restituisce una lista di architetture, ciascuna con uno score
        architectures_with_scores = analyze_candidates(data)

        # Ordina i risultati per 'score' in ordine decrescente (dal più probabile al meno probabile)
        sorted_architectures = sorted(architectures_with_scores, key=lambda item: item.get('score', -1), reverse=True)
        
        return jsonify({"candidate_architectures": sorted_architectures})
    except Exception as e:
        tb = traceback.format_exc()
        return jsonify({'error': 'Candidate architecture analysis failed', 'detail': str(e), 'traceback': tb}), 500

# --- Nuova route per la final architecture ---
@app.route('/final-architecture', methods=['POST'])
def final_architecture():
    try:
        data = request.get_json(force=True)
        scenario = data.get('scenario')
        dataflow = data.get('dataflow')
        if not scenario or not dataflow:
            return jsonify({'error': 'Missing scenario or dataflow'}), 400
        result = combine_data_flows(scenario, dataflow)
        return jsonify(result)
    except Exception as e:
        tb = traceback.format_exc()
        return jsonify({'error': 'Final architecture failed', 'detail': str(e), 'traceback': tb}), 500



@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        scenario_json = request.get_json(force=True)
    except Exception as e:
        return jsonify({'error': 'Invalid JSON', 'detail': str(e)}), 400

    # Run the scenario analysis (precomputes matrices for a few K_dc_s values)
    try:
        result = analyze_scenario(scenario_json)
    except Exception as e:
        tb = traceback.format_exc()
        # log to server stdout
        print('Analysis exception:\n', tb)
        return jsonify({'error': 'Analysis failed', 'detail': str(e), 'traceback': tb}), 500

    return jsonify(result)


@app.route('/evaluate_point', methods=['POST'])
def evaluate_point():
    """
    Evaluate optimal type at a specific point for a given node.
    
    Expected JSON:
    {
        "node_params": {
            "f_in": float,
            "f_out": float,
            "inputCardinality": int,
            "outputCardinality": int
        },
        "K_sc": float,
        "K_dc_b": float,
        "K_rc": float,
        "K_dc_s": float
    }
    
    Returns:
    {
        "type": "sc" | "dcb" | "dcs",
        "label": "Human readable label"
    }
    """
    try:
        data = request.get_json(force=True)
        node_params = data['node_params']
        K_sc = float(data['K_sc'])
        K_dc_b = float(data['K_dc_b'])
        K_rc = float(data['K_rc'])
        K_dc_s = float(data['K_dc_s'])
        
        result = evaluate_node_at_point(node_params, K_sc, K_dc_b, K_rc, K_dc_s)
        return jsonify(result)
    except Exception as e:
        tb = traceback.format_exc()
        print('Evaluate point exception:\n', tb)
        return jsonify({'error': 'Evaluation failed', 'detail': str(e), 'traceback': tb}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
