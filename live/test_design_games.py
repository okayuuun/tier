"""Smoke tests for invention pitches and character design."""
from types import SimpleNamespace
from design_games import GAME_IDS, EVENTS, start, snapshot, handle

stroke=[{"c":"#4c375e","w":5,"p":[[0.1,0.2],[0.4,0.6]]}]
def room(game,n):
    ids=["p"+str(i) for i in range(n)]
    return {"code":"ABCDEF","game":game,"owner":ids[0],"active":ids,
            "players":{pid:{"name":pid,"ws":SimpleNamespace(closed=False)} for pid in ids},
            "points":{pid:0 for pid in ids},"matchNo":1,"phase":"lobby","endedEarly":False}
def go(r,pid,kind,**kw):
    handle(r,pid,kind,kw,pid==r["owner"])
def see(r,pid):return snapshot(r,pid)["room"]["design"]
def rejects(fn):
    try:fn()
    except ValueError:return
    raise AssertionError("Unauthorized or invalid request accepted")
def test_invention(n):
    r=room("invent",n);start(r);a=r["active"]
    for index in range(3):
        assert r["phase"]=="inv_brief"
        go(r,a[0],"inv_brief",need="寝坊した朝を救う",twist="猫でも使える")
        go(r,a[0],"inv_publish")
        rejects(lambda:go(r,a[1],"inv_publish"))
        for pid in a:
            assert not see(r,pid)["entries"]
            go(r,pid,"inv_submit",product="魔法の傘",catchphrase="雨でも平気です",pitch="雨を検知して自動で開く便利な傘です。",strokes=stroke)
        assert r["phase"]=="inv_vote"
        assert all("name" not in e for e in see(r,a[0])["entries"])
        rejects(lambda:go(r,a[0],"inv_vote",target=a[0]))
        for i,pid in enumerate(a):go(r,pid,"inv_vote",ratings={axis:a[(i+1)%n] for axis in ("cute","fun","original")})
        assert r["phase"]=="inv_reveal"
        assert len(see(r,a[0])["last"]["entries"])==n
        go(r,a[0],"inv_next")
    assert r["phase"]=="final" and len(see(r,a[0])["history"])==3
    assert sum(r["points"].values())==n*3*3

def test_character(n):
    r=room("chardesign",n);start(r);a=r["active"]
    for index in range(min(4,n)):
        judge=r["design"]["judge"]
        rejects(lambda:go(r,a[(index+1)%n],"char_publish"))
        go(r,judge,"char_brief",role="魔法学校の新入生",condition1="大きな帽子",condition2="動物が相棒")
        go(r,judge,"char_publish")
        for pid in a:
            if pid==judge:continue
            assert see(r,pid)["entries"]==[]
            go(r,pid,"char_submit",character="星の魔法使い",concept="帽子と小動物の相棒を目立つように描きました。",strokes=stroke)
        assert r["phase"]=="char_pick"
        chosen=see(r,judge)["entries"][0]["id"]
        assert all("name" not in e for e in see(r,judge)["entries"])
        rejects(lambda:go(r,a[(index+1)%n],"char_pick",target=chosen))
        go(r,judge,"char_pick",target=chosen,ratings={axis:chosen for axis in ("cute","fun","original")})
        assert r["phase"]=="char_reveal"
        go(r,a[0],"char_next")
    assert r["phase"]=="final"
    assert len(see(r,a[0])["history"])==min(4,n)
    assert sum(r["points"].values())==6*min(4,n)

assert {"invent","chardesign"}<=GAME_IDS
assert {"inv_submit","inv_vote","char_submit","char_pick"}<=EVENTS
for players in (2,3,5):
    test_invention(players)
    test_character(players)
print("PASS: both new drawing modes, all rounds, permissions, privacy and scoring")
