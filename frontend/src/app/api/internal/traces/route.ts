import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    // 1. Basic Security Check (Internal API only)
    const authHeader = request.headers.get('Authorization');
    const expectedSecret = process.env.INTERNAL_API_SECRET || 'nodebook-secret-dev';
    
    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized Internal API call" }, { status: 401 });
    }

    const body = await request.json();
    const { action, runId, blueprintId, status, stepIndex, agentId, type, content } = body;

    // Action: CREATE_RUN
    if (action === 'CREATE_RUN') {
      const run = await prisma.agentExecutionRun.create({
        data: {
          id: runId, // Pass task_id from celery as runId
          blueprintId: (blueprintId && blueprintId !== 'temp-id') ? blueprintId : undefined,
          status: 'RUNNING'
        }
      });
      return NextResponse.json({ success: true, run });
    }
    
    // Action: UPDATE_STATUS
    if (action === 'UPDATE_STATUS') {
      const run = await prisma.agentExecutionRun.update({
        where: { id: runId },
        data: {
          status: status,
          completedAt: (status === 'COMPLETED' || status === 'ERROR') ? new Date() : null
        }
      });
      return NextResponse.json({ success: true, run });
    }
    
    // Action: ADD_TRACE
    if (action === 'ADD_TRACE') {
      const trace = await prisma.agentTraceStep.create({
        data: {
          runId: runId,
          stepIndex: stepIndex,
          agentId: agentId || null,
          type: type,
          content: content // Json object
        }
      });
      return NextResponse.json({ success: true, trace });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Internal Trace API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const expectedSecret = process.env.INTERNAL_API_SECRET || 'nodebook-secret-dev';
    
    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized Internal API call" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');
    if (!runId) return NextResponse.json({ error: "Missing runId" }, { status: 400 });

    const traces = await prisma.agentTraceStep.findMany({
      where: { runId },
      orderBy: { stepIndex: 'asc' }
    });

    return NextResponse.json({ traces });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
