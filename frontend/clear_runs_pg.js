const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://admin:password@localhost:5432/agent_db?schema=public'
});

async function main() {
  await client.connect();
  const res = await client.query("UPDATE \"AgentExecutionRun\" SET status = 'ERROR' WHERE status = 'RUNNING'");
  console.log('Updated ' + res.rowCount + ' stuck runs to ERROR.');
  await client.end();
}
main().catch(console.error);
