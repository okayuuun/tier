"""Real HTTP tests for three new self-authored ranked quiz mechanics."""
import asyncio
import json
from aiohttp.test_utils import TestClient, TestServer
import server


def question(text, items):
    return {"q": text, "options": items, "image": "", "optionImages": [""] * len(items)}


CASES = [
    ("truefalse",
     {"qs": [question("富士山は日本一高い山？", ["○ 正しい", "× 間違い"]),
              question("海水は甘い？", ["○ 正しい", "× 間違い"])]},
     [0, 1], [0, 1], 2, 2, [1, 2]),
    ("multi",
     {"qs": [question("果物をすべて選んで", ["りんご", "にんじん", "みかん", "ねぎ"])]},
     [[0, 2]], [[2, 0]], 1, 1, [[1]]),
    ("order",
     {"qs": [question("生まれた順に並べて", ["人A", "人B", "人C", "人D"])]},
     [[2, 0, 3, 1]], [[2, 0, 1, 3]], 2, 4, [[0, 0, 1, 2]])
]


async def post(client, code, payload):
    return await client.post("/api/ranked/" + code + "/submit", json=payload)


async def main():
    server.ROOMS.clear()
    async with TestClient(TestServer(server.app)) as client:
        for kind, config, truth, answer, score, maximum, invalid in CASES:
            challenge = {"v": 2, "game": kind, "title": "新しいゲーム " + kind,
                         "config": config, "truth": truth}
            r = await client.post("/api/ranked", json=challenge)
            assert r.status == 200, (kind, await r.text())
            saved = await r.json()
            code = saved["id"]
            r = await client.get("/api/ranked/" + code)
            assert r.status == 200
            visible = await r.json()
            assert visible["data"]["game"] == kind
            assert "truth" not in json.dumps(visible, ensure_ascii=False)
            assert visible["data"]["config"]["qs"][0]["q"] == config["qs"][0]["q"]
            start = await client.post("/api/ranked/" + code + "/start")
            assert start.status == 200
            token = (await start.json())["attempt"]
            bad = await post(client, code, {"attempt": token,
                                              "name": "不正解答",
                                              "answers": invalid})
            assert bad.status == 400, (kind, await bad.text())
            good = await post(client, code, {"attempt": token,
                                               "name": "回答者" + kind,
                                               "answers": answer})
            assert good.status == 200, (kind, await good.text())
            result = await good.json()
            assert result["score"] == score and result["maxScore"] == maximum, (kind, result)
            assert result["truth"] == truth
            assert result["rank"] == 1
            second = await post(client, code, {"attempt": token,
                                                  "name": "二重提出",
                                                  "answers": answer})
            assert (await second.json())["score"] == score
            board = await (await client.get(
                "/api/ranked/" + code + "/leaderboard")).json()
            assert board["total"] == 1 and board["rows"][0]["score"] == score
            assert board["rows"][0]["name"] == "回答者" + kind
            assert "truth" not in json.dumps(board)
            assert "attempt" not in json.dumps(board)

        # Reject incomplete or misleading authoring data before publishing.
        multi_config = CASES[1][1]
        for answer_key in [[0], [0, 0], [0, 4], ["0", 1]]:
            invalid = {"v": 2, "game": "multi", "title": "不正",
                       "config": multi_config, "truth": [answer_key]}
            r = await client.post("/api/ranked", json=invalid)
            assert r.status == 400, (answer_key, await r.text())
        for answer_key in [[0, 0, 1, 2], [0, 1, 2], [0, 1, 2, "3"]]:
            invalid = {"v": 2, "game": "order", "title": "不正",
                       "config": CASES[2][1], "truth": [answer_key]}
            r = await client.post("/api/ranked", json=invalid)
            assert r.status == 400, (answer_key, await r.text())

    print("PASS: ○×, multiple-correct, ordering; hidden keys, graded results and public boards")


if __name__ == "__main__":
    asyncio.run(main())
