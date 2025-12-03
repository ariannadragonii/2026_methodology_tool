import React, { useState, useMemo, useRef } from 'react';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const _plotModule = require('react-plotly.js');
const Plot = (_plotModule && _plotModule.default) ? _plotModule.default : _plotModule;

// Utility to get default selected indices (e.g., up to 4 evenly spaced)
const getDefaultIndices = (values: any[]): Set<number> => {
  const indices = new Set<number>();
  if (!values || values.length === 0) return indices;
  const count = Math.min(values.length, 4); // select up to 4 values
  for (let i = 0; i < count; i++) {
    const index = Math.floor(i * (values.length / count));
    indices.add(index);
  }
  return indices;
};

interface PublicationFigureProps {
  currentNode: any;
  onClose: () => void;
}

const PublicationFigure: React.FC<PublicationFigureProps> = ({ currentNode, onClose }) => {
  const { 
    K_sc_values, 
    K_dc_b_values, 
    K_rc_slice_values, 
    K_dc_s_values, 
    matrices 
  } = currentNode;

  const [selectedKscIndices, setSelectedKscIndices] = useState<Set<number>>(() => getDefaultIndices(K_sc_values));
  const [selectedKrcIndices, setSelectedKrcIndices] = useState<Set<number>>(() => getDefaultIndices(K_rc_slice_values));

  const handleCheckboxChange = (
    index: number,
    selection: Set<number>,
    setter: React.Dispatch<React.SetStateAction<Set<number>>>
  ) => {
    const newSelection = new Set(selection);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setter(newSelection);
  };
  
  // This is the data mapping and colorscale from Results.tsx
  const typeToNum: Record<string, number> = { sc: 0, dcs: 1, dcb: 2 };
  const typeLabels: Record<string, string> = {
    sc: 'State-Centric',
    dcs: 'Data-Centric (Stream)',
    dcb: 'Data-Centric (Batch)'
  };
  const colorscale = [
    [0.0, '#FAD105'], [0.333, '#FAD105'],
    [0.333, '#0490c8'], [0.666, '#0490c8'], // Stream (value 1)
    [0.666, '#59c7f3'], [1.0, '#59c7f3'],   // Batch (value 2)
  ];

  const sortedKrcIndices = useMemo(() => Array.from(selectedKrcIndices).sort((a,b) => a - b), [selectedKrcIndices]);
  const sortedKscIndices = useMemo(() => Array.from(selectedKscIndices).sort((a,b) => a - b), [selectedKscIndices]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', width: '95vw', height: '95vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4em' }}>Publication Figure Generator</h2>
            <p style={{ margin: '4px 0 0', color: '#555' }}>
              Configure the grid below. Use your system's screenshot tool to save the resulting figure.
            </p>
          </div>
          <button onClick={onClose} style={{ fontSize: '1em', padding: '8px 16px' }}>Close</button>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Controls Panel */}
          <div style={{ width: '280px', padding: '16px', borderRight: '1px solid #ccc', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>Grid Configuration</h3>
            
            <strong>K_rc values (columns):</strong>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', padding: '8px', margin: '8px 0' }}>
              {K_rc_slice_values.map((val: number, index: number) => (
                <div key={index}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedKrcIndices.has(index)}
                      onChange={() => handleCheckboxChange(index, selectedKrcIndices, setSelectedKrcIndices)}
                    />
                    {val} (index {index})
                  </label>
                </div>
              ))}
            </div>

            <strong>K_sc values (rows):</strong>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', padding: '8px', margin: '8px 0' }}>
              {K_sc_values.map((val: number, index: number) => (
                <div key={index}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedKscIndices.has(index)}
                      onChange={() => handleCheckboxChange(index, selectedKscIndices, setSelectedKscIndices)}
                    />
                    {val} (index {index})
                  </label>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Legend</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 18, height: 12, background: '#FAD105', border: '1px solid #888' }} />
                    <div>State-Centric</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 18, height: 12, background: '#59c7f3', border: '1px solid #888' }} />
                    <div>Data-Centric (Batch)</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 18, height: 12, background: '#0490c8', border: '1px solid #888' }} />
                    <div>Data-Centric (Stream)</div>
                  </div>
                </div>
            </div>

          </div>

          {/* Figure Display */}
          <div style={{ flex: 1, padding: '20px', overflow: 'auto', background: '#fdfdfd' }}>
            <div 
              id="publication-grid" 
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${sortedKrcIndices.length}, 1fr)`,
                gap: '16px',
              }}
            >
              {sortedKscIndices.map(kscIdx => (
                sortedKrcIndices.map(krcIdx => {
                  
                  // This logic is adapted from the '2d-fix-ksc' view in Results.tsx
                  // Grid: Y-axis is K_dc_b, X-axis is K_dc_s
                  const gridData: string[][] = Array(K_dc_b_values.length).fill(0).map(() => Array(K_dc_s_values.length));
                  
                  K_dc_s_values.forEach((K_dc_s: number, kdcsIdx: number) => {
                    const kdcsMatrices = matrices?.[String(kdcsIdx)];
                    if (!kdcsMatrices) return;
                    
                    const mat = kdcsMatrices[krcIdx];
                    const sliceData = mat[kscIdx]; // Array of types for each K_dc_b
                    
                    for (let dcbIdx = 0; dcbIdx < K_dc_b_values.length; dcbIdx++) {
                      gridData[dcbIdx][kdcsIdx] = sliceData[dcbIdx];
                    }
                  });
                  
                  const zValues = gridData.map((row) => row.map((v) => (typeToNum[String(v)] ?? NaN)));
                  const hoverText = gridData.map((row, dcbIdx) => 
                    row.map((typeCode, kdcsIdx) => 
                      `${typeLabels[typeCode] || typeCode}`
                    )
                  );

                  // Determine if we should show axis titles
                  // Show Y axis title only for the first column
                  const showYAxisTitle = sortedKrcIndices.indexOf(krcIdx) === 0;
                  // Show X axis title only for the last row
                  const showXAxisTitle = sortedKscIndices.indexOf(kscIdx) === sortedKscIndices.length - 1;

                  return (
                    <div key={`${kscIdx}-${krcIdx}`} style={{ border: '1px solid #ddd' }}>
                      <Plot
                        data={[{
                          type: 'heatmap',
                          x: K_dc_s_values,
                          y: K_dc_b_values,
                          z: zValues,
                          text: hoverText,
                          hovertemplate: 
                            `K_dc_s: %{x}<br>` +
                            `K_dc_b: %{y}<br>` +
                            `<b>Type: %{text}</b><extra></extra>`,
                          colorscale: colorscale,
                          zmin: 0,
                          zmax: 2,
                          showscale: false,
                        }]}
                        layout={{
                          width: 300,
                          height: 250,
                          margin: { l: showYAxisTitle ? 55: 25, r: 10, t: 40, b: showXAxisTitle ? 50 : 25 },
                          title: {
                            text: `K_sc = ${K_sc_values[kscIdx]}<br>K_rc = ${K_rc_slice_values[krcIdx]}`,
                            font: { size: 10 }
                          },
                          xaxis: {
                            title: showXAxisTitle ? { text: 'K_dc_s', font: {size: 11} } : undefined,
                            tickfont: { size: 9 }
                          },
                          yaxis: {
                            title: showYAxisTitle ? { text: 'K_dc_b', font: {size: 11} } : undefined,
                            tickfont: { size: 9 }
                          },
                        }}
                        config={{ staticPlot: true }} // Makes the plot non-interactive
                      />
                    </div>
                  );
                })
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicationFigure;