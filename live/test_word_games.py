"""Smoke test: each player chooses their own phrase count and order."""
import word_games as w
class Socket:closed=False
def room(game,n=4):
    ps={f'p{i}':{'name':f'友達{i}','ws':Socket(),'avatar':'','emoji':'🌷'} for i in range(n)}
    return {'game':game,'code':'ABCDEF','players':ps,'active':list(ps),'points':{p:0 for p in ps},
        'phase':'lobby','matchNo':1,'owner':'p0','endedEarly':False}
def phrases(hand):
    return [{'text':hand['7'][0],'kind':'7','free':False},
            {'text':'自分の好きな言葉','kind':'free','free':True},
            {'text':hand['5'][0],'kind':'5','free':False}]
def test_poetry():
    for game in ('senryu','tanka'):
        r=room(game,3);w.start(r);p=r['word']
        assert p['format'] is None
        judge=p['judge']
        active=[pid for pid in r['active'] if pid!=judge]
        for pid in active:
            w.handle(r,pid,'word_submit',{'lines':phrases(p['hands'][pid])},False)
        if game=='senryu':
            assert r['phase']=='word_judge' and judge is not None
            assert all(x['name'] is None for x in w.snapshot(r,judge)['room']['word']['entries'])
            w.handle(r,judge,'word_pick',{'target':active[0]},False)
        else:
            assert r['phase']=='word_vote'
            for i,pid in enumerate(r['active']):
                w.handle(r,pid,'word_vote',{'target':r['active'][(i+1)%3]},False)
        assert r['phase']=='word_reveal'
        w.handle(r,'p0','word_next',{},True)
        assert r['phase']=='word_compose'
def test_deck_and_book():
    r=room('senryu',3)
    r['wordDeck']=w.validate_deck('senryu',{'five':['自作の5A','自作の5B'],'seven':['自作の7A','自作の7B']})
    w.start(r)
    assert all(text.startswith('自作の') for h in r['word']['hands'].values() for group in h.values() for text in group)
    r=room('booktitle',4);w.start(r)
    for pid in r['active']:
        h=r['word']['hands'][pid]
        w.handle(r,pid,'word_submit',{'top':{'text':h['top'][0]},'bottom':{'text':h['bottom'][0]}},False)
    assert r['phase']=='word_vote'
    for i,pid in enumerate(r['active']):w.handle(r,pid,'word_vote',{'target':r['active'][(i+1)%4]},False)
    assert r['phase']=='word_reveal'
if __name__=='__main__':
    test_poetry();test_deck_and_book()
    print('Word card freedom tests passed')
