"""Memory-only ranking mode still works, with explicit temporary-link warning."""
import asyncio
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
import ranked_challenges as rank


class Master:
    def published(self, game):
        return game != "soup"


async def main():
    app = web.Application()
    app["master_admin"] = Master()
    rank.register(app)
    async with TestClient(TestServer(app)) as client:
        data = {"v":2,"game":"either","title":"究極の2択",
                "config":{"qs":[{"q":"好きなのは？",
                                  "options":["海","山"]}]},
                "truth":[1]}
        created = await client.post("/api/ranked",json=data)
        assert created.status == 200, await created.text()
        meta = await created.json()
        assert meta["temporary"] is True
        assert meta["expiresInHours"] == 36
        code=meta["id"]
        public = await (await client.get("/api/ranked/"+code)).json()
        assert "truth" not in str(public)
        start=await (await client.post("/api/ranked/"+code+"/start")).json()
        answer=await client.post("/api/ranked/"+code+"/submit",
                     json={"attempt":start["attempt"],"name":"友だち",
                           "answers":[1]})
        assert answer.status==200
        score=await answer.json()
        assert score["score"]==1 and score["maxScore"]==1
        assert score["rank"]==1
        board=await (await client.get("/api/ranked/"+code+"/leaderboard")).json()
        assert board["rows"][0]["name"]=="友だち"
        assert board["rows"][0]["score"]==1
        assert board["total"]==1
    print("PASS: temporary ranking links, correct score and public result privacy")


if __name__ == "__main__":
    asyncio.run(main())
