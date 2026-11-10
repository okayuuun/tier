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
        assert sink.rows[-1][:4] == (code, "echa", "作者", "echa_join")
        two = await client.ws_connect("/api/echa/ws")
        await two.send_json({"type": "join", "code": code,
                             "name": "友人"})
        snap = await receive_type(two, "snapshot")
        resume = snap["resumeToken"]
        await receive_type(two, "members")
        assert sink.rows[-1][:4] == (code, "echa", "友人", "echa_join")

        await two.send_json({"type": "chat", "text": "秘密のテストメッセージ"})
        await receive_type(one, "chat")
        assert sink.rows[-1][3] == "echa_chat"
        assert "秘密" not in repr(sink.rows)

        await two.close()
        await asyncio.sleep(0.1)
        assert ("echa_disconnect" in [row[3] for row in sink.rows])
        resumed = await client.ws_connect("/api/echa/ws")
        await resumed.send_json({"type": "join", "code": code,
                                 "name": "友人", "resumeToken": resume})
        same = await receive_type(resumed, "snapshot")
        assert same["me"] == snap["me"]
        assert sink.rows[-1][3] == "echa_rejoin"

        await one.close()
        await resumed.close()
        await asyncio.sleep(0.1)
        assert sum(row[3] == "echa_join" for row in sink.rows) == 2
        assert sum(row[3] == "echa_rejoin" for row in sink.rows) == 1
        assert sum(row[3] == "echa_disconnect" for row in sink.rows) == 3
        assert "ownerKey" not in repr(sink.rows)
        assert "resumeToken" not in repr(sink.rows)
    ROOMS.clear()


if __name__ == "__main__":
    asyncio.run(check())
    print("Art activity audit and no secret leakage passed")
