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

    // Save or Update Blueprint to Database
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

    return NextResponse.json({
      success: true,
      message: 'Blueprint saved successfully.',
      databaseId: savedBlueprint.id,
    });

  } catch (err: unknown) {
    console.error("Failed to save blueprint:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 }
    );
  }
}
