import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import ReactFlow, {
	Background,
	Controls,
	MiniMap,
	useNodesState,
	useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { MarkerType } from 'reactflow';
import { getStraightPath, EdgeLabelRenderer } from 'reactflow';
import { saveAs } from 'file-saver';

const PALETTE = {
	dcs: '#0490c8',
	sc: '#FAD105',
	dcb: '#59c7f3',
	default: '#E7E7E4',
};

const Legend: React.FC = () => (
	<div style={{ borderBottom: '1px solid #eee', paddingBottom: 12, marginBottom: 12 }}>
		<h3 style={{ marginTop: 0, marginBottom: 8, textAlign: 'center' }}>Legend</h3>
		<div style={{ display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'flex-start', justifyContent: 'center' }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<div style={{ width: 32, height: 18, background: '#FAD105', border: '1px solid #888', borderRadius: 4 }} />
				<div>State-Centric</div>
			</div>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<div style={{ width: 32, height: 18, background: '#59c7f3', border: '1px solid #888', borderRadius: 4 }} />
				<div>Data-Centric (Batch)</div>
			</div>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<div style={{ width: 32, height: 18, background: '#0490c8', border: '1px solid #888', borderRadius: 4 }} />
				<div>Data-Centric (Stream)</div>
			</div>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<div style={{ width: 32, height: 18, background: '#CCCCCC', border: '1px solid #888', borderRadius: 4 }} />
				<div>Producer / Consumer</div>
			</div>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<svg width="32" height="18" style={{ display: 'block' }}>
					<line x1="4" y1="9" x2="28" y2="9" stroke="green" strokeWidth="4" />
				</svg>
				<div>Persistent Edge</div>
			</div>
		</div>
	</div>
);

interface GraphNode {
	id: string;
	name: string;
	type: string;
	optimalType?: keyof typeof PALETTE;
}

interface GraphEdge {
	id: string;
	source: string;
	target: string;
  type: string;
	data?: {
		dataItem?: string;
		period?: number;
	};
}

const spacingY = 80;

const makePositions = (list: GraphNode[], xBase: number) => {
	const total = list.length;
	return list.map((n, i) => {
		let label = n.name;
		if (n.type === 'active_p') {
			label = `${label}\n(Active)`;
		} else if (n.type === 'passive_p') {
			label = `${label}\n(Passive)`;
		} else if (n.type === 'pull_c') {
			label = `${label}\n(Pull)`;
		} else if (n.type === 'push_c') {
			label = `${label}\n(Push)`;
		}

		return {
			id: n.id,
			position: { x: xBase, y: (i - (total - 1) / 2) * spacingY + 130 },
			data: { label: label, type: n.type, optimalType: n.optimalType || null },
			style: { background: PALETTE[n.optimalType || 'default'] },
		};
	});
};

// Define nodeTypes and edgeTypes outside the component to avoid React Flow warnings
const nodeTypes = {};

const PersistentEdge = ({ id, sourceX, sourceY, targetX, targetY, label }: any) => {
	const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });
	return (
		<>
			<path
				id={id}
				d={edgePath}
				stroke="green"
				strokeWidth={4}
				fill="none"
				markerEnd="url(#arrowclosed)"
			/>
			{label && (
				<EdgeLabelRenderer>
					<div
						style={{
							position: 'absolute',
							transform: `translate(-50%, -50%)`,
							left: `${(sourceX + targetX) / 2}px`,
							top: `${(sourceY + targetY) / 2 - 10}px`,
							pointerEvents: 'all',
							color: 'green',
							fontWeight: 600,
							fontSize: 12,
							background: 'white',
							padding: '2px 6px',
							borderRadius: 4,
							border: '1px solid #bbb',
						}}
					>
						{label}
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
};
const edgeTypes = {
	persistent: PersistentEdge,
};

const FinalArchitecture = () => {
	const location = useLocation();
	const graphData = location.state?.graph as { nodes: GraphNode[]; edges: GraphEdge[] };

	const producers = graphData?.nodes.filter((node) => node.type === 'active_p' || node.type === 'passive_p') || [];
	const actions = graphData?.nodes.filter((node) => node.type === 'processing' || node.type === 'merge') || [];
	const consumers = graphData?.nodes.filter((node) => node.type === 'pull_c' || node.type === 'push_c') || [];

	const pPos = makePositions(producers, 40);
	const aPos = makePositions(actions, 360);
	const cPos = makePositions(consumers, 680);

	const initialNodes = [...pPos, ...aPos, ...cPos];

	const initialEdges = useMemo(
		() =>
			graphData?.edges.map((edge: GraphEdge) => {
				const isPersistent = edge.type?.toLowerCase() === 'persistent';
				return {
					id: edge.id,
					source: edge.source,
					target: edge.target,
					label: `Data: ${edge.data?.dataItem || 'N/A'}, Period: ${edge.data?.period || 'N/A'}`,
					type: isPersistent ? 'persistent' : 'volatile',
					markerEnd: {
						type: MarkerType.ArrowClosed,
						width: 12,
						height: 12,
					},
				};
			}) || [],
		[graphData]
	);

	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

	const exportArchitectureJson = () => {
		try {
			const blob = new Blob([JSON.stringify(location.state?.graph, null, 2)], { type: 'application/json' });
			saveAs(blob, 'architecture.json');
		} catch (error) {
			console.error('Error exporting architecture JSON:', error);
		}
	};

	return (
		<div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: '#f7f7fa', margin: 0, padding: 0, overflow: 'hidden' }}>
			<div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'row', gap: 0, alignItems: 'stretch', justifyContent: 'stretch', background: '#fff' }}>
				<div style={{ flex: '0 0 340px', height: '100vh', padding: '32px 24px 24px 24px', boxSizing: 'border-box', overflowY: 'auto', borderRight: '1px solid #eee' }}>
					<h1 style={{ textAlign: 'left', marginBottom: 8 }}>Final Architecture</h1>
					<p style={{ color: '#444', marginBottom: 24 }}>
						View the final architecture, its components and their relationships.<br />
            You can export the configuration as JSON.
					</p>
					<Legend />
					<div style={{ marginTop: 32, textAlign: 'left' }}>
						<button
							onClick={exportArchitectureJson}
							style={{
								background: '#0490c8',
								color: '#fff',
								border: 'none',
								borderRadius: 6,
								padding: '10px 24px',
								fontSize: 16,
								fontWeight: 600,
								cursor: 'pointer',
								boxShadow: '0 1px 4px #0002',
								transition: 'background 0.2s',
							}}
							onMouseOver={e => (e.currentTarget.style.background = '#036fa0')}
							onMouseOut={e => (e.currentTarget.style.background = '#0490c8')}
						>
							Export architecture as JSON
						</button>
					</div>
				</div>
				<div style={{ flex: 1, minWidth: 0, height: '100vh', background: '#fafbfc' }}>
					<ReactFlow
						nodes={nodes}
						edges={edges}
						onNodesChange={onNodesChange}
						onEdgesChange={onEdgesChange}
						fitView
						nodeTypes={nodeTypes}
						edgeTypes={edgeTypes}
						style={{ width: '100%', height: '100%' }}
					>
						<Background />
						<Controls />
						<MiniMap
							nodeColor={(node) => {
								if (['active_p', 'passive_p', 'pull_c', 'push_c'].includes(node.data.type)) return '#CCCCCC';
								const optimalType = node.data?.optimalType || 'default';
								return PALETTE[optimalType as keyof typeof PALETTE];
							}}
						/>
					</ReactFlow>
				</div>
			</div>
		</div>
	);
};

export default FinalArchitecture;
