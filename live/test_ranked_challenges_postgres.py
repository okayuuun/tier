"""Real PostgreSQL, API privacy, ranking, duplicate and restart tests."""
import asyncio
import importlib
import json
import os

# Use only the dedicated CI database, never a production Render connection.
os.environ["ROOM_DATABASE_URL"] = os.environ["TEST_ROOM_DATABASE_URL"]

from aiohttp.test_utils import TestClient, TestServer
import server
import ranked_challenges as ranked

QUIZ = {
    "v": 2, "game": "quiz", "title": "友だち理解度",
    "config": {"qs": [
        {"q": "好きな果物は？", "options": ["りんご", "みかん", "バナナ", "もも"]},
        {"q": "好きな季節は？", "options": ["春", "夏", "秋", "冬"]},
    ]},
    "truth": [2, 0]
}
TIER = {"v": 2, "game": "tier", "title": "ティアランキング",
        "config": {"rounds": [{"title": "好きなお菓子",
                               "items": ["あめ", "せんべい", "ゼリー", "グミ", "チョコ"]}]},
        "truth": [[2, 0, 4, 1, 3]]}


async def main():
    async with TestClient(TestServer(server.app)) as client:
        invalid = await client.post("/api/ranked", json={**QUIZ, "game": "soup"})
        assert invalid.status == 400
        bad_answer = await client.post("/api/ranked", json={**QUIZ, "truth": [9, 0]})
        assert bad_answer.status == 400
        publish = await client.post("/api/ranked", json=QUIZ)
        assert publish.status == 200, await publish.text()
        created = await publish.json()
        code = created["id"]
        assert not created["temporary"]
        assert created["expiresInHours"] == 720

        public = await client.get("/api/ranked/" + code)
        assert public.status == 200
        body = await public.json()
        assert "truth" not in json.dumps(body, ensure_ascii=False)
        assert body["data"]["title"] == "友だち理解度"
        assert body["data"]["config"]["qs"][0]["options"][2] == "バナナ"

        initial = await client.get("/api/ranked/" + code + "/leaderboard")
        assert initial.status == 200 and (await initial.json())["total"] == 0

        start = await client.post("/api/ranked/" + code + "/start")
        token = (await start.json())["attempt"]
        bad = await client.post("/api/ranked/" + code + "/submit",
                                json={"attempt": token, "name": "A", "answers": [9, 0]})
        assert bad.status == 400
        bad_token = await client.post("/api/ranked/" + code + "/submit",
                  json={"attempt": "x"*32, "name": "誰か", "answers": [2, 0]})
        assert bad_token.status == 400

        await asyncio.sleep(.02)
        done = await client.post("/api/ranked/" + code + "/submit",
                                 json={"attempt": token, "name": "<script>", "answers": [2, 0]})
        assert done.status == 200, await done.text()
        first = await done.json()
        assert first["score"] == 2 and first["maxScore"] == 2
        assert first["truth"] == [2, 0]
        assert first["rank"] == 1 and first["durationMs"] > 0
        assert first["leaders"][0]["name"] == "<script>"
        assert "attempt" not in str(first["leaders"])
        # One attempt cannot improve its score on the next submission.
        replay = await client.post("/api/ranked/" + code + "/submit",
                     json={"attempt": token, "name": "bad", "answers": [0, 0]})
        assert replay.status == 200
        assert (await replay.json())["score"] == 2

        started2 = await client.post("/api/ranked/" + code + "/start")
        token2 = (await started2.json())["attempt"]
        second = await client.post("/api/ranked/" + code + "/submit",
                         json={"attempt": token2, "name": "友人B", "answers": [0, 0]})
        assert second.status == 200 and (await second.json())["score"] == 1
        rankings = await (await client.get("/api/ranked/" + code + "/leaderboard")).json()
        assert rankings["total"] == 2
        assert [x["score"] for x in rankings["rows"]] == [2, 1]
        assert all("truth" not in x and "_token" not in x
                   for x in rankings["rows"])

        tier = await client.post("/api/ranked", json=TIER)
        assert tier.status == 200
        tier_id = (await tier.json())["id"]
        tier_pub = await (await client.get("/api/ranked/" + tier_id)).json()
        assert "truth" not in json.dumps(tier_pub)
        tier_try = await client.post("/api/ranked/" + tier_id + "/start")
        tier_token = (await tier_try.json())["attempt"]
        res = await client.post("/api/ranked/" + tier_id + "/submit",
                          json={"attempt": tier_token, "name": "C",
                                "answers": [[2, 0, 4, 1, 3]]})
        assert res.status == 200, await res.text()
        assert (await res.json())["score"] == 5

    # The same random challenge IDs and results survive a fresh aiohttp app
    # and PostgreSQL pool; they aren't stored only in server globals.
    importlib.reload(server)
    async with TestClient(TestServer(server.app)) as client:
        lookup = await client.get("/api/ranked/" + code)
        assert lookup.status == 200
        assert "truth" not in (await lookup.text())
        scores = await (await client.get("/api/ranked/" + code + "/leaderboard")).json()
        assert scores["total"] == 2
        assert [r["name"] for r in scores["rows"]] == ["<script>", "友人B"]

        # Deliberate cleanup so this CI run leaves no published test records.
        async with ranked.ROOM_STORE.pool.acquire() as conn:
            await conn.execute("DELETE FROM nakami_ranked_challenges WHERE id=ANY($1::text[])",
                               [code, tier_id])

    print("PASS: public answers hidden, ranked scoring, single submission, four types and Neon restart")


if __name__ == "__main__":
    asyncio.run(main())
