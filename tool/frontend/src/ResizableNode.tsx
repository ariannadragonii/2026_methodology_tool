import React, { useRef, useState } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';

const ResizableNode: React.FC<NodeProps> = ({ data, selected }) => {
  const [dimensions, setDimensions] = useState({ width: 150, height: 100 });
  const resizingRef = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startDim = useRef({ width: 150, height: 100 });

  const onMouseDown = (event: React.MouseEvent) => {
    event.stopPropagation();
    resizingRef.current = true;
    startPos.current = { x: event.clientX, y: event.clientY };
    startDim.current = { ...dimensions };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!resizingRef.current) return;

    const deltaX = event.clientX - startPos.current.x;
    const deltaY = event.clientY - startPos.current.y;

    const newWidth = Math.max(100, startDim.current.width + deltaX);
    const newHeight = Math.max(80, startDim.current.height + deltaY);

    setDimensions({ width: newWidth, height: newHeight });
  };

  const onMouseUp = () => {
    resizingRef.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      style={{
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: data?.color || '#fff',
        border: selected ? '2px solid #0077cc' : '1px solid #ccc',
        borderRadius: 5,
        padding: 10,
        position: 'relative',
        overflow: 'visible',
        userSelect: 'none', // evita selezioni accidentali
      }}
    >
      <div>{data.label}</div>
      <div
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute',
          width: 15,
          height: 15,
          background: '#0077cc',
          bottom: 0,
          right: 0,
          cursor: 'se-resize',
          borderRadius: 3,
          userSelect: 'none',
          zIndex: 10,
        }}
      />
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default ResizableNode;