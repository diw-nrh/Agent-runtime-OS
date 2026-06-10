import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { NotebookClient } from "./NotebookClient";

export default async function NotebookPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  
  // Fetch blueprint from database
  const blueprint = await prisma.agentBlueprint.findUnique({
    where: { id }
  });

  if (!blueprint) {
    notFound();
  }

  // Ensure we have valid JSON and extract nodes to pre-fill the notebook if available
  let initialNodes: any[] = [];
  let initialEdges: any[] = [];
  
  try {
    const canvasData = blueprint.canvasData as any;
    if (canvasData) {
      if (Array.isArray(canvasData.nodes)) initialNodes = canvasData.nodes;
      if (Array.isArray(canvasData.edges)) initialEdges = canvasData.edges;
    }
  } catch (e) {
    console.error("Failed to parse canvasData", e);
  }

  return (
    <NotebookClient 
      projectId={id}
      blueprintId={blueprint.id}
      initialNodes={initialNodes}
      initialEdges={initialEdges}
    />
  );
}
