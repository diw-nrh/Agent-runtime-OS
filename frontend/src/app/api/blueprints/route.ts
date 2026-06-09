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
        ...(workspaceId && { workspaceId })
      }
    });

    return NextResponse.json({ success: true, blueprint: newBlueprint });
  } catch (error: any) {
    console.error("Error creating blueprint:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
