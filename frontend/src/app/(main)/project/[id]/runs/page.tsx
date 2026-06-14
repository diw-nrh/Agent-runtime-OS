import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { RunsViewerClient, Run } from "./RunsViewerClient";
import { TraceContentData } from "@/types";

export default async function AuditLogsPage({ params }: { params: Promise<{ id: string }> }) {
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

  const mappedRuns = runs.map(r => ({
    ...r,
    traces: r.traces.map(t => ({
      ...t,
      content: t.content as unknown as TraceContentData
    }))
  }));

  return <RunsViewerClient runs={mappedRuns as Run[]} projectId={id} agents={agents} />;
}
