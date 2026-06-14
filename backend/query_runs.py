import psycopg, json
conn=psycopg.connect('postgresql://admin:password@localhost:5432/agent_db')
cur=conn.cursor()
cur.execute('SELECT "id", "status", "startedAt", "completedAt" FROM "AgentExecutionRun" ORDER BY "startedAt" DESC LIMIT 10')
rows=cur.fetchall()
print(json.dumps([{'id': r[0], 'status': r[1], 'startedAt': r[2], 'completedAt': r[3]} for r in rows], default=str, indent=2))
