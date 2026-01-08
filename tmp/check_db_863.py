import sqlite3, os, json

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'ussd-simulator-standalone', 'data', 'ussd.db'))
print('DB:', db_path)
if not os.path.exists(db_path):
    print('DB file not found')
    raise SystemExit(1)

conn = sqlite3.connect(db_path)
cur = conn.cursor()
msisdn = '863456789'
q = "SELECT * FROM customers WHERE msisdn = ? OR phoneNumber = ? OR phone = ? OR phoneNumber LIKE ?"
cur.execute(q, (msisdn, msisdn, msisdn, msisdn + '%'))
rows = cur.fetchall()
if not rows:
    cur.execute('SELECT COUNT(*) FROM customers')
    total = cur.fetchone()[0]
    print('NOT FOUND', msisdn, 'total', total)
else:
    print('FOUND', len(rows), 'row(s):')
    # print rows as JSON-friendly
    col_names = [d[0] for d in cur.description]
    out = [dict(zip(col_names, r)) for r in rows]
    print(json.dumps(out, indent=2, ensure_ascii=False))

conn.close()
