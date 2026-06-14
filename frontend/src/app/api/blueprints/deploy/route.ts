import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { McpToolConfig } from '@/types';

interface DeployPayloadTool {
  id: string;
  isGlobal?: boolean;
  name?: string;
  type?: string;
  url?: string;
  command?: string;
  args?: string[];
}

interface DeployPayloadAgent {
  id: string;
  tools?: DeployPayloadTool[];
  [key: string]: unknown;
}

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

    // 3. Resolve Global Tools efficiently
    // Extract all global tool IDs
    const globalToolIds = new Set<string>();
    body.agents.forEach((agent: DeployPayloadAgent) => {
      (agent.tools || []).forEach((tool: DeployPayloadTool) => {
        if (tool.isGlobal) {
          globalToolIds.add(tool.id);
        }
      });
    });

    // Fetch all global tools in one query
    const globalToolsMap = new Map();
    if (globalToolIds.size > 0) {
      const globalTools = await prisma.mcpTool.findMany({
        where: { id: { in: Array.from(globalToolIds) } },
        include: {
          versions: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });
      
      globalTools.forEach(tool => {
        if (tool.versions && tool.versions.length > 0) {
          const config = tool.versions[0].config as unknown as McpToolConfig & { type?: string };
          globalToolsMap.set(tool.id, {
            id: tool.id,
            name: tool.name,
            type: config?.type || 'sse',
            url: config?.url,
            command: config?.command,
            args: config?.args
          });
        }
      });
    }

    const enrichedAgents = body.agents.map((agent: DeployPayloadAgent) => {
      const enrichedTools = (agent.tools || []).map((tool: DeployPayloadTool) => {
        if (tool.isGlobal) {
          const globalToolConfig = globalToolsMap.get(tool.id);
          if (globalToolConfig) return globalToolConfig;
        }
        return tool; // Custom tool already has config from frontend
      });
      return { ...agent, tools: enrichedTools };
    });

    // 4. Forward to Python Engine
    const pythonPayload = {
      ...body,
      id: savedBlueprint.id,
      agents: enrichedAgents
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

  } catch (error: unknown) {
    console.error("Error submitting run:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
