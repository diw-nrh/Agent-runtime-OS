import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    // 1. Authenticate user session
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch session user's database record
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const { workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: "Workspace ID is required" }, { status: 400 });
    }

    // 4. Verify workspace exists and is active (not soft-deleted)
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        deletedAt: null
      }
    });

    if (!workspace) {
      return NextResponse.json({ success: false, error: "Workspace not found or inactive" }, { status: 404 });
    }

    // 5. Look up the membership record
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.id
        }
      }
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "No pending invitation found for this workspace" }, { status: 403 });
    }

    // 6. Handle already active members gracefully
    if (member.status === 'ACTIVE') {
      return NextResponse.json({ success: true, message: "Already a member of this workspace", member });
    }

    // 7. Transition status from PENDING to ACTIVE
    const updatedMember = await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.id
        }
      },
      data: {
        status: 'ACTIVE'
      }
    });

    console.log(`[Process] User ${user.email} successfully joined workspace ${workspaceId}`);
    return NextResponse.json({ success: true, member: updatedMember });
  } catch (error: unknown) {
    console.error("[Error] Join workspace failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Join workspace failed" },
      { status: 500 }
    );
  }
}
