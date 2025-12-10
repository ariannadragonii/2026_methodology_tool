import React, { useState, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Edge } from 'reactflow';

import ReactFlow, {
  Node,
  Connection,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './GraphEditor.css';

export type GraphEditorHandle = {
  downloadJSON: () => void;
  getGraphJSON: () => string;
  loadGraphFromJSON: (json: string) => void;
  openModalForType: (type: NodeType) => void;
  clearGraph: () => void;
  validateGraph: () => boolean;
};

type SerializedGraph = {
  nodes: Array<any>;
  edges: Array<any>;
};

type GraphEditorProps = {
  initialGraph?: SerializedGraph | null;
  readOnly?: boolean;
};

export type NodeType = 'active_p' | 'passive_p' | 'pull_c' | 'push_c' | 'merge' | 'processing';
type ModalType = NodeType | null;

type NodeData = {
  type: NodeType;
  name: string;
  deliveryGuarantee: 'at least' | 'at most' | 'exactly once' | null;
  inputCardinality: number | null;
  outputCardinality: number | null;
  stateCentricComputationCost: number | null;
  dataCentricComputationCost: number | null;
  stateCentricRetrievalCost: number | null;
  label: React.ReactElement;
  optimalDataType?: string | string[];
};

const generateUniqueId = () => `id_${Math.random().toString(36).substr(2, 9)}`;

const getTypeName = (type: NodeType) => {
  switch(type) {
    case 'active_p': return 'Active Producer';
    case 'passive_p': return 'Passive Producer';
    case 'pull_c': return 'Pull Consumer';
    case 'push_c': return 'Push Consumer';
    case 'merge': return 'Merge';
    case 'processing': return 'Processing';
    default: return 'Node';
  }
};

const createLabel = (data: NodeData): React.ReactElement => {
  const typeName = getTypeName(data.type);
  return (
    <div className="node-label">
      <strong>{typeName}: {data.name}</strong>
      <div className="details">
        {(data.type === 'pull_c' || data.type === 'push_c') && data.deliveryGuarantee && <div>Delivery: {data.deliveryGuarantee}</div>}
        {(data.type === 'merge' || data.type === 'processing') && (
          <>
            <div>Input Cardinality: {data.inputCardinality ?? '-'}</div>
            <div>Output Cardinality: {data.outputCardinality ?? '-'}</div>
          </>
        )}
      </div>
    </div>
  );
};

const createNode = (
  type: NodeType,
  id: string,
  name: string,
  deliveryGuarantee: 'at least' | 'at most' | 'exactly once' | null,
  inputCard: number | null,
  outputCard: number | null,
  stateCompCost: number | null,
  dataCompCost: number | null,
  stateRetCost: number | null
): Node<NodeData> => {
  const data: NodeData = {
    type,
    name,
    deliveryGuarantee,
    inputCardinality: inputCard,
    outputCardinality: outputCard,
    stateCentricComputationCost: stateCompCost,
    dataCentricComputationCost: dataCompCost,
    stateCentricRetrievalCost: stateRetCost,
    label: <></>,
  };
  data.label = createLabel(data);

  return {
    id,
    data,
    position: { x: Math.random() * 250 + 50, y: Math.random() * 250 + 50 },
    className: `react-flow__node-${type}`,
  };
};

const GraphEditor = forwardRef<GraphEditorHandle, GraphEditorProps>((props, ref) => {
  const { initialGraph = null, readOnly = false } = props;
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [modalType, setModalType] = useState<ModalType>(null);

  // Form state for nodes
  const [nodeName, setNodeName] = useState('');
  const [deliveryGuarantee, setDeliveryGuarantee] = useState<'at least' | 'at most' | 'exactly once' | null>(null);
  const [inputCardinality, setInputCardinality] = useState<number | null>(null);
  const [outputCardinality, setOutputCardinality] = useState<number | null>(null);
  const [stateCompCost, setStateCompCost] = useState<number | null>(null);
  const [dataCompCost, setDataCompCost] = useState<number | null>(null);
  const [stateRetCost, setStateRetCost] = useState<number | null>(null);

  const [showNodeModal, setShowNodeModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  // Edge modal state
  const [showEdgeModal, setShowEdgeModal] = useState(false);
  const [pendingEdge, setPendingEdge] = useState<Edge | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);

  // Edge form data
  const [edgePeriod, setEdgePeriod] = useState('');
  const [edgeDataItem, setEdgeDataItem] = useState<'structured' | 'unstructured' | 'semistructured' | ''>('');
  const [edgeErrorMessage, setEdgeErrorMessage] = useState('');

  const resetForm = () => {
    setNodeName('');
    setDeliveryGuarantee(null);
    setInputCardinality(null);
    setOutputCardinality(null);
    setStateCompCost(null);
    setDataCompCost(null);
    setStateRetCost(null);
    setErrorMessage('');
    setEditingNodeId(null);
  };

  const resetEdgeForm = () => {
    setEdgePeriod('');
    setEdgeDataItem('');
    setEditingEdgeId(null);
  };

  const openModalForType = (type: ModalType) => {
    resetForm();
    setModalType(type);
    setShowNodeModal(true);
  };

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node<NodeData>) => {
    setEditingNodeId(node.id);
    setModalType(node.data.type);
    setNodeName(node.data.name);
    setDeliveryGuarantee(node.data.deliveryGuarantee);
    setInputCardinality(node.data.inputCardinality);
    setOutputCardinality(node.data.outputCardinality);
    setShowNodeModal(true);
  }, []);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setEditingEdgeId(edge.id);
    setEdgePeriod(edge.data?.frequency?.toString() || '');
    setEdgeDataItem(edge.data?.dataItem || '');
    setPendingEdge(edge); 
    setShowEdgeModal(true);
  }, []);


  const clearGraph = useCallback(() => {
    const ok = window.confirm('Clear the graph? This will remove all nodes and edges.');
    if (!ok) return;
    setNodes([]);
    setEdges([]);
    setErrorMessage('');
    // Also clear from localStorage
    localStorage.removeItem('graph-editor-state');
  }, [setNodes, setEdges]);

  const closeNodeModal = () => {
    setShowNodeModal(false);
    resetForm();
  };

  const isNameUnique = (name: string) => {
    return !nodes.some((n) => n.data.name === name);
  };

  const handleNodeSubmit = () => {
    if (!modalType) return;

    if (!nodeName.trim()) {
      setErrorMessage('Name is required');
      return;
    }
    
    const isNameChanged = editingNodeId 
      ? nodes.find(n => n.id === editingNodeId)?.data.name !== nodeName.trim()
      : true;

    if (isNameChanged && !isNameUnique(nodeName.trim())) {
      setErrorMessage('Name must be unique');
      return;
    }

    if ((modalType === 'pull_c' || modalType === 'push_c') && !deliveryGuarantee) {
      setErrorMessage('You must choose a delivery guarantee');
      return;
    }

    if (editingNodeId) {
      setNodes((nds) => nds.map((node) => {
        if (node.id === editingNodeId) {
          const newData = {
            ...node.data,
            name: nodeName.trim(),
            deliveryGuarantee,
            inputCardinality,
            outputCardinality,
          };
          newData.label = createLabel(newData);
          return { ...node, data: newData };
        }
        return node;
      }));
    } else {
      let newNode: Node<NodeData>;

      switch (modalType) {
        case 'active_p':
        case 'passive_p':
          newNode = createNode(modalType, generateUniqueId(), nodeName.trim(), null, null, null, null, null, null);
          break;
        case 'pull_c':
        case 'push_c':
          newNode = createNode(modalType, generateUniqueId(), nodeName.trim(), deliveryGuarantee, null, null, null, null, null);
          break;
        case 'merge':
        case 'processing':
          newNode = createNode(
            modalType,
            generateUniqueId(),
            nodeName.trim(),
            null,
            inputCardinality,
            outputCardinality,
            null,
            null,
            null
          );
          break;
        default:
          return;
      }
      setNodes((nds) => [...nds, newNode]);
    }

    closeNodeModal();
  };

  const handleEdgeSubmit = () => {
    if (pendingEdge) {
      // validate data item type
      if (!edgeDataItem) {
        setEdgeErrorMessage("You must select the Data Item Type for the edge");
        return;
      }
      // validate period is present and a positive number
      const freqVal = Number(edgePeriod);
      if (edgePeriod === '' || Number.isNaN(freqVal) || freqVal < 0) {
        setEdgeErrorMessage('You must enter a valid Period (number >= 0)');
        return;
      }
      const labelText = `${edgePeriod || '-'} , ${edgeDataItem}`;
      
      if (editingEdgeId) {
        setEdges((eds) => eds.map((e) => {
          if (e.id === editingEdgeId) {
            return {
              ...e,
              data: {
                frequency: Number(edgePeriod),
                dataItem: edgeDataItem,
              },
              label: labelText,
            };
          }
          return e;
        }));
      } else {
        const newEdge: Edge = {
          ...pendingEdge,
          data: {
            // store frequency as a number in the edge data
            frequency: Number(edgePeriod),
            dataItem: edgeDataItem,
          },
          label: labelText,
          labelStyle: {
            fill: '#333',
            fontWeight: '500',
            fontSize: 12,
          },
          labelBgStyle: {
            fill: 'rgba(255, 255, 255, 0.9)',
            padding: '2px 4px',
            borderRadius: 4,
          }
        };
        setEdges((eds) => [...eds, newEdge]);
      }
      
      setPendingEdge(null);
      resetEdgeForm();
      setShowEdgeModal(false);
      setEdgeErrorMessage('');
    }
  };

  const loadGraphFromJSON = useCallback((json: string) => {
    try {
      console.debug('[GraphEditor] loadGraphFromJSON called');
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      console.debug('[GraphEditor] parsed JSON', parsed);
      const inNodes = parsed.nodes || [];
      const inEdges = parsed.edges || [];

      // Map incoming nodes to internal Node<NodeData> shape
      const loadedNodes = inNodes.map((n: any) => {
        const id = n.id || generateUniqueId();
        const type = n.type as NodeType;
        const name = n.name || '';
        const node = createNode(
          type,
          id,
          name,
          n.deliveryGuarantee ?? null,
          n.inputCardinality ?? null,
          n.outputCardinality ?? null,
          null,
          null,
          null
        );
        // keep provided position if available
        // if (n.position) node.position = n.position; // Force auto-layout
        return node;
      });

      // Compute deterministic positions so uploaded graphs display ordered
      // Group nodes: producers | actions (processing|merge) | consumers
      const producers = loadedNodes.filter((nd: any) => nd.data.type === 'active_p' || nd.data.type === 'passive_p');
      const actions = loadedNodes.filter((nd: any) => nd.data.type === 'processing' || nd.data.type === 'merge');
      const consumers = loadedNodes.filter((nd: any) => nd.data.type === 'pull_c' || nd.data.type === 'push_c');

      const spacingY = 150;
      const makePositions = (list: any[], xBase: number) => {
        return list.map((n: any, i: number) => ({
          id: n.id,
          position: { x: xBase, y: i * spacingY + 50 },
        }));
      };

      const pPos = makePositions(producers, 40);
      const aPos = makePositions(actions, 360);
      const cPos = makePositions(consumers, 680);

      const posMap: Record<string, { x: number; y: number }> = {};
      [...pPos, ...aPos, ...cPos].forEach((p) => { posMap[p.id] = p.position; });

      // Apply positions to loadedNodes
      loadedNodes.forEach((nd: any) => {
          const p = posMap[nd.id];
          if (p) nd.position = p;
      });

      const loadedEdges = inEdges.map((e: any) => {
        const data = e.data || {};
        const dataItem = data.dataItem || '';
        const frequency = data.frequency || '';
        const labelText = e.label ?? `${frequency || '-'} , ${dataItem || '-'}`;
        return ({
          id: e.id || generateUniqueId(),
          source: e.source,
          target: e.target,
          data,
          label: labelText,
          labelStyle: {
            fill: '#333',
            fontWeight: '500',
            fontSize: 12,
          },
          labelBgStyle: {
            fill: 'rgba(255, 255, 255, 0.9)',
            padding: '2px 4px',
            borderRadius: 4,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#007bff' },
        });
      });

      setNodes(loadedNodes as any);
      setEdges(loadedEdges as any);
      console.debug('[GraphEditor] loaded nodes:', loadedNodes.length, 'loaded edges:', loadedEdges.length);
      if ((loadedNodes?.length ?? 0) === 0) {
        setErrorMessage('Uploaded JSON contains no nodes');
      } else {
        setErrorMessage('');
      }
    } catch (err) {
      console.error('Failed to load graph JSON', err);
  setErrorMessage('Failed to load JSON: ' + ((err as any)?.message ?? String(err)));
    }
  }, [setNodes, setEdges]);

  const downloadJSON = () => {
    const jsonStr = exportGraphToJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graph-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getGraphJSON = () => {
    return exportGraphToJSON();
  };

  const validateGraph = useCallback(() => {
    for (const node of nodes) {
      const incoming = edges.filter(e => e.target === node.id);
      const outgoing = edges.filter(e => e.source === node.id);

      if (node.data.type === 'merge') {
        if (incoming.length < 2) {
          setErrorMessage(`Merge node "${node.data.name}" must have at least 2 incoming edges.`);
          return false;
        }
        if (outgoing.length < 1) {
          setErrorMessage(`Merge node "${node.data.name}" must have at least 1 outgoing edge.`);
          return false;
        }
      }
      
      if (node.data.type === 'processing') {
        if (incoming.length !== 1) {
          setErrorMessage(`Processing node "${node.data.name}" must have exactly 1 incoming edge.`);
          return false;
        }
        if (outgoing.length < 1) {
          setErrorMessage(`Processing node "${node.data.name}" must have at least 1 outgoing edge.`);
          return false;
        }
      }

      if (node.data.type === 'active_p' || node.data.type === 'passive_p') {
          if (outgoing.length < 1) {
              setErrorMessage(`Producer node "${node.data.name}" must have at least 1 outgoing edge.`);
              return false;
          }
      }

      if (node.data.type === 'pull_c' || node.data.type === 'push_c') {
          if (incoming.length < 1) {
              setErrorMessage(`Consumer node "${node.data.name}" must have at least 1 incoming edge.`);
              return false;
          }
      }
    }
    setErrorMessage('');
    return true;
  }, [nodes, edges]);

  useImperativeHandle(ref, () => ({
    downloadJSON,
    getGraphJSON,
    loadGraphFromJSON,
    openModalForType,
    clearGraph,
    validateGraph,
  }));

  useEffect(() => {
    if (initialGraph) {
      try {
        loadGraphFromJSON(initialGraph as any);
      } catch (err) {
        // ignore
      }
    } else {
      // Try to load from localStorage if no initialGraph is provided
      const savedGraph = localStorage.getItem('graph-editor-state');
      if (savedGraph) {
        try {
          loadGraphFromJSON(savedGraph);
        } catch (err) {
          console.error('Failed to load saved graph from localStorage', err);
        }
      }
    }
  }, [initialGraph, loadGraphFromJSON]);

  // Save graph to localStorage whenever nodes or edges change
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      try {
        const graphState = getGraphJSON();
        localStorage.setItem('graph-editor-state', graphState);
      } catch (err) {
        console.error('Failed to save graph to localStorage', err);
      }
    }
  }, [nodes, edges, getGraphJSON]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.target || !connection.source) return;

      const targetNode = nodes.find((n) => n.id === connection.target);
      const sourceNode = nodes.find((n) => n.id === connection.source);
      if (!targetNode || !sourceNode) return;

      const targetInEdges = edges.filter((e) => e.target === targetNode.id).length + 1;

      if (targetNode.data.type === 'active_p' || targetNode.data.type === 'passive_p') {
        setErrorMessage('Producer nodes cannot have incoming edges.');
        return;
      }

      if (targetNode.data.type === 'processing' && targetInEdges > 1) {
        setErrorMessage('Processing nodes can have at most one incoming edge.');
        return;
      }

      if (sourceNode.data.type === 'pull_c' || sourceNode.data.type === 'push_c') {
        setErrorMessage('Consumer nodes cannot have outgoing edges.');
        return;
      }

      if (targetNode.data.type === 'merge') {
        if (targetInEdges < 2) {
          setErrorMessage(`Merge node has ${targetInEdges} incoming edge(s), but requires at least 2.`);
        } else {
          setErrorMessage('');
        }
      } else {
        setErrorMessage('');
      }

      setPendingEdge({
        id: generateUniqueId(),
        ...connection,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#007bff' },
      } as Edge);
      resetEdgeForm();
      setShowEdgeModal(true);
    },
    [edges, nodes]
  );

  const exportGraphToJSON = () => {
    const serialized = {
      nodes: nodes.map((n) => {
        const base = {
          id: n.id,
          type: n.data.type,
          name: n.data.name,
        };
        switch (n.data.type) {
          case 'pull_c':
          case 'push_c':
            return {
              ...base,
              deliveryGuarantee: n.data.deliveryGuarantee,
            };
          case 'merge':
          case 'processing':
            return {
              ...base,
              inputCardinality: n.data.inputCardinality,
              outputCardinality: n.data.outputCardinality,
            };
          case 'active_p':
          case 'passive_p':
          default:
            return base;
        }
      }),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: ((): any => {
          if (!e.data) return e.data;
          const copy = { ...e.data } as any;
          if (copy.frequency !== undefined && copy.frequency !== null) {
            const num = Number(copy.frequency);
            copy.frequency = Number.isNaN(num) ? copy.frequency : num;
          }
          return copy;
        })(),
      })),
    };

    return JSON.stringify(serialized, null, 2);
  };

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {errorMessage && (
        <div className="error-message" role="alert">
          {errorMessage}
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={onEdgeClick}
        fitView
        attributionPosition="bottom-left"
        connectionLineStyle={{ stroke: '#007bff', strokeWidth: 2 }}
        snapToGrid={true}
        snapGrid={[20, 20]}
        style={{ background: '#f8f9fa' }}
      >
        <div className="react-flow__attribution">Graph Editor</div>
      </ReactFlow>

      {showNodeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingNodeId ? 'Edit' : 'Add'} {modalType ? getTypeName(modalType) : ''} Node</h3>
            <div className="form-group">
              <label>Name:</label>
              <input type="text" value={nodeName} onChange={(e) => setNodeName(e.target.value)} />
            </div>

            {(modalType === 'pull_c' || modalType === 'push_c') && (
              <div className="form-group">
                <label>Delivery Guarantee:</label>
                <select
                  value={deliveryGuarantee ?? ''}
                  onChange={(e) =>
                    setDeliveryGuarantee(
                      e.target.value === '' ? null : (e.target.value as 'at least' | 'at most' | 'exactly once')
                    )
                  }
                >
                  <option value="">-- Select --</option>
                  <option value="at least">At least once</option>
                  <option value="at most">At most once</option>
                  <option value="exactly once">Exactly once</option>
                </select>
              </div>
            )}

            {(modalType === 'merge' || modalType === 'processing') && (
              <>
                <div className="form-group">
                  <label>Input Cardinality:</label>
                  <input
                    type="number"
                    value={inputCardinality ?? ''}
                    onChange={(e) => setInputCardinality(e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div className="form-group">
                  <label>Output Cardinality:</label>
                  <input
                    type="number"
                    value={outputCardinality ?? ''}
                    onChange={(e) => setOutputCardinality(e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              </>
            )}

            {errorMessage && <div className="modal-error">{errorMessage}</div>}

            <div className="modal-actions">
              <button onClick={handleNodeSubmit} className="primary">Save</button>
              <button onClick={closeNodeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showEdgeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingEdgeId ? 'Edit' : 'Add'} Edge Data</h3>
            <div className="form-group">
              <label>Period:</label>
              <input
                type="text"
                value={edgePeriod}
                onChange={(e) => setEdgePeriod(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Data Item Type:</label>
              <select
                value={edgeDataItem}
                onChange={(e) => setEdgeDataItem(e.target.value as 'structured' | 'unstructured' | 'semistructured' | '')}
              >
                <option value="">-- Select --</option>
                <option value="structured">Structured</option>
                <option value="unstructured">Unstructured</option>
                <option value="semistructured">Semi-structured</option>
              </select>
            </div>

            <div className="modal-actions">
              {edgeErrorMessage && <div className="modal-error" style={{ marginBottom: 8 }}>{edgeErrorMessage}</div>}
              <button onClick={handleEdgeSubmit} className="primary">Save</button>
              <button
                onClick={() => {
                  setPendingEdge(null);
                  resetEdgeForm();
                  setShowEdgeModal(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default GraphEditor;