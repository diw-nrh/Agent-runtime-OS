import { prisma } from "@/lib/prisma";
import { CanvasData, CanvasNode, CanvasEdge } from '@/types';
import { notFound } from "next/navigation";
import { NotebookClient } from "./NotebookClient";

import { Suspense } from "react";

export default async function NotebookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Fetch blueprint from database
  const blueprint = await prisma.agentBlueprint.findUnique({
    where: { id }
  });

  if (!blueprint) {
    notFound();
  }

  // Ensure we have valid JSON and extract nodes to pre-fill the notebook if available
  let initialNodes: CanvasNode[] = [];
  let initialEdges: CanvasEdge[] = [];

  try {
    const canvasData = blueprint.canvasData as unknown as CanvasData;
    if (canvasData) {
      if (Array.isArray(canvasData.nodes)) initialNodes = canvasData.nodes;
      if (Array.isArray(canvasData.edges)) initialEdges = canvasData.edges;
    }
  } catch (e) {
    console.error("Failed to parse canvasData", e);
  }

  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading Notebook...</div>}>
      <NotebookClient 
        projectId={id}
        blueprintId={blueprint.id}
        initialNodes={initialNodes}
        initialEdges={initialEdges}
      />
    </Suspense>
  );
}
