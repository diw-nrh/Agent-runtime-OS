import psycopg, json
conn=psycopg.connect('postgresql://admin:password@localhost:5432/agent_db')
cur=conn.cursor()
cur.execute('SELECT id, name, "canvasData" FROM "AgentBlueprint"')
rows=cur.fetchall()
res = []
for r in rows:
    cd = r[2] if r[2] else {}
    if isinstance(cd, str): cd = json.loads(cd)
    res.append({
        'id': r[0],
        'name': r[1],
        'nodes_len': len(cd.get('nodes', [])),
        'agents_len': len(cd.get('agents', []))
    })
print(json.dumps(res, indent=2))
