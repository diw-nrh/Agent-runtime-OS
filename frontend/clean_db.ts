import { prisma } from './src/lib/prisma';

async function main() {
  console.log('Cleaning up duplicate AgentBlueprints...');
  const result = await prisma.agentBlueprint.deleteMany({});
  console.log(`Deleted ${result.count} blueprints.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
