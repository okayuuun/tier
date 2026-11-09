"""Integration-style smoke tests for new drawing games, no external test runner required."""
from draw_mix import start, snapshot, handle, GAME_IDS
LINES=[{'c':'#4c375e','w':5,'p':[[.12,.14],[.45,.55]]}]
class Socket: closed=False

def make(game,n=4):
 ids=['p'+str(i) for i in range(n)]
 room={'code':'TEST01','game':game,'owner':ids[0],'active':ids,
  'players':{x:{'name':x,'ws':Socket()} for x in ids},'points':{x:0 for x in ids},
  'matchNo':1,'phase':'lobby','endedEarly':False}
 start(room)
 return room,ids

def do(r,id,t,**kw):handle(r,id,t,kw,id==r['owner'])
def check_mix(n):
 r,ids=make('artmix',n)
 assert r['phase']=='mx_draw'
 for x in ids:
  assert snapshot(r,x)['room']['drawmix']['myPrompt']
  do(r,x,'mx_draw',strokes=LINES)
 assert r['phase']=='mx_caption'
 for x in ids:do(r,x,'mx_caption',text='うっかりしてた '+x)
 assert r['phase']=='mx_vote'
 choices=r['drawmix']['combos']
 assert len(choices)==n and all(x['writer']!=x['artist'] for x in choices)
 public=snapshot(r,ids[0])['room']['drawmix']['combos']
 assert all('writer' not in x and 'artist' not in x for x in public)
 for x in ids:
  can=[y for y in choices if x not in (y['writer'],y['artist'])]
  assert can
  do(r,x,'mx_vote',key=can[0]['key'])
 assert r['phase']=='mx_reveal'
 do(r,ids[0],'mx_next')
 assert r['phase']=='mx_draw'
 for x in ids:do(r,x,'mx_draw',strokes=LINES)
 for x in ids:do(r,x,'mx_caption',text='またやってしまった '+x)
 for x in ids:
  can=[y for y in r['drawmix']['combos'] if x not in (y['writer'],y['artist'])]
  do(r,x,'mx_vote',key=can[0]['key'])
 do(r,ids[0],'mx_next')
 assert r['phase']=='final' and len(r['drawmix']['history'])==2

def check_collab(n):
 r,ids=make('artcollab',n)
 assert r['phase']=='co_turn'
 assert snapshot(r,ids[0])['room']['drawmix']['myMission']
 assert snapshot(r,ids[-1])['room']['drawmix']['myMission'] is None
 do(r,ids[0],'co_topic',topic='友達みんなの秘密の家')
 for x in ids:do(r,x,'co_submit',strokes=LINES)
 assert r['phase']=='co_reveal' and len(r['drawmix']['canvas'])==n
 assert all(r['points'][x]==1 for x in ids)
 do(r,ids[0],'co_next')
 for x in ids:do(r,x,'co_submit',strokes=LINES)
 do(r,ids[0],'co_next')
 assert r['phase']=='final'

def check_reverse(n):
 r,ids=make('reverseart',n)
 artist=r['drawmix']['artist'];target=r['drawmix']['target']
 assert snapshot(r,artist)['room']['drawmix']['target'] is None
 assert all(snapshot(r,x)['room']['drawmix']['target']==target for x in ids if x!=artist)
 for x in ids:
  if x!=artist:do(r,x,'rv_hint',text='よく見かける形だよ '+x)
 assert r['phase']=='rv_draw'
 assert snapshot(r,artist)['room']['drawmix']['target'] is None
 do(r,artist,'rv_draw',strokes=LINES)
 do(r,artist,'rv_guess',text='なんだか違うもの')
 assert r['phase']=='rv_judge'
 assert snapshot(r,artist)['room']['drawmix']['target'] is None
 for x in ids:
  if x!=artist:do(r,x,'rv_judge',accept=True)
 assert r['phase']=='rv_reveal' and r['drawmix']['last']['accepted']
 do(r,ids[0],'rv_next')
 assert r['phase']=='rv_hint'

if __name__=='__main__':
 assert {'artmix','artcollab','reverseart'} <= GAME_IDS
 for n in (3,4,7):check_mix(n)
 for n in (2,4,8):check_collab(n)
 for n in (2,3,5):check_reverse(n)
 print('New drawing game flows passed (3/4/7, 2/4/8, 2/3/5 players).')
