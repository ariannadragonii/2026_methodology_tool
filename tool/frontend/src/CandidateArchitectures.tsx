import React, { useMemo } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useLocation } from 'react-router-dom';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import './print.css';

// --- Re-used constants and types from FinalArchitecture ---

const PALETTE = {
    dcs: '#0490c8',
    sc: '#FAD105',
    dcb: '#59c7f3',
    default: '#CCCCCC', // For producers/consumers
};

const Legend: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', justifyContent: 'center', flexWrap: 'wrap', padding: '16px', borderRadius: 8, background: '#fff', border: '1px solid #eee', marginBottom: '24px', fontSize: '1.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 16, background: PALETTE.sc, border: '1px solid #888', borderRadius: 3 }} />
            <div>State-Centric</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 16, background: PALETTE.dcb, border: '1px solid #888', borderRadius: 3 }} />
            <div>Data-Centric (Batch)</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 16, background: PALETTE.dcs, border: '1px solid #888', borderRadius: 3 }} />
            <div>Data-Centric (Stream)</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 16, background: PALETTE.default, border: '1px solid #888', borderRadius: 3 }} />
            <div>Producer / Consumer</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: 24, height: 2, background: '#b1b1b7' }} />
                <div style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '6px solid #b1b1b7' }} />
            </div>
            <div>Volatile Link</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: 24, height: 4, background: 'green' }} />
                <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '8px solid green' }} />
            </div>
            <div>Persistent Link</div>
        </div>
    </div>
);

