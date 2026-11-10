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
            await master.stop_cloud()
            await recovered.stop_cloud()
    finally:
        ROOM_STORE.pool, ROOM_STORE.enabled = old_pool, old_enabled
        await pool.close()


if __name__ == "__main__":
    asyncio.run(verify())
    print("Master activity remains accessible after restart in PostgreSQL")
