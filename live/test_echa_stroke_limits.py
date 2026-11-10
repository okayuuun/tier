"""Regression: bounded canvas refuses the third mark rather than silently pretending it saved."""
import asyncio
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
import echa_backend as art


async def recv(ws, kind):
    for _ in range(12):
        data = await asyncio.wait_for(ws.receive_json(), 4)
        if data.get("type") == kind:
            return data
        if data.get("type") == "error" and kind != "error":
            raise AssertionError(data)
    raise AssertionError("Expected " + kind)


async def stroke(ws, tool="pen"):
    await ws.send_json({"type": "begin", "point": [.25, .25],
                        "color": "#123456", "width": 10,
                        "opacity": 1, "tool": tool, "layer": "base"})
    await ws.send_json({"type": "end"})
    return await recv(ws, "end")


async def verify():
    prior = art.MAX_STROKES
    art.MAX_STROKES = 2
    art.ROOMS.clear()
    try:
        app = web.Application()
        art.register(app)
        async with TestClient(TestServer(app)) as client:
            data = await (await client.post("/api/echa/create")).json()
            code = data["code"]
            ws = await client.ws_connect("/api/echa/ws")
            await ws.send_json({"type": "join", "code": code, "name": "テスター",
                                "ownerKey": data["ownerKey"]})
            snapshot = await recv(ws, "snapshot")
            assert snapshot["maxStrokes"] == 2
            await recv(ws, "members")
            first = await stroke(ws)
            second = await stroke(ws, "eraser")
            assert first["stroke"]["tool"] == "pen"
            assert second["stroke"]["tool"] == "eraser"
            assert len(art.ROOMS[code]["strokes"]) == 2
            await ws.send_json({"type": "begin", "point": [.7, .7],
                                "color": "#123456", "width": 10,
                                "opacity": 1, "tool": "pen", "layer": "base"})
            rejected = await recv(ws, "error")
            assert rejected["action"] == "begin"
            assert "上限" in rejected["message"]
            assert len(art.ROOMS[code]["strokes"]) == 2
            assert not art.ROOMS[code]["drawing"]
            # Undo releases one slot, and a further drawing can finish.
            await ws.send_json({"type": "undo"})
            await recv(ws, "remove")
            assert len(art.ROOMS[code]["strokes"]) == 1
            await stroke(ws)
            assert len(art.ROOMS[code]["strokes"]) == 2
            await ws.send_json({"type": "sync"})
            synced = await recv(ws, "sync")
            assert len(synced["strokes"]) == 2
            await ws.close()
    finally:
        art.MAX_STROKES = prior
        art.ROOMS.clear()


if __name__ == "__main__":
    asyncio.run(verify())
    print("PASS: rejected full canvas, per-action error and resumed ink after undo")