interface GraphNode {
    id: string;
    name: string;
    type: string;
    optimalType?: keyof typeof PALETTE;
    score?: number; // Aggiunto per preservare lo score
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

interface CandidateArchitecture {
    nodes: GraphNode[];
    edges: GraphEdge[];
    score: number;
}

// --- Graph Display Component ---

const GraphDisplay: React.FC<{ graph: { nodes: GraphNode[]; edges: GraphEdge[] } }> = ({ graph }) => {
    
    const { nodes: graphNodes, edges: graphEdges } = graph;

    const positionedNodes = useMemo(() => {
        const producers = graphNodes.filter((n) => ['active_p', 'passive_p'].includes(n.type));
        const consumers = graphNodes.filter((n) => ['pull_c', 'push_c'].includes(n.type));
        const actions = graphNodes.filter((n) => !producers.includes(n) && !consumers.includes(n));

        const makePositions = (list: GraphNode[], xBase: number) => {
            return list.map((n, i) => {
                let label = n.name || n.id;
                let bgColor = PALETTE.default;
                if (n.optimalType && PALETTE[n.optimalType]) {
                    bgColor = PALETTE[n.optimalType];
                } else if (n.type === 'processing' || n.type === 'merge') {
                    // Fallback for action nodes if optimalType is missing
                    bgColor = '#E7E7E4'; 
                }

                return {
                    id: n.id,
                    position: { x: xBase, y: i * 100 },
                    data: { label },
                    style: {
                        background: bgColor,
                        border: '1px solid #777',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        width: 150,
                        textAlign: 'center' as 'center',
                        fontSize: '1.5rem',
                    },
                };
            });
        };

        const producerNodes = makePositions(producers, 0);
        const actionNodes = makePositions(actions, 250);
        const consumerNodes = makePositions(consumers, 500);

        return [...producerNodes, ...actionNodes, ...consumerNodes];
    }, [graphNodes]);

    const memoizedEdges = useMemo(
        () =>
            graphEdges.map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
                style: {
                    strokeWidth: edge.type?.toLowerCase() === 'persistent' ? 3 : 1.5,
                    stroke: edge.type?.toLowerCase() === 'persistent' ? 'green' : '#b1b1b7',
                }
            })),
        [graphEdges]
    );

    const [nodes, , onNodesChange] = useNodesState(positionedNodes);
    const [edges, , onEdgesChange] = useEdgesState(memoizedEdges);

    return (
        <div className="reactflow-container" style={{ height: '250px', width: '350px', border: '1px solid #ddd', borderRadius: '2px', background: '#fff' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                nodesDraggable={true}
                elementsSelectable={true}
                proOptions={{ hideAttribution: true }}
            >
                <Background className="no-print" />
                {/* <Controls className="no-print" /> */}
            </ReactFlow>
        </div>
    );};

const DEFINITIONS: Record<string, { def: string; examples: string }> = {
    'Data Processing System with Job Deployment': {
        def: 'Systems designed to aggregate data and process it in large volumes. They execute finite data processing jobs.',
        examples: 'Apache Spark, Hadoop MapReduce'
    },
    'Data Processing System with Task Deployment': {
        def: 'Systems designed for continuous, low-latency computation on data in motion.',
        examples: 'Apache Flink, Apache Storm, Spark Streaming'
    },
    'Data Management System': {
        def: 'Systems whose primary role is data persistence and retrieval. The selection of specific sub-categories depends on the data structure (e.g., relational for structured data, NoSQL for semi-structured/unstructured).',
        examples: 'CockroachDB, Google Spanner, MongoDB, Redis, Cassandra'
    },
    'Data Storage System': {
        def: 'Systems that provide durable storage for in-transit data, enabling data persistence between architectural stages.',
        examples: 'Apache Kafka, HDFS'
    },
    'N/A (Communication Channel)': {
        def: 'A direct communication channel (e.g., TCP connection, API call) that connects two systems without intermediate storage or processing.',
        examples: 'TCP connection, API call'
    }
};

const MappingTable: React.FC = () => {
    const [hoveredCategory, setHoveredCategory] = React.useState<string | null>(null);
    const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });

    return (
    <div style={{ 
        background: '#fff', 
        border: '1px solid #eee', 
        borderRadius: 8, 
        padding: '16px', 
        width: '550px', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        alignSelf: 'flex-start',
        marginTop: '16px'
    }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.2rem', borderBottom: '1px solid #eee', paddingBottom: '8px', textAlign: 'center' }}>
            Systems Mapping
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
                <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #ddd' }}>ADL</th>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #ddd' }}>
                        System Category <span style={{ fontWeight: 'normal', color: '#666' }}>[Margara et al. 2023]</span>
                    </th>
                </tr>
            </thead>
            <tbody>
                {[
                    ['Batch Processing Component', 'Data Processing System with Job Deployment'],
                    ['Stream Processing Component', 'Data Processing System with Task Deployment'],
                    ['State-centric Component', 'Data Management System'],
                    ['Persistent Link', 'Data Storage System'],
                    ['Volatile Link', 'N/A (Communication Channel)']
                ].map(([adl, cat], i) => (
                    <tr key={i} style={{ borderBottom: i === 4 ? 'none' : '1px solid #f0f0f0' }}>
                        <td style={{ padding: '8px', fontWeight: 600, color: '#333' }}>{adl}</td>
                        <td 
                            style={{ padding: '8px', color: '#555', cursor: 'help', position: 'relative' }}
                            onMouseEnter={(e) => {
                                setHoveredCategory(cat);
                                setMousePos({ x: e.clientX, y: e.clientY });
                            }}
                            onMouseMove={(e) => {
                                setMousePos({ x: e.clientX, y: e.clientY });
                            }}
                            onMouseLeave={() => setHoveredCategory(null)}
                        >
                            {cat}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        {hoveredCategory && DEFINITIONS[hoveredCategory] && (
            <div style={{
                position: 'fixed',
                top: mousePos.y + 15,
                left: mousePos.x + 15,
                background: 'white',
                border: '1px solid #ccc',
                padding: '12px',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 10000,
                maxWidth: '300px',
                fontSize: '0.85rem',
                pointerEvents: 'none'
            }}>
                <div style={{ marginBottom: '6px', fontWeight: 600, color: '#333' }}>{hoveredCategory}</div>
                <div style={{ marginBottom: '8px', lineHeight: '1.4' }}>{DEFINITIONS[hoveredCategory].def}</div>
                <div style={{ color: '#666', fontStyle: 'italic' }}>Examples: {DEFINITIONS[hoveredCategory].examples}</div>
            </div>
        )}
    </div>
);};

// --- Main Page Component ---

const CandidateArchitectures: React.FC = () => {
    const location = useLocation();
    const candidates = location.state?.candidateArchitectures?.candidate_architectures as CandidateArchitecture[] | undefined;

    const uniqueCandidatesWithCount = useMemo(() => {
        if (!candidates) {
            return [];
        }
        const seen = new Map<string, { graph: CandidateArchitecture; count: number }>();
        candidates.forEach(graph => {
            // Build a canonical key based only on component types and link types,
            // ignoring specific node IDs, periods, and dataItems.
            // Two architectures with the same component types and link types are the same architecture.
            const nodeTypeMap = Object.fromEntries(
                graph.nodes.map(n => [n.id, `${n.type}:${n.optimalType ?? ''}`])
            );
            const nodeKey = [...graph.nodes]
                .map(n => `${n.type}:${n.optimalType ?? ''}`)
                .sort()
                .join('|');
            const edgeKey = [...graph.edges]
                .map(e => `${nodeTypeMap[e.source] ?? e.source}->${nodeTypeMap[e.target] ?? e.target}:${e.type}`)
                .sort()
                .join('|');
            const key = `${nodeKey}##${edgeKey}`;
            const entry = seen.get(key);
            if (entry) {
                entry.count++;
            } else {
                seen.set(key, { graph, count: 1 });
            }
        });
        // Ordina i candidati unici in base al count (dal più alto al più basso)
        return Array.from(seen.values()).sort((a, b) => b.count - a.count);
    }, [candidates]);

    const groupedCandidates = useMemo(() => {
        if (!candidates) {
            return [];
        }
        const groups = new Map<string, { graph: { nodes: GraphNode[]; edges: GraphEdge[] }; count: number }[]>();
        uniqueCandidatesWithCount.forEach(item => {
            const { graph, count } = item;
            const nodeKey = JSON.stringify([...graph.nodes].sort((a, b) => a.id.localeCompare(b.id)));
            if (!groups.has(nodeKey)) {
                groups.set(nodeKey, []);
            }
            groups.get(nodeKey)!.push({ graph, count });
        });
        return Array.from(groups.values());
    }, [uniqueCandidatesWithCount]);

    const totalCombinations = candidates?.length || 1;

    // Ref per screenshot
    const exportRef = React.useRef<HTMLDivElement>(null);

    const handleExportPDF = async () => {
        const input = exportRef.current;
        if (!input) return;

        // Temporarily store original styles
        const originalWidth = input.style.width;
        const originalHeight = input.style.height;
        const originalOverflow = input.style.overflow;

        // Get the full scrollable dimensions of the content
        const scrollWidth = input.scrollWidth;
        const scrollHeight = input.scrollHeight;

        // Apply temporary styles to ensure html2canvas captures the full content
        // Important: Set these dimensions on the *input* element (exportRef.current)
        input.style.width = `${scrollWidth}px`;
        input.style.height = `${scrollHeight}px`;
        input.style.overflow = 'visible'; // Crucial to prevent clipping for hidden overflow content

        // Add a small delay to allow browser to re-render with new dimensions
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
        
        // html2canvas screenshot
        const canvas = await html2canvas(input, {
            scale: 10,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            // Explicitly tell html2canvas the area to capture based on scroll dimensions
            width: scrollWidth,
            height: scrollHeight,
            x: 0, // Start capturing from the top-left corner
            y: 0,
        });

        // Revert styles to original after capture
        input.style.width = originalWidth;
        input.style.height = originalHeight;
        input.style.overflow = originalOverflow;

        const imgData = canvas.toDataURL('image/png');

        // PDF dimensione pagina: larghezza e altezza in px
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save('generated_architectures.pdf');
    };

    return (
        <div style={{ padding: '16px 8px', backgroundColor: '#f9fafb' }}>
            <div style={{ maxWidth: '100%', margin: '0 auto' }} ref={exportRef}>
                <header style={{ marginBottom: '16px', textAlign: 'center', position: 'relative' }}>
                    <h1 style={{fontSize: '3.6rem', fontWeight: 700, margin: '0 0 8px 0'}}>Generated Architectures</h1>
                    {/* <p style={{ color: '#555', fontSize: '1em', margin: '0' }}>
                        The following are the possible final architectures based on the ambiguous nodes in the scenario. 
                        {candidates && ` Found ${uniqueCandidatesWithCount.length} unique architectures from ${candidates.length} combinations.`}
                    </p> */}
                    {uniqueCandidatesWithCount && uniqueCandidatesWithCount.length > 0 && <Legend />}
                </header>

                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: '24px', padding: '0 16px' }}>
                    <div style={{ flex: 1, maxWidth: '1648px' }}>
                        {groupedCandidates && groupedCandidates.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '24px', paddingBottom: '16px' }}>
                                {uniqueCandidatesWithCount.map(({ graph, count }, index) => {
                                     const probability = (count / totalCombinations) * 100;
                                     return (
                                         <div key={index} className="graph-container" style={{ textAlign: 'center', marginBottom: '16px' }}>
                                             <GraphDisplay
                                                 graph={graph}
                                             />
                                             <p style={{ margin: '8px 0 0 0', fontSize: '1.8rem', fontWeight: 500, color: '#333' }}>
                                                 {index + 1}. Support: {probability.toFixed(1)}%
                                             </p>
                                         </div>
                                     );
                                })}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '8px' }}>
                                <h2>No Candidate Architectures Found</h2>
                                <p>Go back to the results page and generate candidates.</p>
                            </div>
                        )}
                    </div>
                    <MappingTable />
                </div>
            </div>
        </div>
    );
};

export default CandidateArchitectures;
