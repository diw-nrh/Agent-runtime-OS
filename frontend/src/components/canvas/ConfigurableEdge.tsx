import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  useReactFlow
} from '@xyflow/react';

export default function ConfigurableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const mode = data?.mode || 'delegate';
  const label = mode === 'delegate' ? 'Delegate' : 'Next';
  const badgeColor = mode === 'delegate' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-blue-100 text-blue-700 border-blue-200';

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    // Dispatch a custom event that CanvasEditor can listen to
    const customEvent = new CustomEvent('openEdgeModal', { detail: { edgeId: id } });
    window.dispatchEvent(customEvent);
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 10,
            pointerEvents: 'all',
          }}
          className="nodrag nopan flex items-center gap-1 group"
        >
          <button
            onClick={onEdgeClick}
            className={`px-2 py-0.5 rounded-full border shadow-sm font-semibold hover:scale-105 transition-transform ${badgeColor}`}
            title="Edit Connection"
          >
            {label}
          </button>
          <button
            onClick={(evt) => {
              evt.stopPropagation();
              setEdges((edges) => edges.filter((e) => e.id !== id));
            }}
            className="p-1 rounded-full bg-background border shadow-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-white hover:border-destructive transition-all"
            title="Delete Connection"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
