import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { RunsViewerClient } from "./RunsViewerClient";

export default async function AuditLogsPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  
  const blueprint = await prisma.agentBlueprint.findUnique({
    where: { id },
  });

  if (!blueprint) {
    notFound();
  }

  // Fetch all runs associated with this blueprint, including trace steps
  const runs = await prisma.agentExecutionRun.findMany({
    where: { blueprintId: id },
    orderBy: { startedAt: "desc" },
    include: {
      traces: {
        orderBy: { stepIndex: "asc" }
      }
    }
  });

  let agents: {id: string, name: string}[] = [];
  try {
    if (blueprint.canvasData) {
      const parsed = typeof blueprint.canvasData === 'string' 
        ? JSON.parse(blueprint.canvasData) 
        : blueprint.canvasData;
      agents = parsed.agents || [];
    }
  } catch (e) {
    console.error("Failed to parse blueprint canvasData", e);
  }

  return <RunsViewerClient runs={runs} projectId={id} agents={agents} />;
}
