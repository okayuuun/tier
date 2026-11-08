from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).parent))
import word_games as w
class Socket:
    closed=False
def room(game,n=4,fmt=None):
    ps={f'p{i}':{'name':f'プレイヤー{i}','ws':Socket(),'avatar':'','emoji':'🌷'} for i in range(n)}
    return {'game':game,'code':'ABCDEF','players':ps,'active':list(ps),'points':{p:0 for p in ps},
            'phase':'lobby','matchNo':1,'owner':'p0','endedEarly':False,'wordFormat':fmt}
def test_senryu():
    for game,fmt in [('senryu','575'),('senryu','5577'),('senryu','7775')]:
        r=room(game,3,fmt);w.start(r)
        p=r['word'];judge=p['judge'];others=[x for x in r['active'] if x!=judge]
        assert p['format']==list(map(int,fmt))
        assert w.snapshot(r,judge)['room']['word']['hand']=={}
        for pid in others:
            h=p['hands'][pid];used={'5':0,'7':0};lines=[]
            for n in p['format']:
                t=str(n);lines.append({'text':h[t][used[t]],'free':False});used[t]+=1
            w.handle(r,pid,'word_submit',{'lines':lines},False)
        assert r['phase']=='word_judge'
        assert all(x.get('name') is None for x in w.snapshot(r,judge)['room']['word']['entries'])
        w.handle(r,judge,'word_pick',{'target':others[0]},False)
        assert r['points'][others[0]]==1 and r['phase']=='word_reveal'
        assert w.snapshot(r,judge)['room']['word']['last']['winner']==others[0]
        w.handle(r,'p0','word_next',{},True)
        assert r['phase']=='word_compose'
def test_tanka():
    r=room('tanka',3,'57577');w.start(r)
    assert r['word']['judge'] is None
    for pid in r['active']:
        hand=r['word']['hands'][pid];used={'5':0,'7':0};lines=[]
        for n in r['word']['format']:
            typ=str(n);lines.append({'text':hand[typ][used[typ]]});used[typ]+=1
        w.handle(r,pid,'word_submit',{'lines':lines},False)
    assert r['phase']=='word_vote'
    assert all(x['name'] is None for x in w.snapshot(r,'p0')['room']['word']['entries'])
    for i,pid in enumerate(r['active']):
        w.handle(r,pid,'word_vote',{'target':r['active'][(i+1)%3]},False)
    assert r['phase']=='word_reveal'
    assert all(score==2 for score in r['points'].values())
    w.handle(r,'p0','word_next',{},True)
    assert r['phase']=='word_compose'

def test_titles():
    r=room('booktitle',4);w.start(r)
    for pid in r['active']:
        h=r['word']['hands'][pid]
        w.handle(r,pid,'word_submit',{'top':{'text':h['top'][0]},'bottom':{'text':h['bottom'][0]}},False)
    assert r['phase']=='word_vote'
    for i,pid in enumerate(r['active']):
        w.handle(r,pid,'word_vote',{'target':r['active'][(i+1)%4]},False)
    assert r['phase']=='word_reveal'
    assert all(v==2 for v in r['points'].values())
    w.handle(r,'p0','word_next',{},True)
    assert r['phase']=='word_compose'
def test_free_text():
    r=room('senryu',3,'5577');w.start(r)
    pid=next(x for x in r['active'] if x!=r['word']['judge'])
    w.handle(r,pid,'word_submit',{'lines':[{'text':'自由すぎる言葉','free':True}]*4},False)
    assert len(r['word']['submitted'][pid]['lines'])==4
    for bad in ('','445','5555555'):
        try:w.parse_format(bad)
        except ValueError:pass
        else:raise AssertionError(bad)
if __name__=='__main__':
    test_senryu();test_tanka();test_titles();test_free_text()
    print('Word game server smoke tests passed')
