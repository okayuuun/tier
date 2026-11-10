"""ワードウルフの再投票・秘密保持・締め切りの自動テスト。"""
from party_modes import start_party, party_snapshot, handle_party_event


class Socket:
    closed = False


def room_with_players():
    active = ["p0", "p1", "p2", "p3"]
    return {
        "game": "wolf", "code": "WOLF01", "matchNo": 1,
        "phase": "lobby", "owner": "p0", "active": active,
        "endedEarly": False,
        "players": {pid: {"id": pid, "name": pid, "ws": Socket()} for pid in active},
        "points": {pid: 0 for pid in active},
    }


def vote(room, who, target):
    handle_party_event(room, who, "wolf_vote", {"target": target}, who == room["owner"])


def test_private_vote_changes():
    room = room_with_players()
    start_party(room)
    p = room["party"]
    p["wolf"] = "p2"  # 選ばれた票を期待どおり判定するため、テストで固定する。

    vote(room, "p0", "p1")
    first = party_snapshot(room, "p0")["room"]["party"]
    another = party_snapshot(room, "p1")["room"]["party"]
    assert first["myVote"] == "p1"
    assert first["votedPlayers"] == ["p0"]
    assert another["myVote"] is None
    assert another["votedCount"] == 1
    assert another["votedPlayers"] == ["p0"]
    assert "votes" not in another  # 他人の投票先は決して通知しない。

    vote(room, "p0", "p2")
    assert p["votes"] == {"p0": "p2"}
    assert party_snapshot(room, "p1")["room"]["party"]["votedCount"] == 1
    try:
        vote(room, "p0", "p2")
        raise AssertionError("同じ候補への二重投票を受理した")
    except ValueError:
        pass

    vote(room, "p1", "p2")
    vote(room, "p2", "p0")
    assert room["phase"] == "wolf_talk"
    vote(room, "p3", "p2")
    assert room["phase"] == "wolf_guess"
    assert party_snapshot(room, "p2")["room"]["party"]["canGuess"]
    assert not party_snapshot(room, "p0")["room"]["party"]["canGuess"]

    try:
        vote(room, "p0", "p1")
        raise AssertionError("全員提出後も投票を変えられた")
    except ValueError:
        pass

    handle_party_event(room, "p2", "wolf_guess", {"text": p["pair"][0]}, False)
    assert room["phase"] == "wolf_reveal"
    result = p["last"]
    assert result["caught"] and result["wolfGuessed"]
    assert next(x for x in result["votes"] if x["pid"] == "p0")["target"] == "p2"
    assert room["points"] == {"p0": 2, "p1": 2, "p2": 3, "p3": 2}


def test_host_early_close():
    room = room_with_players()
    start_party(room)
    vote(room, "p0", "p2")
    vote(room, "p1", "p3")
    handle_party_event(room, "p0", "wolf_force", {}, True)
    assert room["phase"] in ("wolf_guess", "wolf_reveal")
    try:
        vote(room, "p0", "p3")
        raise AssertionError("締め切り後の投票を受理した")
    except ValueError:
        pass


if __name__ == "__main__":
    test_private_vote_changes()
    test_host_early_close()
    print("Wolf vote changes, privacy and closing passed")
