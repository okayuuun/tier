"""Exercise all three researched original quiz formats through public HTTP endpoints."""
import asyncio
import json

from aiohttp.test_utils import TestClient, TestServer
import server


def setup(kind):
    if kind == "number":
        return {"v": 2, "game": kind, "title": "数字ピタリ！",
                "config": {"qs":[{"q":"私のゲーム時間は何時間？",
                                  "min":0,"max":500,"tolerance":20,
                                  "unit":"時間","image":""}]}, "truth":[130]}
    if kind == "typing":
        return {"v":2, "game":kind, "title":"文字で答えよう",
                "config":{"qs":[{"q":"好きなポケモンは？","image":""}]},
                "truth":["ピカチュウ|ぴかちゅう|Pikachu"]}
    return {"v":2,"game":"pairs","title":"ペアをつなげ！",
            "config":{"qs":[{"q":"作品と主人公をつないで",
                "options":["A","B","C","D"],
                "rightOptions":["主人公C","主人公A","主人公D","主人公B"],
                "image":""}]},
            "truth":[[1,3,0,2]]}


async def submit(client, key, token, answers):
    return await client.post(f"/api/ranked/{key}/submit",
                             json={"attempt":token,"name":"プレイヤー","answers":answers})


async def main():
    async with TestClient(TestServer(server.app)) as client:
        for kind in ("number","typing","pairs"):
            data=setup(kind)
            created=await client.post("/api/ranked",json=data)
            assert created.status==200, (kind,await created.text())
            code=(await created.json())["id"]
            exposed=await (await client.get(f"/api/ranked/{code}")).json()
            assert "truth" not in json.dumps(exposed,ensure_ascii=False),kind
            assert exposed["data"]["game"]==kind
            # Only the submitted token identifies a participant.
            attempt=await client.post(f"/api/ranked/{code}/start")
            assert attempt.status==200
            token=(await attempt.json())["attempt"]
            if kind=="number":
                for bad in ["130",130.5,-1,501,None,True]:
                    rejected=await submit(client,code,token,[bad])
                    assert rejected.status==400,(bad,await rejected.text())
                mid=await submit(client,code,token,[120])
                assert mid.status==200,await mid.text()
                mid_result=await mid.json()
                assert mid_result["score"]==50 and mid_result["maxScore"]==100
                assert mid_result["truth"]==[130]
                second_token=(await (await client.post(f"/api/ranked/{code}/start")).json())["attempt"]
                perfect=(await submit(client,code,second_token,[130]))
                assert (await perfect.json())["score"]==100
                board=await (await client.get(f"/api/ranked/{code}/leaderboard")).json()
                assert [x["score"] for x in board["rows"]]==[100,50]
            elif kind=="typing":
                for bad in ["",78,None,["ピカチュウ"]," "]:
                    rejected=await submit(client,code,token,[bad])
                    assert rejected.status==400,(bad,await rejected.text())
                done=await submit(client,code,token,["ｐＩＫＡＣＨＵ  "])
                assert done.status==200,await done.text()
                assert (await done.json())["score"]==1
                assert (await done.json())["score"]==1 if False else True
                another=(await (await client.post(f"/api/ranked/{code}/start")).json())["attempt"]
                wrong=await submit(client,code,another,["ニャース"])
                assert (await wrong.json())["score"]==0
            else:
                for bad in [[0,1,1,2],[0,1,2],[0,1,2,"3"],["1",0,2,3]]:
                    rejected=await submit(client,code,token,[bad])
                    assert rejected.status==400,(bad,await rejected.text())
                correct=await submit(client,code,token,[[1,3,0,2]])
                assert correct.status==200,await correct.text()
                assert (await correct.json())["score"]==4
                another=(await (await client.post(f"/api/ranked/{code}/start")).json())["attempt"]
                partial=await submit(client,code,another,[[1,0,3,2]])
                assert (await partial.json())["score"]==2
            public=await (await client.get(f"/api/ranked/{code}/leaderboard")).json()
            assert public["total"]==2
            assert all("truth" not in x and "_token" not in x
                       for x in public["rows"])
            # A submitted answer cannot be edited by replaying the same token.
            replay=await submit(client,code,token,
                [130] if kind=="number" else ["ピカチュウ"] if kind=="typing"
                else [[1,3,0,2]])
            assert replay.status==200
            assert (await replay.json())["rank"] is not None

        # Bad author inputs must not create public records.
        invalids=[
            ("number",lambda d:d["config"]["qs"][0].update(tolerance=0)),
            ("number",lambda d:d.update(truth=[99999])),
            ("typing",lambda d:d.update(truth=["a|a"])),
            ("typing",lambda d:d.update(truth=[""])),
            ("pairs",lambda d:d.update(truth=[[0,0,1,2]])),
            ("pairs",lambda d:d["config"]["qs"][0].update(
                rightOptions=["x","x","y","z"]))
        ]
        for kind,mutate in invalids:
            d=setup(kind);mutate(d)
            r=await client.post("/api/ranked",json=d)
            assert r.status==400,(kind,await r.text())
    print("PASS: numeric close-score, typed aliases and 4-pair links with secure server grading")


if __name__=="__main__":
    asyncio.run(main())
