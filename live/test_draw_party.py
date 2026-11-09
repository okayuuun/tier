import draw_party as d
class Socket:closed=False
def room(game,n=3):
    ps={f'p{i}':{'name':f'友達{i}','ws':Socket(),'avatar':'','emoji':'🌷'} for i in range(n)}
    return {'code':'ABC123','game':game,'phase':'lobby','owner':'p0',
            'active':list(ps),'players':ps,'points':{pid:0 for pid in ps},'matchNo':1,'endedEarly':False}
def picture():return [{'c':'#ed448f','w':4,'p':[[.1,.2],[.5,.7]]}]
def test_guide():
    r=room('artguide');d.start(r);p=r['draw'];leader=p['guide'];artists=[x for x in r['active'] if x!=leader]
    assert d.snapshot(r,artists[0])['room']['draw']['target'] is None
    d.handle(r,leader,'art_target',{'topic':'架空の動物','target':'王冠をかぶった猫'},leader=='p0')
    d.handle(r,leader,'art_hints',{'hints':['えらそうな雰囲気','小さな耳がある']},True)
    for artist in artists:
        d.handle(r,artist,'art_submit',{'strokes':picture()},False)
    assert r['phase']=='art_pick'
    d.handle(r,leader,'art_pick',{'winner':artists[0]},True)
    assert r['phase']=='art_reveal'
    assert r['points'][artists[0]]==2 and r['points'][leader]==1
    d.handle(r,'p0','art_next',{},True)
    assert r['phase']=='art_hint'
def test_relay():
    r=room('drawrelay',4);d.start(r)
    for pid in r['active']:d.handle(r,pid,'relay_seed',{'text':pid+'から始まる'},False)
    assert r['phase']=='relay_draw'
    for pid in r['active']:
        assert d.snapshot(r,pid)['room']['draw']['prompt']['text']!=pid+'から始まる'
        d.handle(r,pid,'relay_draw',{'strokes':picture()},False)
    assert r['phase']=='relay_caption'
    for pid in r['active']:d.handle(r,pid,'relay_caption',{'text':'宇宙にいる猫'},False)
    assert r['phase']=='relay_draw'
    for pid in r['active']:d.handle(r,pid,'relay_draw',{'strokes':picture()},False)
    assert r['phase']=='relay_reveal'
    state=d.snapshot(r,'p0')['room']['draw']
    assert all(len(chain['steps'])==4 for chain in state['chains'])
    d.handle(r,'p0','relay_next',{},True)
    assert r['phase']=='final'
if __name__=='__main__':
    test_guide();test_relay();print('Drawing game tests passed')
