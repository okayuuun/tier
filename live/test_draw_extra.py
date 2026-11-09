"""Smoke test drawing modes: submissions, privacy, votes, scoring."""
import draw_extra as x
class W:
    closed=False
DRAW=[{'c':'#4c375e','w':5,'p':[[.1,.1],[.6,.5]]}]
def make(game,n=3):
 a=[f'p{i}' for i in range(n)]
 return dict(game=game,active=a,players={k:{'name':k,'ws':W()} for k in a},points={k:0 for k in a},code='TESTAA',owner=a[0],matchNo=1,endedEarly=False)
for game in ['artcontest','artforbid']:
 r=make(game);x.start(r)
 for k in r['active']:x.handle(r,k,'paint_submit',{'strokes':DRAW},False)
 assert r['phase']=='px_vote'
 assert all(d['name'] is None for d in x.snapshot(r,'p0')['room']['drawextra']['pictures'])
 for i,k in enumerate(r['active']):
  x.handle(r,k,'paint_vote',{'target':r['active'][(i+1)%3],'violations':[]},False)
 assert r['phase']=='px_reveal'
 x.handle(r,'p0','paint_next',{},True)
 assert r['phase']=='px_draw'
 print('PASS',game)
r=make('drawbluff',4);x.start(r)
for k in r['active']:x.handle(r,k,'db_draw',{'strokes':DRAW},False)
assert r['phase']=='db_caption'
for round_i in range(4):
 author=r['active'][round_i]
 for k in r['active']:
  state=x.snapshot(r,k)['room']['drawextra']
  assert bool(state['myPrompt'])==(k==author)
  if k!=author:x.handle(r,k,'db_caption',{'text':'偽のお題 '+k},False)
 assert r['phase']=='db_vote'
 truth=r['drawextra']['prompts'][author]
 options=x.snapshot(r,author)['room']['drawextra']['options']
 correct=next(v for v in options if v['text']==truth)
 for k in r['active']:
  if k!=author:x.handle(r,k,'db_vote',{'key':correct['key']},False)
 assert r['phase']=='db_reveal'
 x.handle(r,'p0','db_next',{},True)
assert r['phase']=='final' and len(r['drawextra']['history'])==4
print('PASS drawbluff: private prompts, voting and final')