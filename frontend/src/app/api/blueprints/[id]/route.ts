import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
    await prisma.agentBlueprint.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting blueprint:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Blueprint ID is required' }, { status: 400 });
    }

    const blueprint = await prisma.agentBlueprint.findFirst({
      where: { id, deletedAt: null },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          }
        }
      }
    });

    if (!blueprint) {
      return NextResponse.json({ success: false, error: 'Blueprint not found' }, { status: 404 });
    }

    // Mask secret key before sending to frontend
    const hasLangfuseSecret = !!blueprint.langfuseSecretKeyEncrypted;
    // @ts-ignore
    delete blueprint.langfuseSecretKeyEncrypted;

    return NextResponse.json({ success: true, blueprint: { ...blueprint, hasLangfuseSecret } });
  } catch (error: unknown) {
    console.error("Error fetching blueprint:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

import { encrypt } from '@/lib/crypto';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Blueprint ID is required' }, { status: 400 });
    }

    const updateData: any = {
      name: body.name,
      description: body.description,
    };

    if (body.langfusePublicKey !== undefined) {
      updateData.langfusePublicKey = body.langfusePublicKey;
    }
    if (body.langfuseHost !== undefined) {
      updateData.langfuseHost = body.langfuseHost;
    }
    if (body.langfuseSecretKey) {
      updateData.langfuseSecretKeyEncrypted = encrypt(body.langfuseSecretKey);
    } else if (body.langfuseSecretKey === "") {
      updateData.langfuseSecretKeyEncrypted = null; // allow clearing
    }

    const updatedBlueprint = await prisma.agentBlueprint.update({
      where: { id },
      data: updateData
    });

    const hasLangfuseSecret = !!updatedBlueprint.langfuseSecretKeyEncrypted;
    // @ts-ignore
    delete updatedBlueprint.langfuseSecretKeyEncrypted;

    return NextResponse.json({ success: true, blueprint: { ...updatedBlueprint, hasLangfuseSecret } });
  } catch (error: unknown) {
    console.error("Error updating blueprint:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
