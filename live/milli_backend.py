"""ミリしら：private-link character questionnaires, backed by the master's SQLite DB.
No canonical character spoilers are stored or returned to respondents.
"""
import hashlib
import hmac
import json
import re
import secrets
import time
from aiohttp import web

TTL = 30 * 86400
MAX_FORMS = 80
MAX_RESPONSES = 150
MAX_BODY = 750000
IMAGE_PATTERN = re.compile(r'^data:image/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')

class MilliService:
    def __init__(self, master):
        self.master = master
        self.db = master.db
        self.db.execute('CREATE TABLE IF NOT EXISTS milli_forms (id TEXT PRIMARY KEY, key_hash TEXT NOT NULL, created REAL NOT NULL, expires REAL NOT NULL, spec TEXT NOT NULL)')
        self.db.execute('CREATE TABLE IF NOT EXISTS milli_responses (id INTEGER PRIMARY KEY AUTOINCREMENT, form_id TEXT NOT NULL, created REAL NOT NULL, player TEXT NOT NULL, answers TEXT NOT NULL)')
        self.db.execute('CREATE INDEX IF NOT EXISTS milli_response_form ON milli_responses(form_id,created)')
        self.db.commit()

    def check_published(self):
        if not self.master.published('millishira'):
            raise web.HTTPForbidden(text='ミリしらは現在非公開です')

    def clean(self):
        now = time.time()
        self.db.execute('DELETE FROM milli_responses WHERE form_id IN (SELECT id FROM milli_forms WHERE expires<?)',(now,))
        self.db.execute('DELETE FROM milli_forms WHERE expires<?',(now,))
        self.db.commit()

    @staticmethod
    def strval(value, maximum, minimum=0):
        if not isinstance(value,str):raise ValueError('文字列の形式が不正です')
        s=value.strip()
        if not minimum<=len(s)<=maximum:raise ValueError('文字数を確認してください')
        return s

    def validate(self, raw):
        if not isinstance(raw,dict):raise ValueError('セットの形式が不正です')
        title=self.strval(raw.get('title'),85,2)
        series=self.strval(raw.get('series',''),85)
        items=raw.get('characters')
        if not isinstance(items,list) or not 1<=len(items)<=20:raise ValueError('キャラクターは1〜20人までです')
        validated=[];used=set()
        for i,item in enumerate(items):
            if not isinstance(item,dict):raise ValueError('キャラの項目が不正です')
            cid=self.strval(item.get('id'),42,3)
            if not re.fullmatch(r'[a-zA-Z0-9_-]{3,42}',cid) or cid in used:raise ValueError('キャラのIDが重複しています')
            used.add(cid)
            label=self.strval(item.get('label','キャラクター '+str(i+1)),70,1)
            img=item.get('image','')
            if not isinstance(img,str) or len(img)>110000 or (img and not (IMAGE_PATTERN.fullmatch(img) or (img.startswith('https://') and re.fullmatch(r'https://[^\s<>"\']{1,1000}',img)))):
                raise ValueError('画像URLまたは画像データが不正です')
            fields=item.get('fields')
            if not isinstance(fields,list) or not 1<=len(fields)<=16:raise ValueError('質問はキャラごとに1〜16問です')
            clean_fields=[];field_ids=set()
            for q in fields:
                if not isinstance(q,dict):raise ValueError('質問の形式が不正です')
                qid=self.strval(q.get('id'),42,3)
                if not re.fullmatch(r'[a-zA-Z0-9_-]{3,42}',qid) or qid in field_ids:raise ValueError('質問IDが重複しています')
                field_ids.add(qid)
                kind=q.get('type')
                if kind not in ('short','long','choice'):raise ValueError('質問形式が不正です')
                options=q.get('options',[]) if kind=='choice' else []
                if not isinstance(options,list) or (kind=='choice' and not 2<=len(options)<=12):raise ValueError('選択肢は2〜12個までです')
                options=[self.strval(s,70,1) for s in options]
                clean_fields.append({'id':qid,'label':self.strval(q.get('label'),90,1),'type':kind,'options':options})
            validated.append({'id':cid,'label':label,'image':img,'fields':clean_fields})
        spec={'v':1,'title':title,'series':series,'characters':validated}
        if len(json.dumps(spec,ensure_ascii=False).encode())>650000:raise ValueError('画像を含むセットは650KB以内にしてください')
        return spec

    async def publish(self, request):
        self.check_published()
        if request.content_length and request.content_length>MAX_BODY:raise web.HTTPRequestEntityTooLarge(max_size=MAX_BODY,actual_size=request.content_length)
        try: spec=self.validate(await request.json())
        except (ValueError,TypeError,json.JSONDecodeError) as exc:raise web.HTTPBadRequest(text=str(exc))
        self.clean()
        num=self.db.execute('SELECT COUNT(*) FROM milli_forms').fetchone()[0]
        if num>=MAX_FORMS:raise web.HTTPTooManyRequests(text='共有セットの上限に達しています')
        ident=secrets.token_urlsafe(13);key=secrets.token_urlsafe(25);now=time.time()
        self.db.execute('INSERT INTO milli_forms(id,key_hash,created,expires,spec) VALUES(?,?,?,?,?)',
                        (ident,hashlib.sha256(key.encode()).hexdigest(),now,now+TTL,json.dumps(spec,ensure_ascii=False)))
        self.db.commit()
        return web.json_response({'id':ident,'ownerKey':key,'expiresDays':30},headers={'Cache-Control':'no-store'})

    def get(self, ident):
        self.clean()
        row=self.db.execute('SELECT * FROM milli_forms WHERE id=?',(ident,)).fetchone()
        if not row:raise web.HTTPNotFound(text='セットが見つかりません（期限切れ・再デプロイの可能性があります）')
        return row

    async def public(self,request):
        self.check_published()
        row=self.get(request.match_info['id'])
        return web.json_response({'spec':json.loads(row['spec']),'expiresAt':row['expires']},headers={'Cache-Control':'no-store'})

    async def submit(self,request):
        self.check_published()
        if request.content_length and request.content_length>110000:raise web.HTTPRequestEntityTooLarge(max_size=110000,actual_size=request.content_length)
        row=self.get(request.match_info['id']);spec=json.loads(row['spec'])
        try:
            raw=await request.json();name=self.strval(raw.get('name',''),24,1)
            answers=raw.get('answers')
            if not isinstance(answers,dict):raise ValueError('回答の形式が不正です')
            expected={item['id']:{q['id']:q for q in item['fields']} for item in spec['characters']}
            if set(answers)!=set(expected):raise ValueError('すべてのキャラクターに回答してください')
            saved={}
            for cid,fields in expected.items():
                val=answers[cid]
                if not isinstance(val,dict) or set(val)!=set(fields):raise ValueError('質問に漏れがあります')
                saved[cid]={}
                for fid,q in fields.items():
                    answer=self.strval(val[fid],600)
                    if q['type']=='choice' and answer and answer not in q['options']:raise ValueError('選択肢にない回答です')
                    saved[cid][fid]=answer
            if len(json.dumps(saved,ensure_ascii=False).encode())>65000:raise ValueError('回答が長すぎます')
        except (ValueError,TypeError,KeyError,json.JSONDecodeError) as exc:raise web.HTTPBadRequest(text=str(exc))
        n=self.db.execute('SELECT COUNT(*) FROM milli_responses WHERE form_id=?',(request.match_info['id'],)).fetchone()[0]
        if n>=MAX_RESPONSES:raise web.HTTPTooManyRequests(text='回答受付数の上限です')
        now=time.time()
        self.db.execute('INSERT INTO milli_responses(form_id,created,player,answers) VALUES(?,?,?,?)',
                        (request.match_info['id'],now,name,json.dumps(saved,ensure_ascii=False)))
        self.db.commit()
        return web.json_response({'ok':True,'receivedAt':now},headers={'Cache-Control':'no-store'})

    async def manage(self,request):
        row=self.get(request.match_info['id'])
        try: key=(await request.json()).get('ownerKey','')
        except (ValueError,TypeError,json.JSONDecodeError):raise web.HTTPBadRequest(text='管理情報が不正です')
        if not isinstance(key,str) or not hmac.compare_digest(hashlib.sha256(key.encode()).hexdigest(),row['key_hash']):
            raise web.HTTPForbidden(text='作者専用キーが違います')
        result=self.db.execute('SELECT id,created,player,answers FROM milli_responses WHERE form_id=? ORDER BY created DESC LIMIT 150',(request.match_info['id'],)).fetchall()
        return web.json_response({'spec':json.loads(row['spec']),
                                  'responses':[{'id':r['id'],'created':r['created'],'name':r['player'],'answers':json.loads(r['answers'])} for r in result],
                                  'expiresAt':row['expires']},headers={'Cache-Control':'no-store'})

    def register(self,app):
        app.add_routes([web.post('/api/milli',self.publish),web.get('/api/milli/{id}',self.public),
                        web.post('/api/milli/{id}/submit',self.submit),web.post('/api/milli/{id}/manage',self.manage)])