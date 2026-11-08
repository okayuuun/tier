"""Smoke tests for additional party games (no external dependencies)."""
from party_modes import GAME_IDS, EVENTS, start_party, party_snapshot, handle_party_event
from master_admin import GAMES, LABELS

class Socket:
    closed = False

def new_room(game, count=4):
    active = [f"p{i}" for i in range(count)]
    return {
        "game": game, "code": "ABCDEF", "matchNo": 1, "phase": "lobby",
        "owner": active[0], "active": active, "endedEarly": False,
        "players": {pid: {"id": pid, "name": pid, "ws": Socket()} for pid in active},
        "points": {pid: 0 for pid in active},
    }

def act(room,pid,event,**obj):
    handle_party_event(room,pid,event,obj,pid==room["owner"])

def test_unanimous():
    r=new_room("unanimous");start_party(r)
    assert r["phase"]=="un_answer"
    for pid in r["active"]:act(r,pid,"un_answer",text="たこ焼き")
    assert r["phase"]=="un_reveal"
    assert r["party"]["successes"]==1
    act(r,"p0","un_next")
    assert r["phase"]=="un_answer"

def test_insider():
    r=new_room("insider");start_party(r);p=r["party"]
    master=p["master"];insider=p["insider"]
    citizen=next(x for x in r["active"] if x not in (master,insider))
    assert party_snapshot(r,citizen)["room"]["party"]["secretWord"] is None
    assert party_snapshot(r,insider)["room"]["party"]["secretWord"]==p["word"]
    act(r,citizen,"in_question",text="食べ物ですか？")
    act(r,master,"in_answer",id=0,reply="no")
    act(r,citizen,"in_guess",text=p["word"])
    assert r["phase"]=="in_vote"
    for pid in r["active"]:
        if pid!=master:
            to=insider if pid!=insider else citizen
            act(r,pid,"in_vote",target=to)
    assert r["phase"]=="in_reveal"

def test_secret_rank():
    r=new_room("secret_rank");start_party(r);p=r["party"]
    target=p["target"];other=next(x for x in r["active"] if x!=target)
    assert party_snapshot(r,other)["room"]["party"]["secretCriterion"] is None
    try:
        act(r,other,"sr_order",order=[0,1,2,3,4])
        raise AssertionError("Only target can send ranking")
    except ValueError:pass
    act(r,target,"sr_order",order=[4,3,2,1,0])
    assert r["phase"]=="sr_guess"
    assert party_snapshot(r,other)["room"]["party"]["secretCriterion"] is None
    for pid in r["active"]:
        if pid!=target:act(r,pid,"sr_guess",choice=p["criterion"])
    assert r["phase"]=="sr_reveal"
    assert party_snapshot(r,other)["room"]["party"]["secretCriterion"] is not None

if __name__=="__main__":
    assert {"unanimous","insider","secret_rank"} <= GAME_IDS
    assert {"unanimous","insider","secret_rank"} <= set(GAMES)
    assert all(g in LABELS for g in ("unanimous","insider","secret_rank"))
    assert {"un_answer","in_question","sr_order"} <= EVENTS
    test_unanimous()
    test_insider()
    test_secret_rank()
    print("All three game flows passed")
