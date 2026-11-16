"""Durable master audit/history tests against a real temporary PostgreSQL service."""
import asyncio
import hashlib
import os
import tempfile
import time
import asyncpg
from aiohttp import web
from aiohttp.test_utils import TestServer, TestClient
from master_admin import MasterAdmin
from room_store import store as ROOM_STORE, normalize_postgres_dsn


async def verify():
    dsn = os.environ.get("TEST_ROOM_DATABASE_URL")
    assert dsn, "Configure the isolated TEST_ROOM_DATABASE_URL"
    pool = await asyncpg.create_pool(dsn=normalize_postgres_dsn(dsn),
                                     min_size=1, max_size=3, statement_cache_size=0)
    old_pool, old_enabled = ROOM_STORE.pool, ROOM_STORE.enabled
    ROOM_STORE.pool, ROOM_STORE.enabled = pool, True
    try:
        with tempfile.TemporaryDirectory() as temp:
            os.environ["MASTER_DB_PATH"] = os.path.join(temp, "first.sqlite")
            master = MasterAdmin()
            await master.start_cloud()
            assert master.activity_storage == "postgres"
            async with pool.acquire() as conn:
                await conn.execute("DELETE FROM nakami_master_audit")
                await conn.execute("DELETE FROM nakami_master_history")
                await conn.execute("DELETE FROM nakami_master_favorite_users")
            master.log_action({"code": "ABC123", "game": "echa"},
                              "友人", "echa_join")
            master.log_action({"code": "ABC123", "game": "echa"},
                              "友人", "echa_chat")
            master.log_action({"code": "DEF456", "game": "wolf"},
                              "友人", "wolf_vote")
            match = {
                "code": "DEF456", "game": "wolf", "matchNo": 1,
                "players": {"p0": {"name": "友人"}},
                "points": {"p0": 2}, "phase": "final",
            }
            master.save_match(match)
            # A browser-local, non-secret ID groups visits across rooms, and
            # favorites are private to the administrator outside the lobby.
            admin_browser = "a1" * 16
            master.observe_player(
                {"code": "DEF456", "game": "wolf"},
                {"id": "player1", "name": "友人", "profileId": admin_browser,
                 "favorites": ["wolf", "tier"]})
            master.observe_player(
                {"code": "XYZ123", "game": "tier"},
                {"id": "player2", "name": "名前変更", "profileId": admin_browser,
                 "favorites": ["soup"]})
            master.observe_player(
                {"code": "XYZ123", "game": "tier"},
                {"id": "older-player", "name": "同名の別端末",
                 "profileId": "b2" * 16, "favorites": []})
            await master.flush_cloud(timeout=5)

            # Simulated restart: an entirely different local SQLite DB.
            os.environ["MASTER_DB_PATH"] = os.path.join(temp, "second.sqlite")
            recovered = MasterAdmin()
            await recovered.start_cloud()
            assert recovered.db.execute("SELECT COUNT(*) FROM audit").fetchone()[0] == 0
            recovered.sessions[hashlib.sha256(b"fake-session").hexdigest()] = time.time() + 200
            app = web.Application()
            recovered.register(app, {}, None)
            async with TestClient(TestServer(app)) as client:
                headers = {"Cookie": "nakami_master=fake-session"}
                denied = await client.get("/api/master/logs?game=echa")
                assert denied.status == 401
                logs = await client.get("/api/master/logs?game=echa", headers=headers)
                assert logs.status == 200, await logs.text()
                payload = await logs.json()
                assert len(payload["rows"]) == 2, payload
                assert all(row["game"] == "echa" for row in payload["rows"])
                assert all(row["player"] == "友人" for row in payload["rows"])
                assert any(row["label"] == "絵チャに参加" for row in payload["rows"])
                # Sensitive profile roster requires the same master cookie
                # as the activity logs. Public routes cannot access it.
                denied_users = await client.get("/api/master/favorite-users")
                assert denied_users.status == 401
                users = await client.get("/api/master/favorite-users", headers=headers)
                assert users.status == 200, await users.text()
                users_payload = await users.json()
                assert len(users_payload["rows"]) == 2, users_payload
                row = next(r for r in users_payload["rows"]
                           if r["name"] == "名前変更")
                assert row["favorites"] == ["soup"]
                assert row["lastRoom"] == "XYZ123"
                assert row["personKey"] == admin_browser[-6:]
                assert row["firstSeen"] <= row["lastSeen"]
                assert "profileId" not in row and "sid" not in row
                assert row["online"] is False
                assert users.headers["Cache-Control"] == "no-store"
                history = await client.get("/api/master/history", headers=headers)
                assert history.status == 200, await history.text()
                assert len((await history.json())["rows"]) == 1
                state = await client.get("/api/master/state", headers=headers)
                assert state.status == 200, await state.text()
                s = await state.json()
                assert s["activityStorage"] == "postgres"
                assert s["counts"]["events"] == 3
                assert s["counts"]["history"] == 1

                base = str(client.make_url("/")).rstrip("/")
                write_headers = {**headers, "X-Master-Request": "1", "Origin": base}
                purge = await client.post("/api/master/purge",
                                          json={"kind": "all", "confirm": "DELETE"},
                                          headers=write_headers)
                assert purge.status == 200, await purge.text()
                cleared = await client.get("/api/master/state", headers=headers)
                assert (await cleared.json())["counts"]["events"] == 0
                blank_users = await client.get("/api/master/favorite-users", headers=headers)
                assert (await blank_users.json())["rows"] == []
            await master.stop_cloud()
            await recovered.stop_cloud()
    finally:
        ROOM_STORE.pool, ROOM_STORE.enabled = old_pool, old_enabled
        await pool.close()


if __name__ == "__main__":
    asyncio.run(verify())
    print("Master activity remains accessible after restart in PostgreSQL")
