import { prisma } from "@/lib/prisma";
import { CanvasData, CanvasNode, AgentNodeData } from "@/types";
import { notFound } from "next/navigation";
import { PlaygroundClient } from "@/components/playground/PlaygroundClient";

export const dynamic = "force-dynamic";

export default async function PlaygroundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Fetch blueprint from database
  const blueprint = await prisma.agentBlueprint.findUnique({
    where: { id }
  });

  if (!blueprint) {
    notFound();
  }

  // Pass necessary data to the Client Component
  let parsedCanvasData: CanvasData = { nodes: [], edges: [] };
  try {
    if (blueprint.canvasData) {
      if (typeof blueprint.canvasData === 'string') {
        parsedCanvasData = JSON.parse(blueprint.canvasData);
      } else {
        parsedCanvasData = blueprint.canvasData as unknown as CanvasData;
      }
    }
  } catch (e) {
    console.error("Failed to parse canvasData in playground", e);
  }

  const blueprintPayload = {
    id: blueprint.id,
    version: "1.0",
    name: blueprint.name || "Project",
    agents: (parsedCanvasData.nodes || []).filter((n: CanvasNode) => n.type === 'agent').map((n: CanvasNode) => {
      // Cast the node data since we know it's an agent node
      const data = n.data as AgentNodeData;
      const executionSettings = data.executionSettings as Record<string, number> | undefined;
      return {
        id: n.id,
        name: (data.name as string) || data.label || 'Agent',
        systemPrompt: data.systemPrompt || '',
        llmProvider: (data.provider as string) || (data.llmProvider as string) || 'openai',
        modelId: (data.model as string) || (data.modelId as string) || 'openai/gpt-4o-mini',
        tools: data.tools || [],
        credentials: data.credentials || {},
        maxToolCalls: executionSettings?.maxToolCalls ?? data.maxToolCalls ?? 1,
        maxHandoffBounces: executionSettings?.maxHandoffBounces ?? data.maxHandoffBounces ?? 1,
        maxMemoryMessages: executionSettings?.maxMemoryMessages ?? data.maxMemoryMessages ?? 10,
        agentNote: (data.agentNote as string) || null
      };
    }),
    nodes: parsedCanvasData.nodes || [],
    edges: parsedCanvasData.edges || []
  };

  return (
    <PlaygroundClient 
      blueprint={blueprintPayload} 
    />
  );
}

