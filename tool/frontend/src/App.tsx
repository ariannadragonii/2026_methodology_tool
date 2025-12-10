import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import GraphEditor, { GraphEditorHandle, NodeType } from './GraphEditor';
import './App.css';
function App() {
  const graphEditorRef = useRef<GraphEditorHandle>(null);

  const handleExportClick = () => {
    if (graphEditorRef.current?.validateGraph()) {
      graphEditorRef.current?.downloadJSON();
    }
  };

  const handleAddNode = (type: NodeType) => {
    graphEditorRef.current?.openModalForType(type);
  };

  const handleClearGraph = () => {
    graphEditorRef.current?.clearGraph();
  };

  const [scenarioJson, setScenarioJson] = React.useState<any>(null);
  const [dataflowJson, setDataflowJson] = React.useState<any>(null);


  // Handler per il bottone Final Architecture
  const handleFinalArchClick = async () => {
    // Ottieni scenario e dataflow JSON
    let scenario = scenarioJson;
    let dataflow = dataflowJson;
    if (!scenario) {
      try {
        scenario = JSON.parse(graphEditorRef.current?.getGraphJSON() || '{}');
      } catch {}
    }
    if (!dataflow) {
      try {
        dataflow = JSON.parse(graphEditorRef.current?.getGraphJSON() || '{}');
      } catch {}
    }
    if (!scenario || !dataflow) {
      window.alert('Missing scenario or dataflow JSON');
      return;
    }
    try {
      const res = await fetch('/final-architecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, dataflow }),
      });
      if (!res.ok) {
        let errText = '';
        try {
          const errJson = await res.json();
          errText = errJson.detail || errJson.error || JSON.stringify(errJson);
        } catch (e) {
          errText = await res.text();
        }
        window.alert('Final Architecture failed: ' + errText);
        return;
      }
      const finalArchJson = await res.json();
      console.log('Final Architecture JSON:', finalArchJson);
      navigate('/final-architecture', { state: { finalArchJson } });
    } catch (err) {
      window.alert('Failed to call backend: ' + err);
    }
  };

  const navigate = useNavigate();

  const handleElaborateClick = async () => {
    if (!graphEditorRef.current?.validateGraph()) return;

    const jsonStr = graphEditorRef.current?.getGraphJSON();
    if (!jsonStr) return;

    try {
      const res = await fetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonStr,
      });
      if (!res.ok) {
        let errText = '';
        try {
          const errJson = await res.json();
          errText = errJson.detail || errJson.error || JSON.stringify(errJson);
        } catch (e) {
          errText = await res.text();
        }
        console.error('Analysis error', errText);
        window.alert('Analysis failed: ' + errText);
        return;
      }
      const resultJson = await res.json();
      console.log("Analysis result from backend:", resultJson);
      
      // The backend now returns an array of graph analyses.
      // The `Results` page expects a single `analysis` object and a `graphs` array.
      // We'll use the first item from the result as the main `analysis` object
      // and the full array as the `graphs` to be iterated over.
      if (Array.isArray(resultJson) && resultJson.length > 0) {
        const scenario = JSON.parse(jsonStr);
        navigate('/results', { state: { analysisResults: resultJson, scenario: scenario } });
      } else {
        // Handle cases where the response is not as expected.
        console.error("Unexpected analysis result format:", resultJson);
        window.alert("Analysis failed: Unexpected result format from server.");
      }
    } catch (err) {
      console.error('Failed to call analysis backend', err);
    }
  };

  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null);

  const rules = [
    'Producer nodes can only have outgoing arcs.',
    'Consumer nodes can only have incoming arcs.',
    'Merge nodes must have at least two incoming arcs and at least one outgoing arc.',
    'Processing nodes must have exactly one incoming arc and at least one outgoing arc.',
  ];

  return (
    <div className="App">
      <div className="sidebar">
        <h1 className="sidebar-title">Scenario Definition</h1>
        <div className="sidebar-scrollable-content">
          <div className="sidebar-controls">
            <button onClick={() => handleAddNode('active_p')}>Add Active Producer</button>
            <button onClick={() => handleAddNode('passive_p')}>Add Passive Producer</button>
            <button onClick={() => handleAddNode('pull_c')}>Add Pull Consumer</button>
            <button onClick={() => handleAddNode('push_c')}>Add Push Consumer</button>
            <button onClick={() => handleAddNode('merge')}>Add Merge Action</button>
            <button onClick={() => handleAddNode('processing')}>Add Processing Action</button>
            <button onClick={handleClearGraph} className="clear-button">Clear Graph</button>
          </div>
        </div>
        <div className="sidebar-footer">
          <button onClick={handleExportClick} className="export-button">
            Export JSON
          </button>
          <button onClick={handleElaborateClick} className="export-button">
            Elaborate Graph
          </button>

          <input
            id="fileUpload"
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const input = e.target as HTMLInputElement;
              const f = input.files && input.files[0];
              if (!f) return;
              try {
                const text = await f.text();
                // load directly into the editor
                graphEditorRef.current?.loadGraphFromJSON(text);
                // allow re-uploading the same file later by clearing the input value
                input.value = '';
                setUploadedFileName(f.name);
              } catch (err) {
                console.error('Invalid JSON file', err);
                input.value = '';
              }
            }}
          />
          <button
            onClick={() => document.getElementById('fileUpload')?.click()}
            className="export-button"
          >
            Upload JSON
          </button>
          {uploadedFileName && (
            <div style={{ marginTop: 8, fontSize: 12 }}>Loaded: {uploadedFileName}</div>
          )}
        </div>
      </div>
      <div className="main-content">
        <GraphEditor ref={graphEditorRef} />
      </div>
      <div className="sidebar right-sidebar">
        <h2 className="sidebar-title">Rules</h2>
        <div className="rules-list">
          <ul>
            {rules.map((rule, index) => (
              <li key={index}>{rule}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;