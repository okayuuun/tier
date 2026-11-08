import sys
# Loaded from this repository root
import party_more as m

class MockWs:
    closed=False


def new_room(game,n):
    active=[f'p{i}' for i in range(n)]
    return {'game':game,'phase':'lobby','active':active,'players':{p:{'id':p,'name':p,'ws':MockWs(),'avatar':'','emoji':'🌷'} for p in active},'points':dict.fromkeys(active,0),'code':'ABCDEF','owner':active[0],'matchNo':1,'endedEarly':False}

def run_describe():
    r=new_room('describe',3);m.start(r)
    for i in range(6):
        p=r['more'];assert r['phase']=='desc_clue'
        expl=p['explainer'];notexpl=next(x for x in r['active'] if x!=expl)
        snap=m.snapshot(r,notexpl)['room']['more'];assert snap['word'] is None
        try:m.handle(r,notexpl,'desc_clue',{'text':'こんにちは'},False);raise AssertionError('role leak')
        except ValueError:pass
        try:m.handle(r,expl,'desc_clue',{'text':'カタカナが入っています'},expl==r['owner']);raise AssertionError('katakana bypass')
        except ValueError:pass
        m.handle(r,expl,'desc_clue',{'text':'これは家庭や職場で使うものです'},expl==r['owner'])
        assert r['phase']=='desc_guess'
        m.handle(r,notexpl,'desc_guess',{'text':p['word']},False)
        assert r['phase']=='desc_reveal'
        m.handle(r,r['owner'],'desc_next',{},True)
    assert r['phase']=='final'
    print('describe complete, scores',r['points'])

def run_draw():
    r=new_room('drawfake',5);m.start(r)
    for i in range(3):
        p=r['more'];fake=p['faker'];host=p['host'];
        assert m.snapshot(r,fake)['room']['more']['word'] is None
        assert m.snapshot(r,host)['room']['more']['word']==p['word']
        while r['phase']=='draw_stroke':
            act=p['order'][p['cursor']]
            m.handle(r,act,'draw_stroke',{'points':[[3,5],[234,109],[340,120]]},act==r['owner'])
        assert r['phase']=='draw_vote'
        for person in [x for x in r['active'] if x!=host]:
            target=fake if person!=fake else next(x for x in r['active'] if x not in [person,host])
            m.handle(r,person,'draw_vote',{'target':target},person==r['owner'])
        if r['phase']=='draw_guess':m.handle(r,fake,'draw_guess',{'text':p['word']},fake==r['owner'])
        assert r['phase']=='draw_reveal'
        m.handle(r,r['owner'],'draw_next',{},True)
    assert r['phase']=='final';print('draw complete, scores',r['points'])

def run_mail():
    r=new_room('mysterymail',3);m.start(r)
    for c in range(3):
        p=r['more'];assert r['phase']=='mail_stage'
        for stage in range(3):
            s=p['case']['steps'][p['step']];snap=m.snapshot(r,'p1')['room']['more'];assert 'answers' not in str(snap)
            m.handle(r,'p0','mail_hint',{},True)
            m.handle(r,'p1','mail_answer',{'text':s['answers'][0]},False)
        assert r['phase']=='mail_reveal'
        m.handle(r,'p0','mail_next',{},True)
    assert r['phase']=='final';print('mail complete, scores',r['points'])

for test in [run_describe,run_draw,run_mail]:test()
print('ALL TESTS PASSED')