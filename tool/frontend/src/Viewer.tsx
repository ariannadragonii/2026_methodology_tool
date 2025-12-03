import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GraphEditor from './GraphEditor';

const Viewer: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const graph = (location.state as any)?.graph;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 10, background: '#fff', borderBottom: '1px solid #ddd' }}>
        <button onClick={() => navigate(-1)}>Back</button>
      </div>
      <div style={{ flex: 1 }}>
        <GraphEditor initialGraph={graph} readOnly={true} />
      </div>
    </div>
  );
};

export default Viewer;
