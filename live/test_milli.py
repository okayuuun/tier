"""Smoke test for spoiler-free character millishira, author-only results and drawing layer validation."""
import asyncio
import json
import sqlite3
import os
import sys
from types import ModuleType
from unittest.mock import patch
from aiohttp import web
from aiohttp.test_utils import TestClient,TestServer
from milli_backend import MilliService, PostgresMilliStore, env_positive_integer
from draw_party import strokes
class MockMaster:
 def __init__(self):
  self.db=sqlite3.connect(':memory:')
  self.db.row_factory=sqlite3.Row
  self.logs=[]
 def published(self,game):return game=='millishira'
 def log_action(self,room,name,action,detail=''):self.logs.append((room['game'],name,action))
async def main():
 master=MockMaster()
 service=MilliService(master)
 app=web.Application()
 service.register(app)
 async with TestClient(TestServer(app)) as client:
  form={'title':'架空キャラクターのミリしら','series':'テスト作品',
        'characters':[{'id':'char001','label':'1人目','image':'','fields':[
          {'id':'q001','label':'性格は？','type':'long','options':[]},
          {'id':'q002','label':'生存／死亡','type':'choice','options':['生存','死亡','不明']}]}]}
  r=await client.post('/api/milli',json=form)
  assert r.status==200,await r.text()
  auth=await r.json()
  token,key=auth['id'],auth['ownerKey']
  r=await client.get('/api/milli/'+token)
  data=await r.json()
  assert 'ownerKey' not in json.dumps(data) and 'key_hash' not in json.dumps(data)
  r=await client.post('/api/milli/'+token+'/submit',json={'name':'友達A',
           'answers':{'char001':{'q001':'正義感が強い','q002':'生存'}}})
  assert r.status==200,await r.text()
  r=await client.post('/api/milli/'+token+'/manage',json={'ownerKey':'wrong'})
  assert r.status==403
  r=await client.post('/api/milli/'+token+'/manage',json={'ownerKey':key})
  assert r.status==200
  saved=await r.json()
  assert len(saved['responses'])==1
  assert saved['responses'][0]['answers']['char001']['q002']=='生存'
  assert len(master.logs)==2 and master.logs[-1][2]=='milli_submit'
  r=await client.post('/api/milli/'+token+'/submit',json={'name':'不正',
           'answers':{'char001':{'q001':'hello','q002':'禁止された選択肢'}}})
  assert r.status==400
  # New: canonical facts must never leak during guessing, and random questions accept subsets.
  secret={'title':'ランダムで出題','series':'秘密の作品','hideSeries':True,'randomCount':1,'characters':[
    {'id':'alpha01','label':'キャラA','truthNote':'実は主人公','image':'','fields':[{'id':'qa001','label':'性格','type':'long','options':[],'truth':'慎重'}]},
    {'id':'beta002','label':'キャラB','truthNote':'黒幕','image':'','fields':[{'id':'qb002','label':'生死','type':'choice','options':['生存','死亡'],'truth':'死亡'}]}]}
  r=await client.post('/api/milli',json=secret)
  assert r.status==200,await r.text()
  pub=await r.json()
  fid,owner=pub['id'],pub['ownerKey']
  r=await client.get('/api/milli/'+fid)
  exposed=(await r.json())['spec']
  assert len(exposed['characters'])==1 and exposed['series']==''
  assert 'truthNote' not in json.dumps(exposed,ensure_ascii=False)
  assert 'truth' not in json.dumps(exposed,ensure_ascii=False)
  receipts={}
  for name,consent in [('公開A',True),('公開B',True),('非公開C',False)]:
   view=(await (await client.get('/api/milli/'+fid)).json())['spec']
   ch=view['characters'][0]
   answer='生存' if ch['id']=='beta002' else '優しい'
   vals={ch['id']:{ch['fields'][0]['id']:answer}}
   rr=await client.post('/api/milli/'+fid+'/submit',json={'name':name,'showcase':consent,'answers':vals})
   assert rr.status==200,await rr.text()
   receipts[name]=(await rr.json())['voterToken']
  r=await client.get('/api/milli/'+fid+'/gallery')
  assert r.status==403
  r=await client.post('/api/milli/'+fid+'/gallery-toggle',json={'ownerKey':'invalid','enabled':True})
  assert r.status==403
  r=await client.post('/api/milli/'+fid+'/gallery-toggle',json={'ownerKey':owner,'enabled':True})
  assert r.status==200,await r.text()
  gallery=await (await client.get('/api/milli/'+fid+'/gallery')).json()
  assert len(gallery['responses'])==2
  assert gallery['spec']['characters'][0]['truthNote']=='実は主人公'
  assert {x['name'] for x in gallery['responses']}=={'公開A','公開B'}
  target={x['name']:x['id'] for x in gallery['responses']}
  r=await client.post('/api/milli/'+fid+'/vote',json={'voterToken':receipts['公開A'],'responseId':target['公開A']})
  assert r.status==400
  r=await client.post('/api/milli/'+fid+'/vote',json={'voterToken':receipts['公開A'],'responseId':target['公開B']})
  assert r.status==200,await r.text()
  gallery=await (await client.get('/api/milli/'+fid+'/gallery')).json()
  assert next(x for x in gallery['responses'] if x['name']=='公開B')['votes']==1
  r=await client.post('/api/milli/'+fid+'/vote',json={'voterToken':'invalid_invalid_invalid','responseId':target['公開B']})
  assert r.status==403
  owner_data=await (await client.post('/api/milli/'+fid+'/manage',json={'ownerKey':owner})).json()
  assert len(owner_data['responses'])==3 and owner_data['spec']['hideSeries'] is True
  r=await client.post('/api/milli/'+fid+'/gallery-toggle',json={'ownerKey':owner,'enabled':False})
  assert r.status==200
  assert (await client.get('/api/milli/'+fid+'/gallery')).status==403
 # PostgreSQL backend adapter is tested without external credentials.
 assert env_positive_integer('MILLI_RETENTION_DAYS',3650,36500)>=1
 with patch.dict(os.environ,{'MILLI_RETENTION_DAYS':'0'}):
  try:env_positive_integer('MILLI_RETENTION_DAYS',3650,36500)
  except ValueError:pass
  else:raise AssertionError('invalid retention allowed')
 class DeadDatabase(Exception):pass
 class InvalidConnection(Exception):pass
 class FakeConnection:
  def __init__(self):self.fail=False;self.queries=[]
  def execute(self,sql,values):
   if self.fail:
    self.fail=False
    raise DeadDatabase('stale database socket')
   self.queries.append((sql,values))
   return self
 class FakeDriver(ModuleType):pass
 fake=FakeDriver('psycopg')
 fake.OperationalError=DeadDatabase
 fake.InterfaceError=InvalidConnection
 connections=[]
 def fake_connect(url,**kwargs):
  assert url.startswith('postgresql://') and kwargs['sslmode']=='require'
  assert kwargs['autocommit'] is True
  c=FakeConnection()
  connections.append(c)
  return c
 fake.connect=fake_connect
 rows=ModuleType('psycopg.rows')
 rows.dict_row=lambda cursor:None
 with patch.dict(sys.modules,{'psycopg':fake,'psycopg.rows':rows}):
  store=PostgresMilliStore('postgresql://user:secret@database.test/db')
  store.execute('SELECT ? AS n',(7,))
  assert connections[0].queries[-1]==('SELECT %s AS n',(7,))
  connections[0].fail=True
  store.execute('SELECT ? AS n',(8,))
  assert len(connections)==2 and connections[1].queries[-1]==('SELECT %s AS n',(8,))
  connections[1].fail=True
  try:store.execute('INSERT INTO milli_responses(id) VALUES (?)',(10,))
  except DeadDatabase:pass
  else:raise AssertionError('non-idempotent write was retried')
  assert len(connections)==3 and connections[2].queries==[]
 custom=strokes([{'c':'#12abEF','a':0.35,'layer':2,'w':7,'p':[[0.1,0.1],[0.4,0.4]]}])
 assert custom[0]['a']==.35 and custom[0]['layer']==2 and custom[0]['c']=='#12abef'
 try:strokes([{'c':'red','a':1,'layer':0,'w':5,'p':[[.2,.2]]}])
 except ValueError:pass
 else:raise AssertionError('unsafe color accepted')
 print('PASS: millishira spoiler privacy, gallery, votes, PostgreSQL adapter, SSL, reconnect and SQLite fallback')
asyncio.run(main())
