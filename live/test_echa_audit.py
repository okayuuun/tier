"""Audit only art-room metadata, including reconnections and disconnections."""
import asyncio
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
from echa_backend import ROOMS, register


class Audit:
    def __init__(self):
        self.rows = []

    def log_action(self, room, name, action, detail=""):
        self.rows.append((room["code"], room["game"], name, action, detail))


async def receive_type(ws, typ):
    for _ in range(8):
        data = await asyncio.wait_for(ws.receive_json(), 3)
        if data.get("type") == typ:
            return data
    raise AssertionError("Missing " + typ)


async def wait_for_action(sink, action, expected=1):
    # Snapshot/member packets can arrive before the server finishes writing
    # audit metadata. Poll the actual event count instead of racing that task.
    for _ in range(80):
        if sum(row[3] == action for row in sink.rows) >= expected:
            return
        await asyncio.sleep(0.02)
    raise AssertionError("Missing audit action: " + action)


async def check():
    ROOMS.clear()
    sink = Audit()
    app = web.Application()
    app["master_admin"] = sink
    register(app)
    async with TestClient(TestServer(app)) as client:
        r = await client.post("/api/echa/create")
        assert r.status == 200
        data = await r.json()
        code = data["code"]
        assert sink.rows[-1] == (code, "echa", "作成者（入室前）", "echa_create", "")

        one = await client.ws_connect("/api/echa/ws")
        await one.send_json({"type": "join", "code": code,
                             "name": "作者", "ownerKey": data["ownerKey"]})
        await receive_type(one, "snapshot")
        await receive_type(one, "members")
        await wait_for_action(sink, "echa_join")
        assert sink.rows[-1][:4] == (code, "echa", "作者", "echa_join")
        two = await client.ws_connect("/api/echa/ws")
        await two.send_json({"type": "join", "code": code,
                             "name": "友人"})
        snap = await receive_type(two, "snapshot")
        resume = snap["resumeToken"]
        await receive_type(two, "members")
        await wait_for_action(sink, "echa_join", 2)
        assert sink.rows[-1][:4] == (code, "echa", "友人", "echa_join")

        await two.send_json({"type": "chat", "text": "秘密のテストメッセージ"})
        await receive_type(one, "chat")
        await wait_for_action(sink, "echa_chat")
        assert sink.rows[-1][3] == "echa_chat"
        assert "秘密" not in repr(sink.rows)

        # Undo still removes the artist's stroke but must not flood
        # developer activity with one log row for every correction.
        for i in range(2):
            await one.send_json({"type": "begin", "point": [.2, .2],
                                 "color": "#123456", "width": 8,
                                 "opacity": 1, "tool": "pen", "layer": "base"})
            await one.send_json({"type": "end"})
            await receive_type(one, "end")
            await receive_type(two, "end")
            assert len(ROOMS[code]["strokes"]) == 1
            await one.send_json({"type": "undo"})
            await receive_type(one, "remove")
            await receive_type(two, "remove")
            assert ROOMS[code]["strokes"] == []

        # The next audited event establishes that the earlier undo actions
        # have already finished; no timing race hides a stray undo log.
        await one.send_json({"type": "chat", "text": "操作記録の同期"})
        await receive_type(two, "chat")
        await wait_for_action(sink, "echa_chat", 2)
        assert all(row[3] != "echa_undo" for row in sink.rows)
        assert sum(row[3] == "echa_join" for row in sink.rows) == 2

        await two.close()
        await wait_for_action(sink, "echa_disconnect")
        resumed = await client.ws_connect("/api/echa/ws")
        await resumed.send_json({"type": "join", "code": code,
                                 "name": "友人", "resumeToken": resume})
        same = await receive_type(resumed, "snapshot")
        assert same["me"] == snap["me"]
        await wait_for_action(sink, "echa_rejoin")
        assert sink.rows[-1][3] == "echa_rejoin"

        await one.close()
        await resumed.close()
        await wait_for_action(sink, "echa_disconnect", 3)
        assert sum(row[3] == "echa_join" for row in sink.rows) == 2
        assert sum(row[3] == "echa_rejoin" for row in sink.rows) == 1
        assert sum(row[3] == "echa_disconnect" for row in sink.rows) == 3
        assert "ownerKey" not in repr(sink.rows)
        assert "resumeToken" not in repr(sink.rows)
    ROOMS.clear()


if __name__ == "__main__":
    asyncio.run(check())
    print("Art activity audit and no secret leakage passed")
