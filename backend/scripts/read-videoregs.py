import sys,json,sqlite3,os
from pathlib import Path
from cryptography.fernet import Fernet,InvalidToken
options=json.load(sys.stdin)
path=Path(sys.argv[1]).resolve()
connection=sqlite3.connect('file:'+str(path)+'?mode=ro',uri=True)
connection.execute('PRAGMA query_only=ON')
connection.row_factory=sqlite3.Row
rows=connection.execute('SELECT store_number,ip_hall,software_hall,login_hall,pass_hall FROM video_recorders LIMIT 10001').fetchall()
if len(rows)>10000:raise ValueError('В файле больше 10000 записей')
key=options.get('legacyKey','').strip()
cipher=Fernet(key.encode()) if key else None
result=[]
for row in rows:
    item=dict(row)
    for name in ['pass_hall']:
        value=item.get(name) or ''
        if value.startswith('gAAAA'):
            if not cipher:raise ValueError('Укажите ключ Fernet исходной базы для расшифровки паролей')
            try:value=cipher.decrypt(value.encode()).decode()
            except InvalidToken:raise ValueError('Неверный ключ Fernet исходной базы')
        item[name]=value
    result.append(item)
print(json.dumps(result,ensure_ascii=False))
