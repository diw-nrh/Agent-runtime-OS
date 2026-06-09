import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ success: false, error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const body = await request.json();

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found in database" }, { status: 404 });
    }

    let workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id }
    });

    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          name: 'My Workspace',
          ownerId: user.id
        }
      });
    }

    // 2. Save or Update Blueprint to Database
    let savedBlueprint;
    if (body.id) {
      savedBlueprint = await prisma.agentBlueprint.update({
        where: { id: body.id },
        data: {
          name: body.name || 'Untitled Blueprint',
          description: body.description || '',
          canvasData: body,
          workspaceId: workspace.id
        }
      });
    } else {
      savedBlueprint = await prisma.agentBlueprint.create({
        data: {
          name: body.name || 'Untitled Blueprint',
          description: body.description || '',
          canvasData: body, // Save the entire raw payload from React Flow
          workspaceId: workspace.id
        }
      });
    }

    // 3. Forward to Python Engine
    const pythonPayload = {
      ...body,
      id: savedBlueprint.id
    };

    // Extract BYOK headers from the frontend request
    const groqKey = request.headers.get('x-groq-api-key') || '';
    const openAiKey = request.headers.get('x-openai-api-key') || '';
    const localUrl = request.headers.get('x-local-ai-url') || '';

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const pythonResponse = await fetch(`${backendUrl}/api/agent/compile`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-groq-api-key': groqKey,
        'x-openai-api-key': openAiKey,
        'x-local-ai-url': localUrl
      },
      body: JSON.stringify(pythonPayload)
    });

    if (!pythonResponse.ok) {
      const errorText = await pythonResponse.text();
      throw new Error(`Python Engine Error: ${errorText}`);
    }

    const pythonData = await pythonResponse.json();

    return NextResponse.json({
      success: true,
      message: 'Blueprint saved and job submitted successfully.',
      databaseId: savedBlueprint.id,
      taskId: pythonData.task_id
    });

  } catch (err: unknown) {
    console.error("Failed to deploy blueprint:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Deployment failed" },
      { status: 500 }
    );
  }
}
