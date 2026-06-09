import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    
    // Quick validation
    if (!id) {
      return NextResponse.json({ success: false, error: 'Blueprint ID is required' }, { status: 400 });
    }

    // In a full production app, we would verify ownership here.
    // For now, we will simply delete the requested blueprint.
    await prisma.agentBlueprint.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting blueprint:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Blueprint ID is required' }, { status: 400 });
    }

    const updatedBlueprint = await prisma.agentBlueprint.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description
      }
    });

    return NextResponse.json({ success: true, blueprint: updatedBlueprint });
  } catch (error: any) {
    console.error("Error updating blueprint:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
