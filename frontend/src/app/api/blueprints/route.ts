import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    
    if (!body.name) {
      return NextResponse.json({ success: false, error: 'Project name is required' }, { status: 400 });
    }

    let workspaceId = null;

    // If authenticated, link to their workspace
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { workspaces: true }
      });
      if (user && user.workspaces.length > 0) {
        workspaceId = user.workspaces[0].id;
      }
    }

    if (!workspaceId) {
      const fallbackWorkspace = await prisma.workspace.findFirst();
      if (fallbackWorkspace) {
        workspaceId = fallbackWorkspace.id;
      } else {
        return NextResponse.json({ success: false, error: 'No workspace found. Please login or create a workspace first.' }, { status: 400 });
      }
    }

    // Create the new empty blueprint
    const newBlueprint = await prisma.agentBlueprint.create({
      data: {
        name: body.name,
        description: body.description || '',
        canvasData: {
          nodes: [],
          edges: [],
          agents: [],
          metadata: {}
        },
        workspaceId: workspaceId
      }
    });

    return NextResponse.json({ success: true, blueprint: newBlueprint });
  } catch (error: unknown) {
    console.error("Error creating blueprint:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
