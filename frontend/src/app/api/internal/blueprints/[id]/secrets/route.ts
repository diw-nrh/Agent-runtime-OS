import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check internal API secret
    const authHeader = request.headers.get('authorization');
    const internalSecret = process.env.INTERNAL_API_SECRET;
    
    if (!internalSecret || authHeader !== `Bearer ${internalSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Blueprint ID is required' }, { status: 400 });
    }

    const blueprint = await prisma.agentBlueprint.findUnique({
      where: { id },
      select: {
        langfusePublicKey: true,
        langfuseSecretKeyEncrypted: true,
        langfuseHost: true,
      }
    });

    if (!blueprint) {
      return NextResponse.json({ success: false, error: 'Blueprint not found' }, { status: 404 });
    }

    let decryptedSecret = null;
    if (blueprint.langfuseSecretKeyEncrypted) {
      try {
        decryptedSecret = decrypt(blueprint.langfuseSecretKeyEncrypted);
      } catch (e) {
        console.error(`Failed to decrypt langfuse secret for blueprint ${id}`, e);
      }
    }

    return NextResponse.json({ 
      success: true, 
      secrets: {
        langfusePublicKey: blueprint.langfusePublicKey,
        langfuseSecretKey: decryptedSecret,
        langfuseHost: blueprint.langfuseHost
      }
    });
  } catch (error: unknown) {
    console.error("Error fetching blueprint secrets:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
