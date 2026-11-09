"""Regression tests for five original party board-game adaptations."""
import board_games as m

class MockWs:
    closed=False

def make(game,count):
    users=[f'p{i}' for i in range(count)]
    return {'code':'ABCDEF','game':game,'phase':'lobby','active':users,
            'players':{pid:{'name':pid,'ws':MockWs(),'avatar':'','emoji':'🌷'} for pid in users},
            'points':dict.fromkeys(users,0),'owner':users[0],
            'matchNo':1,'endedEarly':False}

def send(r,pid,event,**args):
    m.handle(r,pid,event,args,pid==r['owner'])

def denied(fn):
    try:fn()
    except ValueError:return
    raise AssertionError('Invalid action should be rejected')

def test_one():
    r=make('oneword',3);m.start(r)
    p=r['board'];guesser=p['guesser'];others=[x for x in r['active'] if x!=guesser]
    assert m.snapshot(r,guesser)['room']['board']['word'] is None
    assert m.snapshot(r,others[0])['room']['board']['word']==p['words'][0]
    send(r,others[0],'bg_hint',text='甘い')
    assert m.snapshot(r,others[1])['room']['board']['clues'][0]['text'] is None
    send(r,others[1],'bg_hint',text='甘い')
    snap=m.snapshot(r,guesser)['room']['board']
    assert r['phase']=='bg_guess' and snap['clues']==[]
    denied(lambda:send(r,others[0],'bg_answer',text='違う'))
    send(r,guesser,'bg_answer',text=p['words'][0])
    assert p['last']['correct'] and r['points'][guesser]==1
    assert len(p['last']['clues'])==2 and all(c['duplicate'] for c in p['last']['clues'])
    for i in range(1,6):
        send(r,r['owner'],'bg_next')
        assert r['phase']=='bg_hint'
        send(r,r['owner'],'bg_skip')
        send(r,r['owner'],'bg_skip')
        assert r['phase']=='bg_reveal'
    send(r,r['owner'],'bg_next')
    assert r['phase']=='final'
    m.snapshot(r,guesser)  # no IndexError at completed roundLimit
    print('PASS one-word clues: secrecy, duplicate removal, turns, full game')

def test_spectrum():
    r=make('spectrum',4);m.start(r);p=r['board']
    guide=p['guide'];guests=[x for x in r['active'] if x!=guide]
    assert m.snapshot(r,guests[0])['room']['board']['target'] is None
    assert m.snapshot(r,guide)['room']['board']['target']==p['target']
    denied(lambda:send(r,guests[0],'sp_clue',text='test'))
    send(r,guide,'sp_clue',text='やや高め')
    send(r,guests[0],'sp_guess',number=p['target'])
    denied(lambda:send(r,guests[0],'sp_guess',number=p['target']))
    for pid in guests[1:]:send(r,pid,'sp_guess',number=0)
    assert r['phase']=='sp_reveal' and r['points'][guests[0]]==3
    for _ in range(4):
        send(r,r['owner'],'sp_next')
        send(r,r['owner'],'sp_force')
        send(r,r['owner'],'sp_force')
        assert r['phase']=='sp_reveal'
    send(r,r['owner'],'sp_next')
    assert r['phase']=='final'
    m.snapshot(r,guests[0])
    print('PASS spectrum: secret target, scoring, early finalize and full game')

def test_quiet():
    r=make('quiet',3);m.start(r);p=r['board']
    assert len(m.snapshot(r,'p0')['room']['board']['myHand'])==1
    all_nums=sorted((n,pid) for pid,hand in p['hand'].items() for n in hand)
    for n,pid in all_nums:send(r,pid,'qt_play',number=n)
    assert r['phase']=='qt_reveal' and p['lives']==3
    send(r,'p0','qt_next')
    assert p['stage']==2
    nums=sorted((n,pid) for pid,hand in p['hand'].items() for n in hand)
    big,player=nums[-1]
    send(r,player,'qt_play',number=big)
    assert p['lives']==2 and p['misses']
    for n,pid in nums[:-1]:
        denied(lambda n=n,pid=pid:send(r,pid,'qt_play',number=n))
    assert r['phase']=='qt_reveal'
    send(r,'p0','qt_next')
    assert p['stage']==3 and len(p['hand']['p1'])==3
    nums=sorted((n,pid) for pid,hand in p['hand'].items() for n in hand)
    for n,pid in nums:send(r,pid,'qt_play',number=n)
    send(r,'p0','qt_next')
    assert r['phase']=='final'
    print('PASS quiet: private hands, ascending plays, skipped cards and life loss')

