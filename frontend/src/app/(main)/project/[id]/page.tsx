import { prisma } from "@/lib/prisma";
import { CanvasData, CanvasNode, CanvasEdge } from '@/types';
import { notFound } from "next/navigation";
import { CanvasLayoutClient } from "@/components/canvas/CanvasLayoutClient";

// Server Component
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Fetch blueprint from database
  const blueprint = await prisma.agentBlueprint.findUnique({
    where: { id }
  });

  if (!blueprint) {
    notFound();
  }

  // Ensure we have valid JSON and extract nodes/edges
  let initialNodes: CanvasNode[] = [];
  let initialEdges: CanvasEdge[] = [];
  
  if (blueprint && blueprint.canvasData) {
    const canvasData = blueprint.canvasData as unknown as CanvasData;
    if (canvasData) {
      if (Array.isArray(canvasData.nodes)) {
        initialNodes = canvasData.nodes.map((node: CanvasNode, index: number) => ({
          ...node,
          position: node.position || { x: 100, y: 100 + (index * 150) } // Fallback for old saved data
        }));
      }
      if (Array.isArray(canvasData.edges)) {
        initialEdges = canvasData.edges.map((edge: CanvasEdge, index: number) => ({
          ...edge,
          id: edge.id || `fallback-edge-${index}-${edge.source}-${edge.target}`
        }));
      }
    }
  }

  return (
    <CanvasLayoutClient 
      blueprintId={blueprint.id}
      projectName={blueprint.name || 'Project'}
      initialNodes={initialNodes.length > 0 ? initialNodes : undefined}
      initialEdges={initialEdges.length > 0 ? initialEdges : undefined}
    />
  );
}
