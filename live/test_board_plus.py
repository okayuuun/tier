"""Security and full-turn regression for five card/word multiplayer games."""
import board_plus as m

class WS:
    closed=False

def room(game,n):
    active=[f'p{i}' for i in range(n)]
    return {'game':game,'phase':'lobby','code':'ABCDEF','owner':active[0],'active':active,
      'matchNo':1,'endedEarly':False,'points':{pid:0 for pid in active},
      'players':{pid:{'name':pid,'ws':WS(),'avatar':'','emoji':'⭐'} for pid in active}}

def act(r,pid,event,**kw):
    return m.handle(r,pid,event,kw,pid==r['owner'])

def bad(fn):
    try:fn()
    except ValueError:return
    raise AssertionError('Invalid action was accepted')

def test_royal():
    r=room('royalletter',3);m.start(r);p=r['boardplus']
    assert m.snapshot(r,'p1')['room']['boardplus']['drawn'] is None
    assert m.snapshot(r,'p0')['room']['boardplus']['drawn'] is not None
    for _ in range(25):
        if r['phase']!='bp_royal':break
        who=p['turn']
        card=p['drawn'] if p['drawn']!=8 else p['hands'][who]
        act(r,who,'rl_play',card=card,target=None,guess=1)
    assert r['phase']=='bp_royal_reveal'
    assert len(p['history'])==1 and p['last']['winners']
    for _ in range(2):
        act(r,'p0','rl_next')
        for turn in range(25):
            if r['phase']!='bp_royal':break
            who=p['turn']
            card=p['drawn'] if p['drawn']!=8 else p['hands'][who]
            act(r,who,'rl_play',card=card)
        assert r['phase']=='bp_royal_reveal'
    act(r,'p0','rl_next')
    assert r['phase']=='final'
    print('PASS secret cards, effects, elimination, round flow')

def test_cipher():
    r=room('cipherrelay',4);m.start(r);p=r['boardplus']
    for n in range(6):
        assert r['phase']=='bp_cipher_clue'
        giver=p['clueGiver']
        guesser=p['guesser'];interceptor=p['interceptor']
        assert m.snapshot(r,guesser)['room']['boardplus']['code'] is None
        assert m.snapshot(r,giver)['room']['boardplus']['code']==p['code']
        assert m.snapshot(r,interceptor)['room']['boardplus']['words']==p['keys'][p['teams'][interceptor]]
        bad(lambda:act(r,guesser,'dc_clue',words=['a','b','c']))
        act(r,giver,'dc_clue',words=['赤い','青い','黄色い'])
        bad(lambda:act(r,guesser,'dc_guess',numbers=[1,1,2]))
        act(r,guesser,'dc_guess',numbers=p['code'][:])
        assert r['phase']=='bp_cipher_guess'
        act(r,interceptor,'dc_guess',numbers=p['code'][:])
        assert r['phase']=='bp_cipher_reveal'
        assert p['last']['ownCorrect'] and p['last']['interceptCorrect']
        act(r,'p0','dc_next')
    assert r['phase']=='final' and p['teamScores']=={'red':9,'blue':9}
    assert r['points']['p0']==9
    print('PASS cryptography secrecy, clues, independent answers and scoring')

def test_fire():
    r=room('skyfire',3);m.start(r);p=r['boardplus']
    s=m.snapshot(r,'p0')['room']['boardplus']
    assert all(x['c'] is None and x['n'] is None for x in s['hands']['p0'])
    assert all(x['c'] is not None and x['n'] is not None for x in s['hands']['p1'])
    card=p['hands']['p1'][0]
    act(r,'p0','hf_hint',target='p1',axis='c',value=card['c'])
    assert p['hints']==5 and p['turn']=='p1'
    s=m.snapshot(r,'p1')['room']['boardplus']
    assert s['hands']['p1'][0]['c']==card['c']
    bad(lambda:act(r,'p0','hf_play',index=0))
    act(r,'p1','hf_discard',index=0)
    assert p['hints']==6 and p['turn']=='p2'
    act(r,'p2','hf_play',index=0)
    assert p['turn']=='p0' or r['phase']=='final'
    for card in p['hands']['p0']:
        assert 'c' in card and 'n' in card
    print('PASS hidden own hand, visible partner, hints and progression')

def test_scout():
    r=room('scoutline',2);m.start(r);p=r['boardplus']
    assert 'myHand' in m.snapshot(r,'p0')['room']['boardplus']
    assert 'hands' not in m.snapshot(r,'p0')['room']['boardplus']
    act(r,'p0','sc_play',start=0,length=1)
    assert p['field']
    act(r,'p1','sc_scout',index=0,side='right')
    assert not p['field'] and len(p['hands']['p1'])==8
    while r['phase']=='bp_scout':act(r,p['turn'],'sc_skip')
    assert r['phase']=='bp_scout_reveal'
    act(r,'p0','sc_next')
    assert p['round']==1
    for _ in range(2):
        while r['phase']=='bp_scout':act(r,p['turn'],'sc_skip')
        act(r,'p0','sc_next')
    assert r['phase']=='final'
    print('PASS ordered hand, set play, scout, skip and 3 rounds')

def test_ai():
    r=room('aiuebattle',3);m.start(r);p=r['boardplus']
    act(r,'p0','ai_theme',theme='食べもの')
    assert p['theme']=='食べもの'
    bad(lambda:act(r,'p0','ai_write',word='漢字'))
    act(r,'p0','ai_write',word='かさ')
    act(r,'p1','ai_write',word='さかな')
    act(r,'p2','ai_write',word='ねこ')
    assert r['phase']=='bp_ai_attack'
    assert m.snapshot(r,'p1')['room']['boardplus']['boards']['p0']['letters']==[None,None]
    assert m.snapshot(r,'p0')['room']['boardplus']['mine']=='かさ'
    act(r,'p0','ai_attack',letter='か')
    state=m.snapshot(r,'p2')['room']['boardplus']
    assert state['boards']['p0']['letters']==['か',None]
    assert p['turn']=='p0'
    bad(lambda:act(r,'p0','ai_attack',letter='か'))
    act(r,'p0','ai_attack',letter='さ')
    assert 'p0' in p['out']
    count=0
    while r['phase']=='bp_ai_attack' and count<50:
        letter=next(c for c in m.KANA if c not in p['called'])
        act(r,p['turn'],'ai_attack',letter=letter)
        count+=1
    assert r['phase']=='bp_ai_reveal'
    assert p['last']['winner'] in r['active']
    for _ in range(2):
        act(r,'p0','ai_next')
        assert r['phase']=='bp_ai_write'
        for who,word in [('p0','かすてら'),('p1','さかな'),('p2','くま')]:
            act(r,who,'ai_write',word=word)
        count=0
        while r['phase']=='bp_ai_attack' and count<50:
            letter=next(c for c in m.KANA if c not in p['called'])
            act(r,p['turn'],'ai_attack',letter=letter);count+=1
        assert r['phase']=='bp_ai_reveal'
    act(r,'p0','ai_next')
    assert r['phase']=='final'
    assert m.ai_word('がっこう')=='かつこう'
    assert m.ai_word('ぺんぎん')=='へんきん'
    print('PASS secrets, kana normalization, hits, knockouts and winner')

def test_counts():
    for name,(lo,hi) in m.LIMITS.items():
        bad(lambda name=name,lo=lo:m.start(room(name,lo-1)))
        bad(lambda name=name,hi=hi:m.start(room(name,hi+1)))
    print('PASS enforced count bounds')

if __name__=='__main__':
    test_royal()
    test_cipher()
    test_fire()
    test_scout()
    test_ai()
    test_counts()
