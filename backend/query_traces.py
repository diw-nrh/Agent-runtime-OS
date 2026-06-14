import psycopg, json
conn=psycopg.connect('postgresql://admin:password@localhost:5432/agent_db')
cur=conn.cursor()
cur.execute('SELECT "runId", "createdAt", type FROM "AgentTraceStep" ORDER BY "createdAt" DESC LIMIT 5')
rows=cur.fetchall()
print(json.dumps([{'runId': r[0], 'createdAt': r[1], 'type': r[2]} for r in rows], default=str, indent=2))
