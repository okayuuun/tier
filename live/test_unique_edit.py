"""全員不一致ゲーム：回答修正・秘密保持・確定後の変更拒否。"""
from party_modes import start_party, party_snapshot, handle_party_event


class Socket:
    closed = False


def room_with_players():
    active = ["p0", "p1", "p2"]
    return {
        "game": "unique", "code": "TEST01", "matchNo": 1,
        "phase": "lobby", "owner": "p0", "active": active,
        "endedEarly": False,
        "players": {pid: {"id": pid, "name": pid, "ws": Socket()} for pid in active},
        "points": {pid: 0 for pid in active},
    }


def send(room, pid, answer):
    handle_party_event(room, pid, "uniq_answer", {"text": answer}, pid == room["owner"])


def test_edit_before_reveal():
    room = room_with_players()
    start_party(room)
    assert room["phase"] == "uniq_answer"
    send(room, "p0", "赤いりんご")
    my_state = party_snapshot(room, "p0")["room"]["party"]
    other_state = party_snapshot(room, "p1")["room"]["party"]
    assert my_state["submitted"] is True
    assert my_state["submittedCount"] == 1
    assert my_state["myAnswer"] == "赤いりんご"
    assert other_state["myAnswer"] is None
    assert "赤いりんご" not in str(other_state)

    send(room, "p0", "青いりんご")
    assert len(room["party"]["answers"]) == 1
    assert party_snapshot(room, "p0")["room"]["party"]["myAnswer"] == "青いりんご"

    send(room, "p1", "青いりんご")
    assert room["phase"] == "uniq_answer"
    assert party_snapshot(room, "p2")["room"]["party"]["submittedCount"] == 2

    send(room, "p2", "ぶどう")
    assert room["phase"] == "uniq_reveal"
    result = room["party"]["last"]
    assert result["success"] is False
    assert next(a for a in result["answers"] if a["pid"] == "p0")["text"] == "青いりんご"
    assert sum(a["duplicate"] for a in result["answers"]) == 2

    try:
        send(room, "p0", "答え合わせ後の書き換え")
        raise AssertionError("revealed answers must stay fixed")
    except ValueError:
        pass
    handle_party_event(room, "p0", "uniq_next", {}, True)
    assert room["phase"] == "uniq_answer"
    assert party_snapshot(room, "p0")["room"]["party"]["myAnswer"] is None
    assert party_snapshot(room, "p0")["room"]["party"]["submittedCount"] == 0


if __name__ == "__main__":
    test_edit_before_reveal()
    print("Unique answer edits and privacy passed")
