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
    <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', justifyContent: 'center', flexWrap: 'wrap', padding: '16px', borderRadius: 8, background: '#fff', border: '1px solid #eee', marginBottom: '24px', fontSize: '1.8rem' }}>
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
        frequency?: number;
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


const MappingTable: React.FC = () => (
    <div style={{ 
        background: '#fff', 
        border: '1px solid #eee', 
        borderRadius: 8, 
        padding: '16px', 
        width: '350px', 
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
                        <td style={{ padding: '8px', color: '#555' }}>{cat}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

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
            // Rimuovi lo score per la chiave di confronto, ma mantienilo nel grafo
            const { score, ...graphWithoutScore } = graph;
            const canonicalGraph = {
                ...graphWithoutScore,
                nodes: [...graphWithoutScore.nodes].sort((a, b) => a.id.localeCompare(b.id)),
                edges: [...graphWithoutScore.edges].sort((a, b) => a.id.localeCompare(b.id)),
            };
            const key = JSON.stringify(canonicalGraph);
            const entry = seen.get(key);
            if (entry) {
                entry.count++;
            } else {
                // Salva il grafo originale con lo score
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
