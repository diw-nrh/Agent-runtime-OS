import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Fetch all tools including their versions
    const tools = await prisma.mcpTool.findMany({
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        author: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({ success: true, data: tools });
  } catch (error) {
    console.error("Failed to fetch MCP tools:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, config, authorId } = body;
    
    let finalAuthorId = authorId;
    
    // Fallback: If no real authorId is provided, just pick the first user from DB (Demo mode)
    if (!finalAuthorId || finalAuthorId === "user-uuid-here") {
      const firstUser = await prisma.user.findFirst();
      if (!firstUser) {
        return NextResponse.json({ success: false, error: "No users found in database to assign as author" }, { status: 400 });
      }
      finalAuthorId = firstUser.id;
    }

    // Create the tool and its first version (1.0.0) in a transaction
    const tool = await prisma.$transaction(async (tx: any) => {
      const newTool = await tx.mcpTool.create({
        data: {
          name,
          description,
          authorId: finalAuthorId,
          isPublic: true,
        }
      });
      
      await tx.mcpToolVersion.create({
        data: {
          version: "1.0.0",
          config: config, // e.g., { command: "npx", args: ["..."] }
          changelog: "Initial release",
          toolId: newTool.id
        }
      });
      
      return newTool;
    });

    return NextResponse.json({ success: true, data: tool });
  } catch (error) {
    console.error("Failed to publish MCP tool:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
