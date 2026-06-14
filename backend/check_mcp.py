import psycopg

with psycopg.connect('postgresql://admin:password@postgres:5432/agent_db') as conn:
    with conn.cursor() as cur:
        cur.execute('SELECT * FROM "McpToolVersion"')
        for row in cur.fetchall():
            print(row)
