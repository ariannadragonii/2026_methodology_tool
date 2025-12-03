import PublicationFigure from './PublicationFigure';
import React, { useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactFlow, { MiniMap, Controls, Background, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
// import Plotly component (require used to avoid missing type declarations in this project)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const _plotModule = require('react-plotly.js');
const Plot = (_plotModule && _plotModule.default) ? _plotModule.default : _plotModule;

const Legend: React.FC = () => (
  <div style={{ borderBottom: '1px solid #eee', paddingBottom: 12, marginBottom: 12, textAlign: 'center' }}>
    <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 22, height: 14, background: '#FAD105', border: '1px solid #888' }} />
        <div>State-Centric</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 22, height: 14, background: '#59c7f3', border: '1px solid #888' }} />
        <div>Data-Centric - Batch</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 22, height: 14, background: '#0490c8', border: '1px solid #888' }} />
        <div>Data-Centric - Stream</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 22, height: 14, background: '#E7E7E4', border: '1px solid #888' }} />
        <div>Non-uniform</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 22, height: 14, background: '#CCCCCC', border: '1px solid #888' }} />
        <div>Producer / Consumer</div>
      </div>
    </div>
  </div>
);



const GraphDisplay: React.FC<{ 
  analysis: any; 
  graph: any; 
  title: string;
  manualNodeColors: Record<string, string>;
  setManualNodeColor: (nodeId: string, color: string) => void;
}> = ({ analysis, graph, title, manualNodeColors, setManualNodeColor }) => {

  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);
  const [isPublicationViewOpen, setPublicationViewOpen] = useState(false);
  const [isRangeAnalysisViewOpen, setRangeAnalysisViewOpen] = useState(false);
  const [rangeAnalysisResult, setRangeAnalysisResult] = useState('');
  const [selectedKrcIndex, setSelectedKrcIndex] = useState(1); // default to index 1 for K_rc slider
  const [selectedKscIndex, setSelectedKscIndex] = useState<'all' | number>('all');
  // View mode: '3d' shows all three axes, '2d-fix-*' fixes one axis and shows 2D surface
  const [viewMode, setViewMode] = useState<'3d' | '2d-fix-ksc' | '2d-fix-kdcb' | '2d-fix-kdcs'>('3d');
  const [fixedKscValue, setFixedKscValue] = useState(0); // index for fixed K_sc in 2D view
  const [fixedKdcbValue, setFixedKdcbValue] = useState(0); // index for fixed K_dc_b in 2D view
  const [fixedKdcsValue, setFixedKdcsValue] = useState(0); // index for fixed K_dc_s in 2D view
  // fixed K values UI (for quick evaluation of a single point)
  const [fixedK_sc, setFixedK_sc] = useState<number | ''>('');
  const [fixedK_dc_b, setFixedK_dc_b] = useState<number | ''>('');
  const [fixedK_rc, setFixedK_rc] = useState<number | ''>('');
  const [fixedK_dc_s, setFixedK_dc_s] = useState<number | ''>('');
  const [fixedResult, setFixedResult] = useState<{ label: string; code: string } | null>(null);
  // track manually assigned node colors: nodeId -> color code (sc, dcb, dcs)
  // const [manualNodeColors, setManualNodeColors] = useState<Record<string, string>>({});

  const analysisNodes = analysis?.nodes ?? [];

  // currentNode is only set when a node is explicitly selected (click on non-uniform node)
  const currentNode = selectedNodeIndex !== null ? analysisNodes[selectedNodeIndex] : null;

  // when opening/selecting a node, seed fixed K inputs from the node's available arrays (first element)
  React.useEffect(() => {
    if (!currentNode) {
      setFixedK_sc(''); setFixedK_dc_b(''); setFixedK_rc(''); setFixedK_dc_s(''); setFixedResult(null);
      return;
    }
    const tryFirst = (arr: any[]) => (Array.isArray(arr) && arr.length ? Number(arr[0]) : '');
    setFixedK_sc(tryFirst(currentNode.K_sc_values));
    setFixedK_dc_b(tryFirst(currentNode.K_dc_b_values));
    setFixedK_rc(tryFirst(currentNode.K_rc_slice_values));
    setFixedK_dc_s(tryFirst(currentNode.K_dc_s_values));
    setFixedResult(null);
  }, [currentNode]);

  // (critical nodes computation removed — not used in this layout)

  // map node id -> { isUniform: boolean, value: string | null }
  const nodeUniformInfo = React.useMemo(() => {
    const map: Record<string, { isUniform: boolean; value: string | null }> = {};
    if (!analysisNodes) return map;
    analysisNodes.forEach((n: any) => {
      const uniq = new Set<string>();
      const matsObj = n.matrices || {};
      Object.values(matsObj).forEach((matList: any) => {
        if (!Array.isArray(matList)) return;
        matList.forEach((mat: any) => {
          if (!Array.isArray(mat)) return;
          for (let i = 0; i < mat.length; i++) {
            const row = mat[i];
            if (!Array.isArray(row)) continue;
            for (let j = 0; j < row.length; j++) {
              uniq.add(String(row[j]));
            }
          }
        });
      });
      if (uniq.size === 1) {
        map[n.id] = { isUniform: true, value: Array.from(uniq)[0] };
      } else {
        map[n.id] = { isUniform: false, value: null };
      }
    });
    return map;
  }, [analysisNodes]);

  // Build ReactFlow nodes/edges from provided graph
  const flowNodes = React.useMemo(() => {
    if (!graph || !graph.nodes) return [];
    // group nodes by type to produce a deterministic left-to-right layout: producers | actions | consumers
    const producers = graph.nodes.filter((x: any) => x.type === 'active_p' || x.type === 'reactive_p');
    const actions = graph.nodes.filter((x: any) => x.type === 'processing' || x.type === 'merge');
    const consumers = graph.nodes.filter((x: any) => x.type === 'pull_c' || x.type === 'push_c');

    const spacingY = 80;
    const makePositions = (list: any[], xBase: number) => {
      const total = list.length;
      return list.map((n: any, i: number) => {
        // Build label with name and cardinalities if available
        let label = n.name ?? n.id;
        if (n.type === 'active_p') {
          label = `${label}\n(Active)`;
        } else if (n.type === 'reactive_p') {
          label = `${label}\n(Reactive)`;
        } else if (n.type === 'pull_c') {
          label = `${label}\n(Pull)`;
        } else if (n.type === 'push_c') {
          label = `${label}\n(Push)`;
        } else if (n.inputCardinality !== undefined || n.outputCardinality !== undefined) {
          const ic = n.inputCardinality ?? '-';
          const oc = n.outputCardinality ?? '-';
          label = `${label}\n(${ic}, ${oc})`;
        }
        
        return {
          id: n.id,
          position: { x: xBase, y: (i - (total - 1) / 2) * spacingY + 130 },
          data: { label },
          original: n,
        };
      });
    };

    const pPos = makePositions(producers, 40);
    const aPos = makePositions(actions, 360);
    const cPos = makePositions(consumers, 680);

    const all = [...pPos, ...aPos, ...cPos];

    // map to ReactFlow node format and style based on uniformity
    return all.map((item: any) => { 
      const n = item.original;
      const info = nodeUniformInfo[n.id] || { isUniform: false, value: null };
      const PALETTE = {
        stream: '#0490c8',
        batch: '#59c7f3',
        state: '#FAD105',
        nonUniform: '#E7E7E4',
        prodCons: '#CCCCCC',
      };

      // Check if this node has a manually assigned color
      const manualColor = manualNodeColors[n.id];
      
      let bg = PALETTE.nonUniform;
      
      // If manually assigned, use that color
      if (manualColor) {
        if (manualColor === 'sc') bg = PALETTE.state;
        else if (manualColor === 'dcb') bg = PALETTE.batch;
        else if (manualColor === 'dcs') bg = PALETTE.stream;
      }
      // Otherwise use the computed uniform info
      else if (info.isUniform && info.value) {
        if (info.value === 'sc') bg = PALETTE.state;
        else if (info.value === 'dcb') bg = PALETTE.batch;
        else if (info.value === 'dcs') bg = PALETTE.stream;
      }
      
      const color = '#000';
      // producers and consumers should always be prod/cons color regardless of uniformity
      if (n.type === 'active_p' || n.type === 'reactive_p' || n.type === 'pull_c' || n.type === 'push_c') {
        bg = PALETTE.prodCons;
      }
      // set a CSS variable so we can override any !important rules coming from global CSS
      return {
        id: item.id,
        data: item.data,
        position: item.position,
        draggable: true,
        style: { ['--node-bg' as any]: bg, color, border: '1px solid #888', width: 140 },
      };
    });
  }, [graph, nodeUniformInfo, manualNodeColors]);

  const flowEdges = React.useMemo(() => {
    if (!graph || !graph.edges) return [];
    
    return graph.edges.map((e: any) => {
      const edgeKey = `${e.source}-${e.target}`;
      
      return {
        id: e.id || edgeKey,
        source: e.source,
        target: e.target,
        label: `${e.data?.frequency ?? '-'} , ${e.data?.dataItem ?? '-'}`,
        labelBgStyle: { fill: 'rgba(255,255,255,0.8)', padding: 2 },
        style: {
          strokeWidth: 1,
          stroke: '#b1b1b7',
        },
      };
    });
  }, [graph]);

  // Use ReactFlow hooks for managing nodes and edges state
  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Update nodes and edges when flowNodes or flowEdges change
  React.useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  React.useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  const onNodeClick = useCallback((evt: any, node: any) => {
    if (!analysisNodes) return;
    const idx = analysisNodes.findIndex((n: any) => n.id === node.id);
    if (idx >= 0) {
      // Check if this is a producer or consumer node (skip opening surface for these)
      const graphNode = graph?.nodes?.find((gn: any) => gn.id === node.id);
      if (graphNode && (graphNode.type === 'active_p' || graphNode.type === 'reactive_p' || graphNode.type === 'pull_c' || graphNode.type === 'push_c')) {
        return; // Don't open surface view for producers/consumers
      }
      // Open surface view for any action/processing node
      setSelectedNodeIndex(idx);
      setSelectedKscIndex('all');
    }
  }, [analysisNodes, graph]);

  const plotData = useMemo(() => {
    if (!currentNode) return [];
    const K_sc = currentNode.K_sc_values;
    const K_dc_b = currentNode.K_dc_b_values;
    const K_rc_slices = currentNode.K_rc_slice_values;
    const K_dc_s_values = currentNode.K_dc_s_values;
    
    // map string type codes to numeric values for Plotly coloring.
    const typeToNum: Record<string, number> = { sc: 0, dcs: 1, dcb: 2 };
    
    // Map type codes to readable labels for hover
    const typeLabels: Record<string, string> = {
      sc: 'State-Centric',
      dcs: 'Data-Centric (Stream)',
      dcb: 'Data-Centric (Batch)'
    };
    
    // Completely discrete colorscale - each value gets exactly its color
    // With values 0, 1, 2 normalized to range [0,1]: 0→0.0, 1→0.5, 2→1.0
    // Use step function approach: each color spans exactly 1/3 of the range
    const colorscale = [
      [0.0, '#FAD105'],        // State-Centric (value 0)
      [0.333, '#FAD105'],
      [0.333, '#0490c8'], // Stream (value 1)
      [0.666, '#0490c8'],
      [0.666, '#59c7f3'], // Batch (value 2)
      [1.0, '#59c7f3'],
    ];

    const traces: any[] = [];
    
    // Fix K_rc to selectedKrcIndex (slider)
    const krcIdx = selectedKrcIndex;
    
    // Handle different view modes
    if (viewMode === '3d') {
      // Original 3D view: show all K_sc layers
      // Build a 3D surface: for fixed K_rc, show grid of K_dc_s (x) × K_dc_b (y) at different K_sc heights (z)
      // Data structure: matrices[kdcsIdx][krcIdx][kscIdx][kdcbIdx]
      
      if (selectedKscIndex === 'all') {
        // Create multiple separate surfaces, one for each K_sc layer
        // This allows each layer to be independently colored and positioned
        
        K_sc.forEach((K_sc_val: number, kscIdx: number) => {
          // Correctly build gridData[dcbIdx][kdcsIdx]
          // This ensures rows are K_dc_b (Y) and columns are K_dc_s (X)
          const gridData = K_dc_b.map((_: any, dcbIdx: number) => {
            return K_dc_s_values.map((_: any, kdcsIdx: number) => {
              return currentNode.matrices[String(kdcsIdx)][krcIdx][kscIdx][dcbIdx];
            });
          });
          
          // Convert type codes to numbers
          const surfaceColor = gridData.map((row: string[]) => row.map((v: string) => (typeToNum[String(v)] ?? NaN)));
          
          // Create Z grid where all points have the same K_sc value (this layer's height)
          const zHeight = gridData.map(() => K_dc_s_values.map(() => K_sc_val));
          
          // Create hover text
          const hoverText = gridData.map((row: string[], dcbIdx: number) => row.map((typeCode: string, kdcsIdx: number) => `K_dc_s: ${K_dc_s_values[kdcsIdx]}<br>K_dc_b: ${K_dc_b[dcbIdx]}<br>K_sc: ${K_sc_val}<br>Type: ${typeLabels[typeCode] || typeCode}`));
          
          traces.push({
            type: 'surface',
            x: K_dc_s_values,
            y: K_dc_b,
            z: zHeight,
            surfacecolor: surfaceColor,
            text: hoverText,
            hovertemplate: '%{text}<br>K_rc: ' + K_rc_slices[krcIdx] + '<extra></extra>',
            colorscale,
            cmin: 0,
            cmax: 2,
            cauto: false,  // Disable auto color scaling
            opacity: 0.9,  // Slightly transparent so layers don't completely hide each other
            lighting: { ambient: 0.8, diffuse: 0.5, specular: 0.1, roughness: 0.5, fresnel: 0.2 },
            showscale: false,
            name: `K_sc=${K_sc_val}`,
            contours: {
              z: { show: true, usecolormap: false, highlightcolor: "#444", project: { z: false } }
            }
          });
        });
      } else {
        // Show single K_sc slice
        const kscIdx = Number(selectedKscIndex);
        const fixedKsc = K_sc[kscIdx];
        
        // Correctly build gridData[dcbIdx][kdcsIdx]
        // This ensures rows are K_dc_b (Y) and columns are K_dc_s (X)
        const gridData = K_dc_b.map((_: any, dcbIdx: number) => {
          return K_dc_s_values.map((_: any, kdcsIdx: number) => {
            return currentNode.matrices[String(kdcsIdx)][krcIdx][kscIdx][dcbIdx];
          });
        });
        
        const surfaceColor = gridData.map((row: string[]) => row.map((v: string) => (typeToNum[String(v)] ?? NaN)));
        const zGrid = gridData.map(() => K_dc_s_values.map(() => fixedKsc));
        // Create hover text with the same structure
        const hoverText = gridData.map((row: string[], dcbIdx: number) => row.map((typeCode: string, kdcsIdx: number) => `K_dc_s: ${K_dc_s_values[kdcsIdx]}<br>K_dc_b: ${K_dc_b[dcbIdx]}<br>K_sc: ${fixedKsc}<br>Type: ${typeLabels[typeCode] || typeCode}`));
        
        traces.push({
          type: 'surface',
          x: K_dc_s_values,
          y: K_dc_b,
          z: zGrid,
          surfacecolor: surfaceColor,
          text: hoverText,
          hovertemplate: `%{text}<br>K_rc: ${K_rc_slices[krcIdx]}<extra></extra>`,
          colorscale,
          cmin: 0,
          cmax: 2,
          cauto: false,  // Disable auto color scaling
          opacity: 1.0,
          lighting: { ambient: 1.0, diffuse: 0.0, specular: 0.0, roughness: 0.0, fresnel: 0.0 },
          showscale: false,
          name: `K_sc=${fixedKsc}`,
        });
      }
    } else if (viewMode === '2d-fix-ksc') {
      // 2D view: fix K_sc, show K_dc_s (x) × K_dc_b (y)
      const kscIdx = fixedKscValue;
      const fixedKsc = K_sc[kscIdx];
      
      const gridData: string[][] = [];
      
      for (let dcbIdx = 0; dcbIdx < K_dc_b.length; dcbIdx++) {
        gridData[dcbIdx] = [];
      }
      
      K_dc_s_values.forEach((K_dc_s: number, kdcsIdx: number) => {
        const matrices = currentNode.matrices?.[String(kdcsIdx)];
        if (!matrices) return;
        
        const mat = matrices[krcIdx];
        const sliceData = mat[kscIdx];
        
        for (let dcbIdx = 0; dcbIdx < K_dc_b.length; dcbIdx++) {
          gridData[dcbIdx][kdcsIdx] = sliceData[dcbIdx];
        }
      });
      
      const surfaceColor = gridData.map((row) => row.map((v) => (typeToNum[String(v)] ?? NaN)));
      const hoverText = gridData.map((row: string[], dcbIdx: number) => row.map((typeCode: string, kdcsIdx: number) => `K_dc_s: ${K_dc_s_values[kdcsIdx]}<br>K_dc_b: ${K_dc_b[dcbIdx]}<br>Type: ${typeLabels[typeCode] || typeCode}`));
      
      // Debug: log unique values
      const uniqueValues = new Set<number>();
      surfaceColor.forEach(row => row.forEach(v => uniqueValues.add(v)));
      console.log('2D fix K_sc - Unique values:', Array.from(uniqueValues).sort(), 'Expected: 0-2');
      console.log('2D fix K_sc - gridData sample:', gridData.slice(0, 3).map(row => row.slice(0, 3)));
      
      traces.push({
        type: 'heatmap',
        x: K_dc_s_values,
        y: K_dc_b,
        z: surfaceColor,
        text: hoverText,
        hovertemplate: 
          `%{text}<br>` +
          `K_sc: ${fixedKsc} (fixed)<br>` +
          `K_rc: ${K_rc_slices[krcIdx]}<extra></extra>`,
        colorscale,
        zmin: 0,
        zmax: 2,
        showscale: false,
      });
    } else if (viewMode === '2d-fix-kdcb') {
      // 2D view: fix K_dc_b, show K_dc_s (x) × K_sc (y)
      const dcbIdx = fixedKdcbValue;
      const fixedKdcb = K_dc_b[dcbIdx];
      
      const gridData: string[][] = [];
      
      for (let kscIdx = 0; kscIdx < K_sc.length; kscIdx++) {
        gridData[kscIdx] = [];
      }
      
      K_dc_s_values.forEach((K_dc_s: number, kdcsIdx: number) => {
        const matrices = currentNode.matrices?.[String(kdcsIdx)];
        if (!matrices) return;
        
        const mat = matrices[krcIdx];
        
        for (let kscIdx = 0; kscIdx < K_sc.length; kscIdx++) {
          const sliceData = mat[kscIdx];
          gridData[kscIdx][kdcsIdx] = sliceData[dcbIdx];
        }
      });
      
      const surfaceColor = gridData.map((row) => row.map((v) => (typeToNum[String(v)] ?? NaN)));
      const hoverText = gridData.map((row: string[], kscIdx: number) => row.map((typeCode: string, kdcsIdx: number) => `K_dc_s: ${K_dc_s_values[kdcsIdx]}<br>K_sc: ${K_sc[kscIdx]}<br>Type: ${typeLabels[typeCode] || typeCode}`));
      
      traces.push({
        type: 'heatmap',
        x: K_dc_s_values,
        y: K_sc,
        z: surfaceColor,
        text: hoverText,
        hovertemplate: 
          `%{text}<br>` +
          `K_dc_b: ${fixedKdcb} (fixed)<br>` +
          `K_rc: ${K_rc_slices[krcIdx]}<extra></extra>`,
        colorscale,
        zmin: 0,
        zmax: 2,
        showscale: false,
      });
    } else if (viewMode === '2d-fix-kdcs') {
      // 2D view: fix K_dc_s, show K_dc_b (x) × K_sc (y)
      const kdcsIdx = fixedKdcsValue;
      const fixedKdcs = K_dc_s_values[kdcsIdx];
      
      const matrices = currentNode.matrices?.[String(kdcsIdx)];
      if (!matrices) return [];
      
      const mat = matrices[krcIdx];
      
      const gridData: string[][] = [];
      
      for (let kscIdx = 0; kscIdx < K_sc.length; kscIdx++) {
        gridData[kscIdx] = [];
        const sliceData = mat[kscIdx];
        
        for (let dcbIdx = 0; dcbIdx < K_dc_b.length; dcbIdx++) {
          gridData[kscIdx][dcbIdx] = sliceData[dcbIdx];
        }
      }
      
      const surfaceColor = gridData.map((row) => row.map((v) => (typeToNum[String(v)] ?? NaN)));
      const hoverText = gridData.map((row: string[], kscIdx: number) => row.map((typeCode: string, dcbIdx: number) => `K_dc_b: ${K_dc_b[dcbIdx]}<br>K_sc: ${K_sc[kscIdx]}<br>Type: ${typeLabels[typeCode] || typeCode}`));
      
      traces.push({
        type: 'heatmap',
        x: K_dc_b,
        y: K_sc,
        z: surfaceColor,
        text: hoverText,
        hovertemplate: 
          `%{text}<br>` +
          `K_dc_s: ${fixedKdcs} (fixed)<br>` +
          `K_rc: ${K_rc_slices[krcIdx]}<extra></extra>`,
        colorscale,
        zmin: 0,
        zmax: 2,
        showscale: false,
      });
    }

    return traces;
  }, [currentNode, selectedKscIndex, selectedKrcIndex, viewMode, fixedKscValue, fixedKdcbValue, fixedKdcsValue]);

  return (
    <div style={{ padding: 12, border: '1px solid #ccc', borderRadius: 8, marginBottom: 20 }}>
      <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>{title}</h3>
      {/* single centered clickable graph shown below */}

      {/* Main centered graph only. Surface/controls open only when a non-uniform (white) node is clicked. */}
      {analysisNodes.length === 0 ? (
        <div>
          <p>No actionable nodes found in the scenario.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', width: '100%', gap: 12 }}>
            <div className="results-graph" style={{ height: '60vh', flex: 1, border: '1px solid #ddd' }}>
              {/* use background so gradients (striped) work when stored in --node-bg */}
              <style>{`.results-graph .react-flow__node{ background: var(--node-bg) !important; }`}</style>
              <ReactFlow 
                nodes={nodes} 
                edges={edges} 
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick} 
                nodesDraggable={true}
                nodesConnectable={false}
                elementsSelectable={true}
                fitView 
                attributionPosition="bottom-left"
              >
                <MiniMap />
                <Controls />
                <Background gap={16} />
              </ReactFlow>
            </div>
          </div>
        </div>
      )}

      {/* Overlay modal: only visible when a non-uniform node has been clicked */}
      {selectedNodeIndex !== null && currentNode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', zIndex: 9999 }}>
          <div style={{ width: '85vw', height: '85vh', background: '#fff', borderRadius: 8, overflow: 'auto', padding: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              {/* Prefer the node name from the original graph JSON; fall back to analysis node.name or id */}
              <h3 style={{ margin: 0 }}>
                Node analysis: {(() => {
                  if (!currentNode) return '';
                  // try to find the name in the original graph (graph.nodes)
                  const gnodes = (graph && graph.nodes) || [];
                  const match = gnodes.find((n: any) => n.id === currentNode.id);
                  return match?.name ?? currentNode.name ?? currentNode.id;
                })()}
              </h3>
              <div>
                <button onClick={() => setPublicationViewOpen(true)} style={{ marginRight: 8, padding: '8px 12px', fontSize: '14px' }}>
                  Generate Publication Figure
                </button>
                <button 
                  onClick={() => {
                    if (!currentNode) return;

                    const {
                        K_sc_values,
                        K_dc_b_values,
                        K_rc_slice_values,
                        K_dc_s_values,
                        matrices,
                    } = currentNode;

                    // === STAGE 1: Find all disjoint hyperrectangles ===
                    const visited = new Set<string>();
                    const regions: { type: string; ranges: number[][] }[] = [];

                    const numKdcs = K_dc_s_values.length;
                    const numKrc = K_rc_slice_values.length;
                    const numKsc = K_sc_values.length;
                    const numKdcb = K_dc_b_values.length;

                    for (let i_start = 0; i_start < numKdcs; i_start++) {
                    for (let j_start = 0; j_start < numKrc; j_start++) {
                    for (let k_start = 0; k_start < numKsc; k_start++) {
                    for (let l_start = 0; l_start < numKdcb; l_start++) {
                        const startKey = `${i_start},${j_start},${k_start},${l_start}`;
                        if (visited.has(startKey)) continue;

                        const type = matrices[String(i_start)][j_start][k_start][l_start];
                        
                        let l_max = l_start;
                        while(l_max + 1 < numKdcb && !visited.has(`${i_start},${j_start},${k_start},${l_max + 1}`) && matrices[String(i_start)][j_start][k_start][l_max + 1] === type) { l_max++; }
                        
                        let k_max = k_start;
                        let canExpandK = true;
                        while(canExpandK && k_max + 1 < numKsc) {
                            for (let l_scan = l_start; l_scan <= l_max; l_scan++) {
                                if (visited.has(`${i_start},${j_start},${k_max + 1},${l_scan}`) || matrices[String(i_start)][j_start][k_max + 1][l_scan] !== type) {
                                    canExpandK = false;
                                    break;
                                }
                            }
                            if (canExpandK) k_max++;
                        }

                        let j_max = j_start;
                        let canExpandJ = true;
                        while(canExpandJ && j_max + 1 < numKrc) {
                            for (let k_scan = k_start; k_scan <= k_max; k_scan++) {
                                for (let l_scan = l_start; l_scan <= l_max; l_scan++) {
                                    if (visited.has(`${i_start},${j_max + 1},${k_scan},${l_scan}`) || matrices[String(i_start)][j_max + 1][k_scan][l_scan] !== type) {
                                        canExpandJ = false;
                                        break;
                                    }
                                }
                                if (!canExpandJ) break;
                            }
                            if (canExpandJ) j_max++;
                        }

                        let i_max = i_start;
                        let canExpandI = true;
                        while(canExpandI && i_max + 1 < numKdcs) {
                            for (let j_scan = j_start; j_scan <= j_max; j_scan++) {
                                for (let k_scan = k_start; k_scan <= k_max; k_scan++) {
                                    for (let l_scan = l_start; l_scan <= l_max; l_scan++) {
                                        if (visited.has(`${i_max + 1},${j_scan},${k_scan},${l_scan}`) || matrices[String(i_max + 1)][j_scan][k_scan][l_scan] !== type) {
                                            canExpandI = false;
                                            break;
                                        }
                                    }
                                    if (!canExpandI) break;
                                }
                                if (!canExpandI) break;
                            }
                            if (canExpandI) i_max++;
                        }

                        for (let i_v = i_start; i_v <= i_max; i_v++) {
                        for (let j_v = j_start; j_v <= j_max; j_v++) {
                        for (let k_v = k_start; k_v <= k_max; k_v++) {
                        for (let l_v = l_start; l_v <= l_max; l_v++) {
                            visited.add(`${i_v},${j_v},${k_v},${l_v}`);
                        }}}}

                        regions.push({
                            type: type,
                            ranges: [ [i_start, i_max], [j_start, j_max], [k_start, k_max], [l_start, l_max] ]
                        });
                    }}}}

                    // === STAGE 2: Group regions by type ===
                    const groupedRegions = regions.reduce((acc, region) => {
                        if (!acc[region.type]) {
                            acc[region.type] = [];
                        }
                        acc[region.type].push(region.ranges);
                        return acc;
                    }, {} as Record<string, number[][][]>);

                    // === STAGE 3: Condense/Merge regions for each type ===
                    for (const type in groupedRegions) {
                        let rects = groupedRegions[type];
                        let mergedInPass = true;
                        while (mergedInPass) {
                            mergedInPass = false;
                            for (let i = 0; i < rects.length; i++) {
                                for (let j = i + 1; j < rects.length; j++) {
                                    const r1 = rects[i];
                                    const r2 = rects[j];
                                    let diffDim = -1;
                                    let canMerge = true;
                                    // Check if they differ in exactly one dimension
                                    for (let d = 0; d < 4; d++) {
                                        if (r1[d][0] !== r2[d][0] || r1[d][1] !== r2[d][1]) {
                                            if (diffDim === -1) {
                                                diffDim = d;
                                            } else {
                                                canMerge = false; 
                                                break;
                                            }
                                        }
                                    }

                                    if (canMerge && diffDim !== -1) {
                                        const d = diffDim;
                                        // Check for adjacency on that one differing dimension
                                        if (r1[d][1] + 1 === r2[d][0] || r2[d][1] + 1 === r1[d][0]) {
                                            // Merge them
                                            const newRect = JSON.parse(JSON.stringify(r1));
                                            newRect[d][0] = Math.min(r1[d][0], r2[d][0]);
                                            newRect[d][1] = Math.max(r1[d][1], r2[d][1]);
                                            
                                            rects[i] = newRect; 
                                            rects.splice(j, 1); 
                                            
                                            mergedInPass = true;
                                            break; // Restart scan
                                        }
                                    }
                                }
                                if (mergedInPass) break;
                            }
                        }
                        groupedRegions[type] = rects;
                    }


                    // === STAGE 4: Format final results ===
                    const typeLabels: Record<string, string> = { sc: 'State-Centric (sc)', dcb: 'Data-Centric - Batch (dcb)', dcs: 'Data-Centric - Stream (dcs)' };
                    const kLabels = ['K_dc_s', 'K_rc', 'K_sc', 'K_dc_b']; // Corrisponde all'ordine i,j,k,l
                    const kValues = [K_dc_s_values, K_rc_slice_values, K_sc_values, K_dc_b_values]; // Corrisponde all'ordine i,j,k,l
                    
                    let resultString = `Optimal Type Ranges Analysis for Node: ${currentNode.id}\n\n(Generated with MERGED non-overlapping region algorithm)\n\n`;
                    
                    for (const type of ['sc', 'dcb', 'dcs']) { // Enforce order
                        if (!groupedRegions[type] || groupedRegions[type].length === 0) continue;

                        resultString += `-----------------------------------\n`;
                        resultString += `TYPE: ${typeLabels[type] || type}\n`;
                        resultString += `-----------------------------------\n`;
                        resultString += `This type is optimal in ${groupedRegions[type].length} distinct region(s):\n\n`;
                        
                        const rules = groupedRegions[type].map(rangeSet => {
                            const conditions = rangeSet.map((range, index) => {
                                const kLabel = kLabels[index];
                                const values = kValues[index];
                                const minVal = values[range[0]];
                                const maxVal = values[range[1]];
                                if (minVal === maxVal) {
                                    return `${kLabel} is ${minVal}`;
                                }
                                return `${kLabel} is between ${minVal} and ${maxVal}`;
                            });
                            return `( ${conditions.join(' AND ')} )`;
                        });
                        
                        resultString += rules.join('\n  OR\n');
                        resultString += '\n\n';
                    }

                    setRangeAnalysisResult(resultString || 'No analysis results could be generated.');
                    setRangeAnalysisViewOpen(true);
                  }} 
                  style={{ marginRight: 8, padding: '8px 12px', fontSize: '14px' }}
                >
                  Analyze Optimal Ranges
                </button>
                <button onClick={() => setSelectedNodeIndex(null)} style={{ marginRight: 8 }}>Close</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 320, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <details open>
                    <summary style={{ fontWeight: 700, cursor: 'pointer' }}>Node parameters</summary>
                    <pre style={{ background: '#f4f4f4', padding: 8, marginTop: 8, maxHeight: 220, overflow: 'auto' }}>{JSON.stringify(currentNode.node_params, null, 2)}</pre>
                  </details>
                </div>

                {/* Bottom-left anchored controls: K_rc slider, K_sc slice select, actions */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ marginTop: 12, padding: 10, borderRadius: 6, background: '#fafafa', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.03)' }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>State-centric retrieval cost (K_rc)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => setSelectedKrcIndex(Math.max(0, selectedKrcIndex - 1))}
                        disabled={selectedKrcIndex <= 0}
                        aria-label="decrement"
                        style={{ width: 32, height: 32 }}
                      >−</button>

                      <input
                        type="range"
                        min={0}
                        max={currentNode.K_rc_slice_values.length - 1}
                        step={1}
                        value={selectedKrcIndex}
                        onChange={(e) => setSelectedKrcIndex(Number(e.target.value))}
                        style={{ flex: 1 }}
                      />

                      <button
                        onClick={() => setSelectedKrcIndex(Math.min(currentNode.K_rc_slice_values.length - 1, selectedKrcIndex + 1))}
                        disabled={selectedKrcIndex >= currentNode.K_rc_slice_values.length - 1}
                        aria-label="increment"
                        style={{ width: 32, height: 32 }}
                      >+</button>
                    </div>
                    <div style={{ fontSize: 13, color: '#333', marginTop: 8 }}>
                      Selected value: <strong>{currentNode.K_rc_slice_values[selectedKrcIndex]}</strong> (index {selectedKrcIndex})
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>Use the buttons or the slider to choose the state-centric retrieval cost. Available values: {currentNode.K_rc_slice_values.join(', ')}</div>
                  </div>

                  <div style={{ marginTop: 12, padding: 10, borderRadius: 6, background: '#fafafa', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.03)' }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>State-centric cost (K_sc) — slice</label>
                    <div>
                      <select value={selectedKscIndex} onChange={(e) => setSelectedKscIndex(e.target.value === 'all' ? 'all' : Number(e.target.value))} style={{ width: '100%', padding: '6px 8px' }} disabled={viewMode !== '3d'}>
                        <option value="all">All slices</option>
                        {currentNode.K_sc_values.map((v: number, i: number) => (
                          <option key={i} value={i}>{`#${i} — ${v}`}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                      {viewMode === '3d' ? 'Select a single slice to view its surface, or choose "All slices".' : 'Only available in 3D view mode'}
                    </div>
                  </div>

                  <div style={{ marginTop: 12, padding: 10, borderRadius: 6, background: '#e8f4fd', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.03)' }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>View Mode</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input 
                          type="radio" 
                          checked={viewMode === '3d'} 
                          onChange={() => setViewMode('3d')} 
                        />
                        <span>3D View (all axes)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input 
                          type="radio" 
                          checked={viewMode === '2d-fix-ksc'} 
                          onChange={() => setViewMode('2d-fix-ksc')} 
                        />
                        <span>2D: Fix K_sc</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input 
                          type="radio" 
                          checked={viewMode === '2d-fix-kdcb'} 
                          onChange={() => setViewMode('2d-fix-kdcb')} 
                        />
                        <span>2D: Fix K_dc_b</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input 
                          type="radio" 
                          checked={viewMode === '2d-fix-kdcs'} 
                          onChange={() => setViewMode('2d-fix-kdcs')} 
                        />
                        <span>2D: Fix K_dc_s</span>
                      </label>
                    </div>
                    
                    {/* Show slider for fixed value based on view mode */}
                    {viewMode === '2d-fix-ksc' && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Fixed K_sc value</label>
                        <input
                          type="range"
                          min={0}
                          max={currentNode.K_sc_values.length - 1}
                          step={1}
                          value={fixedKscValue}
                          onChange={(e) => setFixedKscValue(Number(e.target.value))}
                          style={{ width: '100%' }}
                        />
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          {currentNode.K_sc_values[fixedKscValue]} (index {fixedKscValue})
                        </div>
                      </div>
                    )}
                    
                    {viewMode === '2d-fix-kdcb' && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Fixed K_dc_b value</label>
                        <input
                          type="range"
                          min={0}
                          max={currentNode.K_dc_b_values.length - 1}
                          step={1}
                          value={fixedKdcbValue}
                          onChange={(e) => setFixedKdcbValue(Number(e.target.value))}
                          style={{ width: '100%' }}
                        />
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          {currentNode.K_dc_b_values[fixedKdcbValue]} (index {fixedKdcbValue})
                        </div>
                      </div>
                    )}
                    
                    {viewMode === '2d-fix-kdcs' && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Fixed K_dc_s value</label>
                        <input
                          type="range"
                          min={0}
                          max={currentNode.K_dc_s_values.length - 1}
                          step={1}
                          value={fixedKdcsValue}
                          onChange={(e) => setFixedKdcsValue(Number(e.target.value))}
                          style={{ width: '100%' }}
                        />
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          {currentNode.K_dc_s_values[fixedKdcsValue]} (index {fixedKdcsValue})
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                    <button onClick={() => { navigator.clipboard?.writeText(JSON.stringify(currentNode)) }} style={{ padding: '8px 10px' }}>Copy node data</button>
                    <button onClick={() => { setSelectedKrcIndex(1); setSelectedKscIndex('all'); setViewMode('3d'); }} style={{ padding: '8px 10px' }}>Reset</button>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                {plotData.length > 0 ? (
                  <div style={{ position: 'relative', width: '100%', height: '70vh' }}>
                    <Plot
                      data={plotData}
                      layout={viewMode === '3d' ? {
                        autosize: true,
                        scene: {
                            xaxis: { 
                              title: 'data-centric stream cost (K_dc_s)',
                              range: [0, 10]
                            },
                            yaxis: { 
                              title: 'data-centric batch cost (K_dc_b)',
                              range: [0, 10]
                            },
                            zaxis: { 
                              title: 'state-centric cost (K_sc)',
                              range: [0, 10]
                            }
                          },
                        margin: { l: 60, r: 20, t: 20, b: 60 },
                        showlegend: false,
                      } : viewMode === '2d-fix-ksc' ? {
                        autosize: true,
                        xaxis: {
                          title: 'data-centric stream cost (K_dc_s)'
                        },
                        yaxis: {
                          title: 'data-centric batch cost (K_dc_b)'
                        },
                        margin: { l: 60, r: 20, t: 20, b: 60 },
                        showlegend: false,
                      } : viewMode === '2d-fix-kdcb' ? {
                        autosize: true,
                        xaxis: {
                          title: 'data-centric stream cost (K_dc_s)'
                        },
                        yaxis: {
                          title: 'state-centric cost (K_sc)'
                        },
                        margin: { l: 60, r: 20, t: 20, b: 60 },
                        showlegend: false,
                      } : {
                        autosize: true,
                        xaxis: {
                          title: 'data-centric batch cost (K_dc_b)' // x is K_dc_b
                        },
                        yaxis: {
                          title: 'state-centric cost (K_sc)' // y is K_sc
                        },
                        margin: { l: 60, r: 20, t: 20, b: 60 },
                        showlegend: false,
                      }}
                      style={{ width: '100%', height: '100%' }}
                      onClick={async (data: any) => {
                        if (!currentNode || !data.points || data.points.length === 0) return;
                        
                        const point = data.points[0];
                        let clickedKsc, clickedKdcb, clickedKdcs;
                        
                        console.log('=== CLICK DEBUG ===');
                        
                        // Extract values based on view mode
                        if (viewMode === '3d') {
                          // point.x = K_dc_s, point.y = K_dc_b, point.z = K_sc
                          clickedKdcs = point.x;
                          clickedKdcb = point.y;
                          clickedKsc = point.z;
                          
                          // Find closest values in arrays (to handle floating point precision)
                          const findClosest = (arr: number[], val: number) => {
                            return arr.reduce((prev, curr) => 
                              Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
                            );
                          };
                          
                          const closestKsc = findClosest(currentNode.K_sc_values, clickedKsc);
                          const closestKdcb = findClosest(currentNode.K_dc_b_values, clickedKdcb);
                          const closestKdcs = findClosest(currentNode.K_dc_s_values, clickedKdcs);
                          
                          console.log('Clicked values:', { clickedKsc, clickedKdcb, clickedKdcs });
                          console.log('Closest values in arrays:', { closestKsc, closestKdcb, closestKdcs });
                          
                          // Use closest values
                          clickedKsc = closestKsc;
                          clickedKdcb = closestKdcb;
                          clickedKdcs = closestKdcs;
                        } else if (viewMode === '2d-fix-ksc') {
                          // x = K_dc_s, y = K_dc_b, K_sc is fixed
                          clickedKdcs = point.x;
                          clickedKdcb = point.y;
                          clickedKsc = currentNode.K_sc_values[fixedKscValue];
                        } else if (viewMode === '2d-fix-kdcb') {
                          // x = K_dc_s, y = K_sc, K_dc_b is fixed
                          clickedKdcs = point.x;
                          clickedKsc = point.y;
                          clickedKdcb = currentNode.K_dc_b_values[fixedKdcbValue];
                        } else {
                          // x = K_dc_b, y = K_sc, K_dc_s is fixed
                          clickedKdcb = point.x; // x is K_dc_b
                          clickedKsc = point.y;
                          clickedKdcs = currentNode.K_dc_s_values[fixedKdcsValue];
                        }
                        
                        const clickedKrc = currentNode.K_rc_slice_values[selectedKrcIndex];
                        
                        // Set the fixed K values
                        setFixedK_sc(clickedKsc);
                        setFixedK_rc(clickedKrc);
                        setFixedK_dc_b(clickedKdcb);
                        setFixedK_dc_s(clickedKdcs);
                        
                        // Automatically evaluate
                        try {
                          const response = await fetch('/evaluate_point', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              node_params: currentNode.node_params,
                              K_sc: clickedKsc,
                              K_dc_b: clickedKdcb,
                              K_rc: clickedKrc,
                              K_dc_s: clickedKdcs,
                            }),
                          });
                          
                          if (!response.ok) {
                            const error = await response.json();
                            console.error('Evaluate failed:', error);
                            return;
                          }
                          
                          const result = await response.json();
                          setFixedResult({ label: result.label, code: result.type });
                        } catch (err) {
                          console.error('Failed to evaluate point:', err);
                        }
                      }}
                    />

                    {/* Embedded legend (no vertical colorbar) */}
                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.95)', padding: 10, borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Legend</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 18, height: 12, background: '#FAD105', border: '1px solid #888' }} />
                          <div>State-Centric</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 18, height: 12, background: '#59c7f3', border: '1px solid #888' }} />
                          <div>Data-Centric - Batch</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 18, height: 12, background: '#0490c8', border: '1px solid #888' }} />
                          <div>Data-Centric - Stream</div>
                        </div>
                      </div>
                    </div>

                    {/* Fixed K selector + evaluation - bottom right */}
                    <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(255,248,240,0.98)', padding: 12, borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 20, minWidth: 280 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Evaluate fixed K point</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <label style={{ fontSize: 12 }}>K_sc
                          <input type="number" value={fixedK_sc as any} onChange={(e) => setFixedK_sc(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100%', padding: '4px', fontSize: 12 }} />
                        </label>
                        <label style={{ fontSize: 12 }}>K_dc_b
                          <input type="number" value={fixedK_dc_b as any} onChange={(e) => setFixedK_dc_b(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100%', padding: '4px', fontSize: 12 }} />
                        </label>
                        <label style={{ fontSize: 12 }}>K_rc
                          <input type="number" value={fixedK_rc as any} onChange={(e) => setFixedK_rc(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100%', padding: '4px', fontSize: 12 }} />
                        </label>
                        <label style={{ fontSize: 12 }}>K_dc_s
                          <input type="number" value={fixedK_dc_s as any} onChange={(e) => setFixedK_dc_s(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100%', padding: '4px', fontSize: 12 }} />
                        </label>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={async () => {
                              // Call backend to evaluate the point
                              if (!currentNode) return;
                              if (fixedK_sc === '' || fixedK_dc_b === '' || fixedK_rc === '' || fixedK_dc_s === '') return;
                              
                              // Find the full analysis data for the current node to get node_params
                              const nodeAnalysisData = analysisNodes.find((n: any) => n.id === currentNode.id);
                              if (!nodeAnalysisData || !nodeAnalysisData.node_params) {
                                alert('Could not find analysis data (node_params) for the selected node.');
                                return;
                              }

                              try {
                                const response = await fetch('/evaluate_point', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    node_params: nodeAnalysisData.node_params,
                                    K_sc: Number(fixedK_sc),
                                    K_dc_b: Number(fixedK_dc_b),
                                    K_rc: Number(fixedK_rc),
                                    K_dc_s: Number(fixedK_dc_s),
                                  }),
                                });
                                
                                if (!response.ok) {
                                  const error = await response.json();
                                  console.error('Evaluate failed:', error);
                                  alert('Evaluation failed: ' + (error.detail || 'Unknown error'));
                                  return;
                                }
                                
                                const result = await response.json();
                                setFixedResult({ label: result.label, code: result.type });
                              } catch (err) {
                                console.error('Failed to evaluate point:', err);
                                alert('Failed to evaluate point');
                              }
                            }}
                            style={{ padding: '6px 10px', fontSize: 12, flex: 1 }}
                          >Evaluate</button>
                          <button
                            onClick={async () => {
                              // assign the fixed result to the current node
                              if (!currentNode || !fixedResult) return;
                              
                              const newType = fixedResult.code;
                              
                              // Update node color
                              setManualNodeColor(currentNode.id, newType);
                              
                              // Close the surface view
                              setSelectedNodeIndex(null);
                            }}
                            disabled={!fixedResult}
                            style={{ padding: '6px 10px', fontSize: 12, flex: 1, opacity: fixedResult ? 1 : 0.5, cursor: fixedResult ? 'pointer' : 'not-allowed' }}
                          >Select</button>
                        </div>
                        <div style={{ fontSize: 12 }}>
                          {fixedResult ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 6, background: 'rgba(255,255,255,0.7)', borderRadius: 4 }}>
                              <div style={{ width: 16, height: 10, background: (fixedResult.code === 'sc' ? '#FAD105' : fixedResult.code === 'dcb' ? '#59c7f3' : '#0490c8'), border: '1px solid #888' }} />
                              <div><strong>{fixedResult.label}</strong></div>
                            </div>
                          ) : <div style={{ color: '#666', textAlign: 'center', padding: 4 }}>No evaluation yet</div>}
                        </div>
                      </div>
                    </div>

                    {/* Textual solution removed per request; no bottom-right panel */}
                  </div>
                ) : (
                  <div>No plot data available</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isPublicationViewOpen && currentNode && (
        <PublicationFigure
          currentNode={currentNode}
          onClose={() => setPublicationViewOpen(false)}
        />
      )}

      {isRangeAnalysisViewOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', width: '80vw', height: '80vh', overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '12px', marginBottom: '12px' }}>
              <h2 style={{ margin: 0 }}>Optimal Range Analysis</h2>
              <button onClick={() => setRangeAnalysisViewOpen(false)} style={{ fontSize: '1em', padding: '8px 16px' }}>Close</button>
            </div>
            <pre style={{ flex: 1, background: '#f4f4f4', padding: '12px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {rangeAnalysisResult}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

const Results: React.FC = () => {

  const location = useLocation();
  const navigate = useNavigate();
  const {
    analysisResults,
    scenario,
    manualNodeColors: restoredManualNodeColors,
    selectedNodeIndex: restoredSelectedNodeIndex,
    selectedKrcIndex: restoredSelectedKrcIndex,
    selectedKscIndex: restoredSelectedKscIndex,
    viewMode: restoredViewMode,
    fixedKscValue: restoredFixedKscValue,
    fixedKdcbValue: restoredFixedKdcbValue,
    fixedKdcsValue: restoredFixedKdcsValue,
    fixedK_sc: restoredFixedK_sc,
    fixedK_dc_b: restoredFixedK_dc_b,
    fixedK_rc: restoredFixedK_rc,
    fixedK_dc_s: restoredFixedK_dc_s,
    fixedResult: restoredFixedResult
  } = location.state || { analysisResults: [], scenario: null };

  // Stato: mappa dataflowIndex -> { nodeId: color }
  const [manualNodeColors, setManualNodeColors] = useState<Record<number, Record<string, string>>>(restoredManualNodeColors || {});
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(restoredSelectedNodeIndex ?? null);
  const [selectedKrcIndex, setSelectedKrcIndex] = useState(restoredSelectedKrcIndex ?? 1);
  const [selectedKscIndex, setSelectedKscIndex] = useState<'all' | number>(restoredSelectedKscIndex ?? 'all');
  const [viewMode, setViewMode] = useState<'3d' | '2d-fix-ksc' | '2d-fix-kdcb' | '2d-fix-kdcs'>(restoredViewMode ?? '3d');
  const [fixedKscValue, setFixedKscValue] = useState(restoredFixedKscValue ?? 0);
  const [fixedKdcbValue, setFixedKdcbValue] = useState(restoredFixedKdcbValue ?? 0);
  const [fixedKdcsValue, setFixedKdcsValue] = useState(restoredFixedKdcsValue ?? 0);
  const [fixedK_sc, setFixedK_sc] = useState<number | ''>(restoredFixedK_sc ?? '');
  const [fixedK_dc_b, setFixedK_dc_b] = useState<number | ''>(restoredFixedK_dc_b ?? '');
  const [fixedK_rc, setFixedK_rc] = useState<number | ''>(restoredFixedK_rc ?? '');
  const [fixedK_dc_s, setFixedK_dc_s] = useState<number | ''>(restoredFixedK_dc_s ?? '');
  const [fixedResult, setFixedResult] = useState<{ label: string; code: string } | null>(restoredFixedResult ?? null);
  // Stato per il JSON dei dataflow esportato
  const [dataflowJson, setDataflowJson] = useState<any>(null);

  const handleGenerateCandidates = async () => {
    if (!analysisResults || !scenario) return;

    const dataflows = analysisResults.map((result: any, idx: number) => {
      const nodes = result.nodes.map((node: any) => {
        const scenarioNode = (scenario.nodes || []).find((n: any) => n.id === node.id);
        const baseNode = {
          id: node.id,
          name: scenarioNode ? scenarioNode.name : node.name,
          type: node.type,
        };

        // Escludi optimalDataType per producer e consumer
        const isProducerOrConsumer = ['active_p', 'reactive_p', 'pull_c', 'push_c'].includes(node.type);
        if (isProducerOrConsumer) {
          return baseNode;
        }

        const manualType = manualNodeColors[idx]?.[node.id];
        
        let uniformType: string | undefined = undefined;
        const uniq = new Set<string>();
        const matsObj = node.matrices || {};
        Object.values(matsObj).forEach((matList: any) => {
          if (!Array.isArray(matList)) return;
          matList.forEach((mat: any) => {
            if (!Array.isArray(mat)) return;
            for (let i = 0; i < mat.length; i++) {
              const row = mat[i];
              if (!Array.isArray(row)) continue;
              for (let j = 0; j < row.length; j++) {
                uniq.add(String(row[j]));
              }
            }
          });
        });
        if (uniq.size === 1) {
          uniformType = Array.from(uniq)[0];
        }

        const optimalDataType = manualType || uniformType || 'ambiguous';

        return {
          ...baseNode,
          optimalDataType,
        };
      });

      const nodeIds = new Set(nodes.map((n: any) => n.id));
      const edges = (scenario.edges || []).filter((edge: any) =>
        nodeIds.has(edge.source) && nodeIds.has(edge.target)
      ).map((edge: any) => {
        const sourceNode = (scenario.nodes || []).find((n: any) => n.id === edge.source);
        const targetNode = (scenario.nodes || []).find((n: any) => n.id === edge.target);
        return {
          id: edge.id,
          source: edge.source,
          source_name: sourceNode ? sourceNode.name : '',
          target: edge.target,
          target_name: targetNode ? targetNode.name : ''
        };
      });
      return { nodes, edges };
    });

    const candidateArchitecturesPayload = {
      scenario,
      dataflows,
    };

    try {
      const res = await fetch('/candidate-architectures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidateArchitecturesPayload),
      });

      if (res.ok) {
        const resultJson = await res.json();
        navigate('/candidate-architectures', { state: { candidateArchitectures: resultJson } });
      } else {
        const errText = await res.text();
        window.alert('Failed to generate candidate architectures: ' + errText);
      }
    } catch (err) {
      window.alert('Failed to call backend for candidates: ' + err);
    }
  };

  // Aggiorna solo il dataflow selezionato
  const setManualNodeColor = (dataflowIndex: number, nodeId: string, color: string) => {
    setManualNodeColors(prev => ({
      ...prev,
      [dataflowIndex]: {
        ...(prev[dataflowIndex] || {}),
        [nodeId]: color
      }
    }));
  } 

  // Determina se tutti i nodi di tutti i dataflow hanno un tipo ottimale
  const allNodesColored = useMemo(() => {
    if (!analysisResults || !scenario) return false;

    // Pre-calculate uniform info per ogni dataflow
    const allNodeUniformInfo: Array<Record<string, { isUniform: boolean; value: string | null }>> = [];
    analysisResults.forEach((result: any) => {
      const nodeUniformInfo: Record<string, { isUniform: boolean; value: string | null }> = {};
      result.nodes.forEach((n: any) => {
        const uniq = new Set<string>();
        const matsObj = n.matrices || {};
        Object.values(matsObj).forEach((matList: any) => {
          if (!Array.isArray(matList)) return;
          matList.forEach((mat: any) => {
            if (!Array.isArray(mat)) return;
            for (let i = 0; i < mat.length; i++) {
              const row = mat[i];
              if (!Array.isArray(row)) continue;
              for (let j = 0; j < row.length; j++) {
                uniq.add(String(row[j]));
              }
            }
          });
        });
        if (uniq.size === 1) {
          nodeUniformInfo[n.id] = { isUniform: true, value: Array.from(uniq)[0] };
        } else {
          nodeUniformInfo[n.id] = { isUniform: false, value: null };
        }
      });
      allNodeUniformInfo.push(nodeUniformInfo);
    });

    // Per ogni dataflow, tutti i nodi devono avere tipo manuale o uniforme
    for (let i = 0; i < analysisResults.length; i++) {
      const result = analysisResults[i];
      const nodeUniformInfo = allNodeUniformInfo[i];
      const manualColors = manualNodeColors[i] || {};
      // Solo nodi processing/merge
      const actionableNodes = result.nodes.filter((n: any) => n.type === 'processing' || n.type === 'merge');
      for (const node of actionableNodes) {
        const isManuallyColored = !!manualColors[node.id];
        const isUniform = nodeUniformInfo[node.id]?.isUniform;
        if (!isManuallyColored && !isUniform) {
          return false;
        }
      }
    }
    return true;
  }, [analysisResults, scenario, manualNodeColors]);

  const [finalArchJson, setFinalArchJson] = useState<any>(null);

  const handleGenerateJson = () => {
    if (!allNodesColored || !scenario) return;

    // Pre-calculate uniform info again (or lift the memoized value)
    const allNodeUniformInfo: Record<string, { isUniform: boolean; value: string | null }> = {};
    analysisResults.forEach((result: any) => {
      result.nodes.forEach((n: any) => {
        if (allNodeUniformInfo[n.id]) return;
        const uniq = new Set<string>();
        const matsObj = n.matrices || {};
        Object.values(matsObj).forEach((matList: any) => {
          if (!Array.isArray(matList)) return;
          matList.forEach((mat: any) => {
            if (!Array.isArray(mat)) return;
            for (let i = 0; i < mat.length; i++) {
              const row = mat[i];
              if (!Array.isArray(row)) continue;
              for (let j = 0; j < row.length; j++) {
                uniq.add(String(row[j]));
              }
            }
          });
        });
        if (uniq.size === 1) {
          allNodeUniformInfo[n.id] = { isUniform: true, value: Array.from(uniq)[0] };
        } else {
          allNodeUniformInfo[n.id] = { isUniform: false, value: null };
        }
      });
    });

    // Costruisci la struttura richiesta: dataflows [{ nodes, edges }]
    const dataflows = analysisResults.map((result: any, idx: number) => {
      // Costruisci nodi con solo id, type, optimalDataType
      const nodes = result.nodes.map((node: any) => {
        const manualType = manualNodeColors[idx]?.[node.id];
        let uniformType: string | undefined = undefined;
        const uniq = new Set<string>();
        const matsObj = node.matrices || {};
        Object.values(matsObj).forEach((matList: any) => {
          if (!Array.isArray(matList)) return;
          matList.forEach((mat: any) => {
            if (!Array.isArray(mat)) return;
            for (let i = 0; i < mat.length; i++) {
              const row = mat[i];
              if (!Array.isArray(row)) continue;
              for (let j = 0; j < row.length; j++) {
                uniq.add(String(row[j]));
              }
            }
          });
        });
        if (uniq.size === 1) {
          uniformType = Array.from(uniq)[0];
        }
        const optimalDataType = manualType || uniformType || 'N/A';
        // Prendi il name dal nodo originale dello scenario
        const scenarioNode = (scenario.nodes || []).find((n: any) => n.id === node.id);
        return {
          id: node.id,
          name: scenarioNode ? scenarioNode.name : node.name,
          type: node.type,
          optimalDataType,
        };
      });
      // Costruisci edges dal grafo originale che collegano i nodi presenti nel dataflow
      const nodeIds = new Set(nodes.map((n: any) => n.id));
      const edges = (scenario.edges || []).filter((edge: any) =>
        nodeIds.has(edge.source) && nodeIds.has(edge.target)
      ).map((edge: any) => {
        const sourceNode = (scenario.nodes || []).find((n: any) => n.id === edge.source);
        const targetNode = (scenario.nodes || []).find((n: any) => n.id === edge.target);
        return {
          id: edge.id,
          source: edge.source,
          source_name: sourceNode ? sourceNode.name : '',
          target: edge.target,
          target_name: targetNode ? targetNode.name : ''
        };
      });
      return { nodes, edges };
    });

    const finalArchitecture = {
      dataflows,
    };

    // Salva il JSON dei dataflow in uno stato separato
    setDataflowJson(finalArchitecture);

    // Create a blob and trigger download
    const jsonString = JSON.stringify(finalArchitecture, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dataflows.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!analysisResults || analysisResults.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Interactive Costs Comparison</h2>
        <div>
          <p>No analysis data found. Go back and try again.</p>
          <button onClick={() => navigate(-1)}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Interactive Costs Comparison</h2>
        <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 12 }}>
          <button
            onClick={handleGenerateCandidates}
            style={{
              padding: '10px 15px',
              fontSize: '16px',
              cursor: 'pointer',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            Generate Candidate Architectures
          </button>
        </div>
      </div>
      
      <Legend />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {analysisResults.map((result: any, index: number) => {
          // The graph for this data flow is a subgraph of the original scenario
          const dataFlowGraph = {
            nodes: scenario.nodes.filter((n: any) => result.nodes.some((res_n: any) => res_n.id === n.id)),
            edges: scenario.edges.filter((e: any) => 
              result.nodes.some((n: any) => n.id === e.source) &&
              result.nodes.some((n: any) => n.id === e.target)
            ),
          };

          // Usa sempre manualNodeColors aggiornato, anche dopo il ripristino
          const nodeColorsForFlow = manualNodeColors[index] || {};

          // Funzione setter per questo dataflow
          const setNodeColorForFlow = (nodeId: string, color: string) => setManualNodeColor(index, nodeId, color);

          return (
            <GraphDisplay
              key={index}
              analysis={result}
              graph={dataFlowGraph}
              title={`Data Flow ${index + 1}`}
              manualNodeColors={nodeColorsForFlow}
              setManualNodeColor={setNodeColorForFlow}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Results;