def test_bluff():
    r=make('bluff',3);m.start(r);p=r['board']
    send(r,'p0','bl_place',card='safe')
    send(r,'p1','bl_place',card='danger')
    send(r,'p2','bl_place',card='safe')
    assert r['phase']=='bl_bid'
    snap=m.snapshot(r,'p2')['room']['board']
    assert 'p1' in snap['planted'] and 'danger' not in str(snap['planted'])
    send(r,'p0','bl_bid',number=1)
    denied(lambda:send(r,'p1','bl_bid',number=1))
    send(r,'p1','bl_pass');send(r,'p2','bl_pass')
    assert r['phase']=='bl_flip'
    denied(lambda:send(r,'p1','bl_flip',target='p1'))
    send(r,'p0','bl_flip',target='p0')
    assert r['phase']=='bl_reveal' and p['last']['success']
    assert p['stars']['p0']==1
    send(r,'p0','bl_next')
    for pid,card in [('p0','safe'),('p1','danger'),('p2','safe')]:send(r,pid,'bl_place',card=card)
    send(r,'p0','bl_bid',number=1)
    send(r,'p1','bl_pass');send(r,'p2','bl_pass')
    send(r,'p0','bl_flip',target='p1')
    assert not p['last']['success'] and p['wounds']['p0']==1
    print('PASS bluff: secret cards, bidding, win, trap and undo-safe rounds')

def test_agents():
    r=make('wordagents',4);m.start(r);p=r['board']
    assert r['phase']=='wa_play' and set(p['teams'].values())=={'red','blue'}
    captain=p['captains']['red']
    teammate=next(pid for pid in r['active'] if p['teams'][pid]=='red' and pid!=captain)
    outsider=next(pid for pid in r['active'] if p['teams'][pid]=='blue')
    assert m.snapshot(r,captain)['room']['board']['owners']==p['owners']
    assert m.snapshot(r,teammate)['room']['board']['owners'] is None
    denied(lambda:send(r,teammate,'wa_clue',text='乗り物',number=2))
    denied(lambda:send(r,captain,'wa_clue',text=p['words'][0],number=2))
    send(r,captain,'wa_clue',text='ここにないヒント',number=2)
    denied(lambda:send(r,outsider,'wa_pick',index=0))
    chosen=next(i for i,owner in enumerate(p['owners']) if owner=='red')
    denied(lambda:send(r,captain,'wa_pick',index=chosen))
    send(r,teammate,'wa_pick',index=chosen)
    assert chosen in p['revealed']
    assert m.snapshot(r,outsider)['room']['board']['visibleOwners'][str(chosen)]=='red'
    send(r,teammate,'wa_pass')
    assert p['turn']=='blue' and p['step']=='clue'
    blue=p['captains']['blue']
    send(r,blue,'wa_clue',text='合言葉',number=1)
    teammate=next(pid for pid in r['active'] if p['teams'][pid]=='blue' and pid!=blue)
    trap=p['owners'].index('trap')
    send(r,teammate,'wa_pick',index=trap)
    assert r['phase']=='final' and p['winner']=='red'
    assert all(r['points'][pid]==5 for pid in r['active'] if p['teams'][pid]=='red')
    print('PASS agents: captain-only map, team roles, colored reveals and trap')

def test_counts():
    for game,low in m.MIN_PLAYERS.items():
        denied(lambda game=game,low=low:m.start(make(game,low-1)))
    for game,high in m.MAX_PLAYERS.items():
        denied(lambda game=game,high=high:m.start(make(game,high+1)))
    print('PASS game count limits')

if __name__=='__main__':
    test_one()
    test_spectrum()
    test_quiet()
    test_bluff()
    test_agents()
    test_counts()
