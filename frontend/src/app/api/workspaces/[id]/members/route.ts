import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// GET: List all members of a workspace
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Verify user is the owner or a member/collaborator of the workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        deletedAt: null,
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } }
        ]
      }
    });

    if (!workspace) {
      return NextResponse.json({ success: false, error: "Workspace not found or access denied" }, { status: 404 });
    }

    console.log(`[Process] Listing members for workspace: ${workspaceId}`);
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        }
      }
    });

    return NextResponse.json({ success: true, members });
  } catch (err: unknown) {
    console.error("[Error] Failed to list members:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "List members failed" },
      { status: 500 }
    );
  }
}

// POST: Add / invite a collaborator by email
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Verify that ONLY the owner can add/invite collaborators
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        ownerId: user.id,
        deletedAt: null
      }
    });

    if (!workspace) {
      return NextResponse.json({ success: false, error: "Only the workspace owner can add collaborators" }, { status: 403 });
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    // Find target user by email
    const targetUser = await prisma.user.findUnique({
      where: { email }
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: "User with this email not found" }, { status: 404 });
    }

    // Cannot add yourself
    if (targetUser.id === user.id) {
      return NextResponse.json({ success: false, error: "Cannot add yourself as a collaborator" }, { status: 400 });
    }

    // Check if already exists in workspace (member or owner)
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUser.id
        }
      }
    });

    if (existingMember) {
      return NextResponse.json({ success: false, error: "User is already a member or pending invite" }, { status: 400 });
    }

    console.log(`[Process] Inviting collaborator ${email} to workspace ${workspaceId}`);
    const newMember = await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: targetUser.id,
        role: role || 'MEMBER',
        status: 'PENDING'
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json({ success: true, member: newMember });
  } catch (err: unknown) {
    console.error("[Error] Failed to add collaborator:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Add collaborator failed" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a collaborator or leave workspace
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        deletedAt: null
      }
    });

    if (!workspace) {
      return NextResponse.json({ success: false, error: "Workspace not found" }, { status: 404 });
    }

    // Try parsing target userId from body or URL query
    let targetUserId: string | null = null;
    try {
      const body = await request.json();
      targetUserId = body.userId || null;
    } catch {
      const { searchParams } = new URL(request.url);
      targetUserId = searchParams.get('userId');
    }

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: "User ID to remove is required" }, { status: 400 });
    }

    // Authorization: Must be workspace owner OR target must be the user themselves (leaving)
    const isOwner = workspace.ownerId === user.id;
    const isSelf = targetUserId === user.id;

    if (!isOwner && !isSelf) {
      return NextResponse.json({ success: false, error: "Unauthorized to remove this member" }, { status: 403 });
    }

    console.log(`[Process] Removing member ${targetUserId} from workspace ${workspaceId}`);
    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUserId
        }
      }
    });

    return NextResponse.json({ success: true, message: "Member successfully removed" });
  } catch (err: unknown) {
    console.error("[Error] Failed to remove member:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Remove member failed" },
      { status: 500 }
    );
  }
}
