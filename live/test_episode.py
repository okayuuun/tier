"""End-to-end state-machine smoke test of anonymous episode guessing."""
from episode_game import start, snapshot, handle

class FakeSocket:
    closed = False

def make_room():
    ids=('a','b','c')
    return {'code':'TEST12','game':'episode','phase':'lobby','owner':'a',
            'players':{k:{'id':k,'name':'友達'+k,'ws':FakeSocket(),
                          'avatar':'','emoji':'🌸'} for k in ids},
            'points':{k:0 for k in ids},'active':list(ids),
            'matchNo':1,'endedEarly':False}

def invalid(func):
    try:func()
    except ValueError:return
    raise AssertionError('invalid step accepted')

room=make_room()
start(room)
assert room['phase']=='ep_topic'
invalid(lambda:handle(room,'b','ep_topic',{'text':'焦った話'},False))
handle(room,'a','ep_topic',{'text':'人生で一番焦ったこと'},True)
assert room['phase']=='ep_write'
handle(room,'a','ep_submit',{'text':'私はスーパーで財布を忘れました'},True)
assert '私はスーパーで' not in str(snapshot(room,'b'))
invalid(lambda:handle(room,'a','ep_submit',{'text':'もう一度書きたいです'},True))
handle(room,'b','ep_submit',{'text':'お店で店員さんと間違えて話しかけた'},False)
handle(room,'c','ep_submit',{'text':'ゲームの大会で押すボタンを間違えた'},False)
assert room['phase']=='ep_guess'
p=room['episode']
assert len(p['entries'])==3
for me in ('a','b','c'):
    state=snapshot(room,me)
    # Other people's stories may be visible, but no author IDs or full guesses.
    assert state['room']['episode']['last'] is None
    exposed=state['room']['episode']['entries']
    assert len(exposed)==3 and all('author' not in e for e in exposed)
    assert sum(bool(e['mine']) for e in exposed)==1
    assert state['room']['episode']['myEntry']
invalid(lambda:handle(room,'a','ep_guess',{'answers':{'fake_id':'b'}},True))
# Each participant submits a one-to-one bijection of others to stories.
for me in ('a','b','c'):
    entries=[e for e in p['entries'] if e['author']!=me]
    answers={e['id']:e['author'] for e in entries}
    handle(room,me,'ep_guess',{'answers':answers},me=='a')
assert room['phase']=='ep_reveal'
assert len(p['history'])==1
record=p['last']
assert len(record['entries'])==3 and len(record['guesses'])==3
assert all(score>=4 for score in room['points'].values())
assert '私はスーパーで' in str(snapshot(room,'a')['room']['episode']['last'])
handle(room,'a','ep_next',{},True)
assert room['phase']=='ep_topic' and p['round']==1
# Owner may reveal with missing guesses; this should never reveal while writing.
handle(room,'a','ep_topic',{'text':'ちょっと面白かった話'},True)
invalid(lambda:handle(room,'a','ep_force',{},True))
for who in ('a','b','c'):
    handle(room,who,'ep_submit',{'text':'これはそれなりに長いエピソードです'+who},who=='a')
assert room['phase']=='ep_guess'
handle(room,'a','ep_force',{},True)
assert room['phase']=='ep_reveal'
assert len(p['history'])==2
print('PASS: episode private writing, one-to-one guesses, reveal, scoring, next round and owner controls')
