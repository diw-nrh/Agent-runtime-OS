import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CanvasLayoutClient } from "@/components/canvas/CanvasLayoutClient";

// Server Component
export default async function ProjectPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  
  // Fetch blueprint from database
  const blueprint = await prisma.agentBlueprint.findUnique({
    where: { id }
  });

  if (!blueprint) {
    notFound();
  }

  // Ensure we have valid JSON and extract nodes/edges
  let initialNodes = [];
  let initialEdges = [];
  
  try {
    const canvasData = blueprint.canvasData as any;
    if (canvasData) {
      if (Array.isArray(canvasData.nodes)) {
        initialNodes = canvasData.nodes.map((node: any, index: number) => ({
          ...node,
          position: node.position || { x: 100, y: 100 + (index * 150) } // Fallback for old saved data
        }));
      }
      if (Array.isArray(canvasData.edges)) {
        initialEdges = canvasData.edges.map((edge: any, index: number) => ({
          ...edge,
          id: edge.id || `fallback-edge-${index}-${edge.source}-${edge.target}`
        }));
      }
    }
  } catch (e) {
    console.error("Failed to parse canvasData", e);
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
