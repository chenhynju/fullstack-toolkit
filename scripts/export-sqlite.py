"""Read a stopped/consistent legacy SQLite snapshot; write a private migration packet."""
import hashlib,json,os,sqlite3,sys
from pathlib import Path

source=Path(sys.argv[1]).resolve();target=Path(sys.argv[2]).resolve()
if not source.is_file():raise SystemExit('SQLite snapshot not found')
if target.exists():raise SystemExit('Refusing to overwrite migration packet')
connection=sqlite3.connect(source.as_uri()+'?mode=ro',uri=True)
connection.row_factory=sqlite3.Row
tables={row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'") if not row[0].startswith('sqlite_') and row[0]!='_prisma_migrations'}
if tables!={'User','Session','Project'}:raise SystemExit('Unsupported legacy business tables; explicit mapping required before migration')
expected={'User':{'id','email','name','createdAt','passwordHash','role'},'Session':{'id','tokenHash','userId','expiresAt'},'Project':{'id','title','description','status','ownerId','createdAt','updatedAt'}}
for table,columns in expected.items():
    actual={row[1] for row in connection.execute('PRAGMA table_info("'+table+'")')}
    if actual!=columns:raise SystemExit('Unsupported legacy columns; explicit mapping required before migration')
with connection:
    rows={table:[dict(row) for row in connection.execute('SELECT * FROM "'+table+'" ORDER BY id')] for table in ['User','Session','Project']}
connection.close()
packet={'version':1,'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'tables':rows}
target.parent.mkdir(parents=True,exist_ok=True)
descriptor=os.open(target,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
with os.fdopen(descriptor,'w',encoding='utf-8') as f:json.dump(packet,f,ensure_ascii=False)
print(json.dumps({'exported':{key:len(value) for key,value in rows.items()},'sourceSHA256':packet['sourceSHA256']}))
