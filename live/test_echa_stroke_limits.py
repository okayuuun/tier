"""Regression: >3000 pen/eraser marks and >120 fills must remain writable.

Fixed drawing limits previously disabled a room mid-session, and the
persisted art-room restore path had a hidden 1600-stroke cutoff.
"""
import asyncio
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
import echa_backend as art
from room_store import serialize_room, deserialize_room


async def recv(ws, kind):
    for _ in range(20):
        data = await asyncio.wait_for(ws.receive_json(), 6)
        if data.get("type") == kind:
            return data
        if data.get("type") == "error":
            raise AssertionError(data)
    raise AssertionError("Expected " + kind)


async def stroke(ws, tool="pen"):
    await ws.send_json({"type": "begin", "point": [.25, .25],
                        "color": "#123456", "width": 10,
                        "opacity": 1, "tool": tool, "layer": "base"})
    await ws.send_json({"type": "end"})
    return await recv(ws, "end")


def prior_stroke(index, tool="pen"):
    item = {
        "id": f"line-{index}", "layer": "base",
        "by": "prior-artist", "name": "作者",
        "tool": tool, "opacity": 1.0, "color": "#123456",
        "ts": 1,
    }
    if tool == "fill":
        item.update(point=[.7,.7], reference="layer", tolerance=15)
    else:
        item.update(width=8, points=[[.1,.1],[.2,.2]])
    return item


async def verify():
    art.ROOMS.clear()
    app = web.Application()
    art.register(app)
    try:
        async with TestClient(TestServer(app)) as client:
            response = await client.post("/api/echa/create")
            assert response.status == 200
            data = await response.json()
            code = data["code"]
            room = art.ROOMS[code]
            room["strokes"] = [prior_stroke(i) for i in range(3500)]
            # The old bucket cap was 120 entries. Existing art should remain
            # editable even after 121 legitimate fill operations.
            room["strokes"].extend(prior_stroke(3500 + i, "fill") for i in range(121))
            room["version"] = len(room["strokes"])

            ws = await client.ws_connect("/api/echa/ws")
            await ws.send_json({"type": "join", "code": code, "name": "テスター",
                                "ownerKey": data["ownerKey"]})
            snapshot = await recv(ws, "snapshot")
            assert "maxStrokes" not in snapshot
            assert len(snapshot["strokes"]) == 3621
            await recv(ws, "members")
            first = await stroke(ws, "pen")
            second = await stroke(ws, "eraser")
            assert first["stroke"]["tool"] == "pen"
            assert second["stroke"]["tool"] == "eraser"
            assert len(room["strokes"]) == 3623

            await ws.send_json({"type": "fill", "point": [.6,.6],
                                "layer": "base", "color": "#ff4499",
                                "opacity": 1, "tolerance": 15,
                                "reference": "layer"})
            filled = await recv(ws, "end")
            assert filled["stroke"]["tool"] == "fill"
            assert len(room["strokes"]) == 3624

            # Undo must still work after the old quota.
            await ws.send_json({"type": "undo"})
            await recv(ws, "remove")
            assert len(room["strokes"]) == 3623

            # Snapshot round-trip must restore every stroke and the in-flight
            # stroke rather than silently dropping the 1601st mark.
            room["drawing"]["still-drawing"] = {
                **prior_stroke(9001), "id": "pending-9001"
            }
            saved = serialize_room("art", room)
            recovered = deserialize_room("art", saved)
            assert len(recovered["strokes"]) == 3624
            assert recovered["strokes"][-1]["id"] == "pending-9001"
            assert recovered["drawing"] == {}
            assert recovered["members"] == {}
            await ws.close()
    finally:
        art.ROOMS.clear()


if __name__ == "__main__":
    asyncio.run(verify())
    print("PASS: unlimited art strokes, bucket operations, undo and full restart recovery")
