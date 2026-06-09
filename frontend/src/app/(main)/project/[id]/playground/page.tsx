import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PlaygroundClient } from "@/components/playground/PlaygroundClient";

export default async function PlaygroundPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  
  // Fetch blueprint from database
  const blueprint = await prisma.agentBlueprint.findUnique({
    where: { id }
  });

  if (!blueprint) {
    notFound();
  }

  // Pass necessary data to the Client Component
  // We parse canvasData so the client can use it to build ChatRequest
  let parsedCanvasData = { agents: [], nodes: [], edges: [] };
  try {
    if (blueprint.canvasData) {
      parsedCanvasData = blueprint.canvasData as any;
    }
  } catch (e) {
    console.error("Failed to parse canvasData in playground", e);
  }

  const blueprintPayload = {
    id: blueprint.id,
    version: "1.0",
    name: blueprint.name || "Project",
    agents: parsedCanvasData.agents || [],
    nodes: parsedCanvasData.nodes || [],
    edges: parsedCanvasData.edges || []
  };

  return (
    <PlaygroundClient 
      blueprint={blueprintPayload} 
    />
  );
}

