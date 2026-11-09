"""Smoke test for spoiler-free character millishira, author-only results and drawing layer validation."""
import asyncio
import json
import sqlite3
from aiohttp import web
from aiohttp.test_utils import TestClient,TestServer
from milli_backend import MilliService
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
 custom=strokes([{'c':'#12abEF','a':0.35,'layer':2,'w':7,'p':[[0.1,0.1],[0.4,0.4]]}])
 assert custom[0]['a']==.35 and custom[0]['layer']==2 and custom[0]['c']=='#12abef'
 try:strokes([{'c':'red','a':1,'layer':0,'w':5,'p':[[.2,.2]]}])
 except ValueError:pass
 else:raise AssertionError('unsafe color accepted')
 print('PASS: millishira author privacy, answers, master audit, custom palette/layers/alpha')
asyncio.run(main())
