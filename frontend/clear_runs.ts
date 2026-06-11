import { prisma } from './src/lib/prisma';

async function main() {
  try {
    const result = await prisma.agentExecutionRun.updateMany({
      where: { status: 'RUNNING' },
      data: { status: 'ERROR' }
    });
    console.log(`Updated ${result.count} stuck runs to ERROR.`);
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

main();
