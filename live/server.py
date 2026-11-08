"""なかみくらべ。リアルタイム版 / aiohttp WebSocket server.
Rooms and scores live in memory and disappear on server restart.
"""
import asyncio
import json
import os
import re
import secrets
import time
from pathlib import Path
from aiohttp import web, WSMsgType
from party_modes import GAME_IDS as PARTY_IDS, EVENTS as PARTY_EVENTS, start_party, party_snapshot, handle_party_event
from custom_live import EVENTS as STUDIO_EVENTS, handle as studio_handle, start as studio_start, snapshot as studio_snapshot, public_meta as studio_meta, reveal as studio_reveal

ROOT = Path(__file__).parent
CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
ROOMS = {}
MAX_PLAYERS = 12
EXAMPLES = json.loads((ROOT / "examples.json").read_text(encoding="utf-8"))
QUESTION_COUNT = 5
CONFIGS = {
    "ito": {"title": "ことばの数値リレー"},
    "propose": {"title": "ひと言プロポーズ"},
    "akaito": {"title": "アカイイト｜100になるペア"},
    "unique": {"title": "全員不一致チャレンジ"},
    "wolf": {"title": "ワードウルフ｜少数派を探せ"},
    "soup": {"title": "ひらめきのスープ"},
    "tier": {
        "title": "休日にいちばんやりたいこと",
        "items": ["ゲーム", "映画", "カラオケ", "旅行", "家でのんびり"],
    },
    "value": {
        "title": "これって重い？価値観予想",
        "qs": [
            {"q": "毎日「好き」と言ってくれる", "options": ["嬉しい", "嬉しいけど重い", "重い"]},
            {"q": "朝と夜、毎日あいさつの連絡をくれる", "options": ["嬉しい", "嬉しいけど重い", "重い"]},
            {"q": "LINEをすぐに返さないと催促される", "options": ["嬉しい", "嬉しいけど重い", "重い"]},
            {"q": "デートのたび家まで送り届けてくれる", "options": ["嬉しい", "嬉しいけど重い", "重い"]},
            {"q": "好きな作品を全部知ろうとしてくれる", "options": ["嬉しい", "嬉しいけど重い", "重い"]},
            {"q": "毎回デートを細かく計画してくれる", "options": ["嬉しい", "嬉しいけど重い", "重い"]},
        ],
    },
    "either": {
        "title": "恋愛究極の二択予想",
        "qs": [
            {"q": "付き合うならどっち？", "options": ["顔がタイプだけどお金がない", "お金持ちだけど顔がタイプではない"]},
            {"q": "どちらの恋愛を選ぶ？", "options": ["一生自分から告白する", "一生相手から告白される"]},
            {"q": "好きのバランスは？", "options": ["自分が100好き・相手が70好き", "相手が100好き・自分が70好き"]},
            {"q": "どちらがいい？", "options": ["毎日好きと言うけど行動は苦手", "好きとは言わないけど行動で示す"]},
            {"q": "プレゼントなら？", "options": ["高価だけど趣味ではない", "安いけど好みにぴったり"]},
            {"q": "会える頻度は？", "options": ["毎日会えるけど短時間", "週1回だけど長時間"]},
        ],
    },
    "quiz": {
        "title": "友達の理解度クイズ",
        "qs": [
            {"q": "いちばん落ち着く場所は？", "options": ["自分の部屋", "カフェ", "自然のある所", "にぎやかな所"]},
            {"q": "休日にいちばんしたいことは？", "options": ["ゲーム", "外出", "睡眠", "創作"]},
            {"q": "自分にとって大切なのは？", "options": ["自由", "安心", "刺激", "人とのつながり"]},
            {"q": "好きな連絡頻度は？", "options": ["毎日何回も", "毎日少し", "用事のときだけ", "気分次第"]},
            {"q": "遊びに行くときは？", "options": ["計画派", "ノープラン派", "相手に任せる", "半分だけ決める"]},
            {"q": "もらって嬉しいプレゼントは？", "options": ["実用品", "お菓子", "趣味のもの", "手紙"]},
        ],
    },
}


def code():
    while True:
        c = "".join(secrets.choice(CODE_CHARS) for _ in range(6))
        if c not in ROOMS:
            return c


def public_player(p, room):
    pid = p["id"]
    return {"id": pid, "name": p["name"], "online": bool(p["ws"] and not p["ws"].closed),
            "answered": pid in room["answers"], "guessed": pid in room["guesses"],
            "topicSubmitted": pid in room["topics"], "avatar": p.get("avatar", ""), "emoji": p.get("emoji", "🌷"),
            "score": room["points"].get(pid, 0)}


def active_target(room):
    if room["phase"] not in ("guess", "reveal") or room["roundIndex"] >= len(room["active"]):
        return None
    return room["active"][room["roundIndex"]]


def room_snapshot(room, pid):
    if room.get("custom") and room["phase"] != "lobby":
        info = studio_snapshot(room, pid)
        return {"type": "state", "me": pid, "room": {"code": room["code"], "owner": room["owner"],
                "game": room["game"], "phase": room["phase"], "players": [public_player(p, room) for p in room["players"].values()],
                "matchNo": room["matchNo"], "endedEarly": room["endedEarly"],
                "customMeta": studio_meta(room["custom"]), "studio": info}}
    if room['game'] in PARTY_IDS and room['phase'] != 'lobby':
        return party_snapshot(room, pid)
    target = active_target(room)
    phase = room["phase"]
    reveal = None
    visible_config = room["config"]
    if phase == "answer":
        visible_config = room["playerConfigs"].get(pid, visible_config)
    elif target:
        visible_config = room["playerConfigs"].get(target, visible_config)
    if phase == "reveal" and target:
        reveal = room["history"][-1] if room["history"] else None
    return {
        "type": "state", "me": pid,
        "room": {"code": room["code"], "owner": room["owner"], "game": room["game"],
                 "config": visible_config, "phase": phase,
                 "players": [public_player(p, room) for p in room["players"].values()],
                 "roundIndex": room["roundIndex"], "totalTargets": len(room["active"]),
                 "targetId": target, "active": room["active"],
                 "answeredCount": len(room["answers"]), "guessCount": len(room["guesses"]),
                 "myAnswer": room["answers"].get(pid), "myGuess": room["guesses"].get(pid),
                 "tierMode": room["tierMode"], "topicCount": len(room["topics"]),
                 "myTopic": room["topics"].get(pid) if phase == "compose" else None,
                 "matchNo": room["matchNo"],
                 "history": room["history"] if phase == "final" else None,
                 "endedEarly": room["endedEarly"],
                 "customMeta": studio_meta(room["custom"]) if room.get("custom") else None,
                 "reveal": reveal},
    }


async def send_json(ws, obj):
    if not ws or ws.closed:
        return
    try:
        await ws.send_str(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
    except (ConnectionError, RuntimeError):
        pass


async def broadcast(room):
    room["lastUsed"] = time.time()
    for pid, p in list(room["players"].items()):
        if p["ws"] and not p["ws"].closed:
            await send_json(p["ws"], room_snapshot(room, pid))


def validate_answers(room, pid, arr):
    if not isinstance(arr, list):
        return False
    if room["game"] == "tier":
        return len(arr) == 5 and all(type(x) is int for x in arr) and set(arr) == set(range(5))
    config = (room["playerConfigs"].get(pid, room["config"])
              if room["phase"] == "answer" else
              room["playerConfigs"].get(active_target(room), room["config"]))
    qs = config["qs"]
    return len(arr) == len(qs) and all(type(x) is int and 0 <= x < len(qs[i]["options"]) for i, x in enumerate(arr))


def valid_config(game, config):
    if not isinstance(config, dict):
        raise ValueError("お題のデータが不正です")
    if game == "tier":
        title = str(config.get("title", "")).strip()[:90]
        items = config.get("items")
        if not title or not isinstance(items, list) or len(items) != 5:
            raise ValueError("お題と5つのワードを指定してください")
        if any(not isinstance(x, str) for x in items):
            raise ValueError("ワードは文字列で指定してください")
        items = [x.strip()[:40] for x in items]
        if not all(items) or len(set(items)) != 5:
            raise ValueError("異なる5つのワードを入力してください")
        return {"title": title, "items": items}
    qs = config.get("qs")
    expected = {"value": 3, "either": 2, "quiz": 4}.get(game)
    if expected is None or not isinstance(qs, list) or len(qs) != QUESTION_COUNT:
        raise ValueError(f"{QUESTION_COUNT}問を入力してください")
    cleaned = []
    for x in qs:
        if not isinstance(x, dict) or not isinstance(x.get("q"), str):
            raise ValueError("質問文を入力してください")
        q = x["q"].strip()[:120]
        opts = x.get("options")
        if not q or not isinstance(opts, list) or len(opts) != expected or any(not isinstance(o, str) for o in opts):
            raise ValueError("質問文と選択肢をすべて入力してください")
        opts = [o.strip()[:80] for o in opts]
        if any(not o for o in opts) or len(set(opts)) != expected:
            raise ValueError("同じ選択肢は使えません")
        cleaned.append({"q": q, "options": opts})
    return {"title": CONFIGS[game]["title"], "qs": cleaned}


def random_config(game):
    source = EXAMPLES[game]
    if game == "tier":
        return secrets.choice(source).copy()
    return {"title": CONFIGS[game]["title"],
            "qs": secrets.SystemRandom().sample(source, QUESTION_COUNT)}


def assign_tier_topics(room):
    """Assign exactly one player-authored prompt per player without self-dealing in shuffle mode."""
    participants = list(room["active"])
    if len(participants) < 2 or any(pid not in room["topics"] for pid in participants):
        raise ValueError("2人以上のお題がそろっていません")
    room["playerConfigs"] = {}
    room["topicAuthors"] = {}
    if room["tierMode"] == "shuffle":
        mixed = participants[:]
        secrets.SystemRandom().shuffle(mixed)
        distance = secrets.randbelow(len(mixed) - 1) + 1
        for i, recipient in enumerate(mixed):
            author = mixed[(i + distance) % len(mixed)]
            room["playerConfigs"][recipient] = room["topics"][author].copy()
            room["topicAuthors"][recipient] = author
    else:
        for player in participants:
            room["playerConfigs"][player] = room["topics"][player].copy()
            room["topicAuthors"][player] = player
    room["phase"] = "answer"


async def handle_event(ws, context, obj):
    t = obj.get("type")
    if t in ("create", "join"):
        if context["room"]:
            raise ValueError("すでに参加しています")
        name = str(obj.get("name", "")).strip()[:24]
        sid = str(obj.get("sid", ""))[:90]
        if not name or not re.fullmatch(r"[a-zA-Z0-9_-]{12,90}", sid):
            raise ValueError("ニックネームとセッション情報を確認してください")
        if t == "create":
            c = code()
            room = {"code": c, "players": {}, "owner": None, "phase": "lobby",
                    "game": "tier", "config": dict(CONFIGS["tier"]), "active": [], "playerConfigs": {}, "answers": {},
                    "guesses": {}, "roundIndex": 0, "points": {}, "lastUsed": time.time(),
                    "tierMode": "self", "topics": {}, "topicAuthors": {}, "history": [], "matchNo": 0,
                    "endedEarly": False, "custom": None}
            ROOMS[c] = room
        else:
            c = str(obj.get("code", "")).upper().strip()
            room = ROOMS.get(c)
            if not room:
                raise ValueError("そのルームは見つかりません。サーバー再起動で消えた可能性もあります")
        returning = next((p for p in room["players"].values() if p["sid"] == sid), None)
        avatar = str(obj.get("avatar", ""))[:30032]
        avatar = avatar if re.fullmatch(r"data:image/jpeg;base64,[A-Za-z0-9+/=]{1,30000}", avatar) else ""
        emoji = str(obj.get("emoji", "🌷"))[:5]
        if returning:
            returning["avatar"] = avatar or returning.get("avatar", "")
            returning["emoji"] = emoji
            if returning["ws"] and not returning["ws"].closed and returning["ws"] is not ws:
                await returning["ws"].close(code=1000, message=b"replaced by reconnection")
            returning["ws"] = ws
            returning["name"] = name
            pid = returning["id"]
        else:
            if room["phase"] != "lobby":
                raise ValueError("ゲーム開始後は新しく参加できません（再接続はできます）")
            if len(room["players"]) >= MAX_PLAYERS:
                raise ValueError("このルームは満員です")
            pid = secrets.token_urlsafe(10)
            room["players"][pid] = {"id": pid, "sid": sid, "name": name, "ws": ws, "avatar": avatar, "emoji": emoji}
            room["points"][pid] = 0
            if not room["owner"]:
                room["owner"] = pid
        context["room"] = room
        context["pid"] = pid
        await broadcast(room)
        return

    room = context["room"]
    pid = context["pid"]
    if not room or not pid or room["players"][pid]["ws"] is not ws:
        raise ValueError("先にルームに参加してください")
    phase = room["phase"]
    is_owner = room["owner"] == pid
    if t in STUDIO_EVENTS:
        studio_handle(room, pid, t, obj, is_owner)
        await broadcast(room)
        return
    if t in PARTY_EVENTS:
        if room['game'] not in PARTY_IDS or room['phase'] == 'lobby':
            raise ValueError('このゲームではまだその操作は使えません')
        handle_party_event(room, pid, t, obj, is_owner)
        await broadcast(room)
        return
    if t == "configure":
        if not is_owner or phase != "lobby":
            raise ValueError("ルーム作成者が待機中に設定できます")
        game = obj.get("game")
        if game not in CONFIGS:
            raise ValueError("ゲームが不正です")
        room["game"] = game
        room["custom"] = None
        room["config"] = CONFIGS[game]
        mode = obj.get("tierMode", room["tierMode"])
        if mode not in ("self", "shuffle"):
            raise ValueError("お題の配布方法が不正です")
        room["tierMode"] = mode
    elif t == "start":
        if not is_owner or phase != "lobby":
            raise ValueError("ルーム作成者だけが開始できます")
        if len([p for p in room["players"].values() if p["ws"] and not p["ws"].closed]) < 2:
            raise ValueError("2人以上オンラインで参加してください")
        room["active"] = [p["id"] for p in room["players"].values() if p["ws"] and not p["ws"].closed]
        room["answers"] = {}
        room["guesses"] = {}
        room["playerConfigs"] = {}
        room["topics"] = {}
        room["topicAuthors"] = {}
        room["history"] = []
        room["endedEarly"] = False
        room["matchNo"] += 1
        room["roundIndex"] = 0
        room["points"] = {p: 0 for p in room["players"]}
        if room.get("custom"):
            studio_start(room)
        elif room['game'] in PARTY_IDS:
            start_party(room)
        else:
            room["phase"] = "compose"
    elif t == "example":
        if phase != "compose" or pid not in room["active"] or pid in room["topics"]:
            raise ValueError("今は例題を読み込めません")
        await send_json(ws, {"type": "example", "game": room["game"],
                             "matchNo": room["matchNo"], "config": random_config(room["game"])})
        return
    elif t == "topic":
        if phase != "compose" or pid not in room["active"]:
            raise ValueError("今はお題を提出できません")
        room["topics"][pid] = valid_config(room["game"], obj.get("config") or {})
        if all(p in room["topics"] for p in room["active"]):
            assign_tier_topics(room)
    elif t == "answer":
        if phase != "answer" or pid not in room["active"]:
            raise ValueError("今は正解を登録できません")
        answers = obj.get("answers")
        if not validate_answers(room, pid, answers):
            raise ValueError("回答の形式が不正です")
        room["answers"][pid] = answers
        if all(p in room["answers"] for p in room["active"]):
            room["phase"] = "guess"
            room["roundIndex"] = 0
            room["guesses"] = {}
    elif t == "guess":
        target = active_target(room)
        if phase != "guess" or pid not in room["active"] or pid == target:
            raise ValueError("今は予想できません")
        guess = obj.get("answers")
        if not validate_answers(room, pid, guess):
            raise ValueError("予想の形式が不正です")
        room["guesses"][pid] = guess
        if len(room["guesses"]) == len(room["active"]) - 1:
            reveal_round(room)
    elif t == "next":
        if not is_owner or phase != "reveal":
            raise ValueError("ルーム作成者が次に進めます")
        room["roundIndex"] += 1
        room["guesses"] = {}
        room["phase"] = "final" if room["roundIndex"] >= len(room["active"]) else "guess"
    elif t == "force":
        if not is_owner:
            raise ValueError("ルーム作成者だけがスキップできます")
        if phase == "studio_guess" and room.get("custom"):
            studio_reveal(room)
        elif phase == "compose":
            players = [p for p in room["active"] if p in room["topics"]]
            if len(players) < 2:
                raise ValueError("2人以上のお題が必要です")
            room["active"] = players
            assign_tier_topics(room)
        elif phase == "answer":
            players = [p for p in room["active"] if p in room["answers"]]
            if len(players) < 2:
                raise ValueError("2人以上が正解を登録してから続けてください")
            room["active"] = players
            room["phase"] = "guess"
            room["roundIndex"] = 0
            room["guesses"] = {}
        elif phase == "guess":
            reveal_round(room)
        else:
            raise ValueError("この場面ではスキップできません")
    elif t == "end":
        if not is_owner:
            raise ValueError("ゲーム全体の終了はルーム作成者だけが行えます")
        if phase == "lobby":
            raise ValueError("待機中はタイトルに戻ってください")
        room["endedEarly"] = phase != "final"
        room["phase"] = "final"
    elif t == "leave":
        room["players"].pop(pid, None)
        if phase == "lobby":
            room["points"].pop(pid, None)
        if room.get("custom") and pid == room["owner"] and room["phase"] != "lobby":
            room["phase"] = "final"
            room["endedEarly"] = True
        if room["owner"] == pid:
            room["owner"] = next((x for x, p in room["players"].items()
                                  if p["ws"] and not p["ws"].closed), None)
        context["room"] = None
        context["pid"] = None
        if room["players"]:
            await broadcast(room)
        else:
            ROOMS.pop(room["code"], None)
        await ws.close(code=1000, message=b"left room")
        return
    elif t == "restart":
        if not is_owner or phase != "final":
            raise ValueError("ルーム作成者だけがもう一度始められます")
        room["phase"] = "lobby"
        room.pop('party', None)
        room["active"] = []
        room["playerConfigs"] = {}
        room["topics"] = {}
        room["topicAuthors"] = {}
        room["history"] = []
        room["endedEarly"] = False
        room["answers"] = {}
        room["guesses"] = {}
        room["roundIndex"] = 0
        room["points"] = {p: 0 for p in room["players"]}
        # On a fresh match, remove disconnected members from the lobby.
        for oldid in [x for x, p in room["players"].items() if not p["ws"] or p["ws"].closed]:
            del room["players"][oldid]
            room["points"].pop(oldid, None)
        if room["owner"] not in room["players"] and room["players"]:
            room["owner"] = next(iter(room["players"]))
    else:
        raise ValueError("操作を認識できません")
    await broadcast(room)


def reveal_round(room):
    target = active_target(room)
    if not target:
        return
    truth = room["answers"][target]
    for pid, guess in room["guesses"].items():
        room["points"][pid] += sum(x == y for x, y in zip(truth, guess))
    author = room["topicAuthors"].get(target)
    topic = room["playerConfigs"].get(target, room["config"])
    room["history"].append({
        "targetId": target, "targetName": room["players"][target]["name"],
        "config": topic, "truth": truth[:],
        "creatorName": room["players"].get(author, {}).get("name") if author else None,
        "rows": [{"id": opid, "name": room["players"][opid]["name"],
                  "guess": guess[:], "score": sum(a == b for a, b in zip(guess, truth))}
                 for opid, guess in room["guesses"].items()],
    })
    room["phase"] = "reveal"


async def index(request):
    return web.FileResponse(ROOT / "public" / "index.html")


async def health(request):
    return web.json_response({"status": "ok", "rooms": len(ROOMS)})


async def websocket(request):
    ws = web.WebSocketResponse(heartbeat=20, max_msg_size=800000)
    await ws.prepare(request)
    ctx = {"room": None, "pid": None}
    try:
        async for msg in ws:
            if msg.type != WSMsgType.TEXT:
                continue
            try:
                obj = json.loads(msg.data)
                if not isinstance(obj, dict):
                    raise ValueError("不正な通信です")
                await handle_event(ws, ctx, obj)
            except (ValueError, KeyError, TypeError) as exc:
                await send_json(ws, {"type": "error", "message": str(exc)[:180]})
    finally:
        room = ctx["room"]
        pid = ctx["pid"]
        if room and pid and room["players"].get(pid, {}).get("ws") is ws:
            room["players"][pid]["ws"] = None
            await broadcast(room)
    return ws


async def housekeep(app):
    while True:
        await asyncio.sleep(300)
        now = time.time()
        for c, room in list(ROOMS.items()):
            if now - room["lastUsed"] > 7200 and not any(p["ws"] and not p["ws"].closed for p in room["players"].values()):
                ROOMS.pop(c, None)


async def task_ctx(app):
    task = asyncio.create_task(housekeep(app))
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


# Temporary links for image-rich solo challenges; Render free instances lose these on restart.
SHARED_CHALLENGES = {}
SHARE_LIMIT = 48  # cap memory use on the free service
SHARE_TTL_SECONDS = 36 * 3600

async def create_shared_challenge(request):
    if request.content_type != "application/json":
        raise web.HTTPUnsupportedMediaType()
    if request.content_length is not None and request.content_length > 750_000:
        raise web.HTTPRequestEntityTooLarge(max_size=750_000, actual_size=request.content_length)
    try:
        data = await request.json()
        if not isinstance(data, dict) or data.get("v") not in (1, 2) or data.get("game") not in ("tier", "quiz", "either", "value", "soup"):
            raise ValueError("無効な問題形式です")
        encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        if len(encoded.encode("utf-8")) > 650_000:
            raise ValueError("問題セットが大きすぎます（650KBまで）")
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise web.HTTPBadRequest(text=str(exc)[:140])
    now = time.time()
    for key, value in list(SHARED_CHALLENGES.items()):
        if now - value["at"] > SHARE_TTL_SECONDS:
            SHARED_CHALLENGES.pop(key, None)
    if len(SHARED_CHALLENGES) >= SHARE_LIMIT:
        oldest = min(SHARED_CHALLENGES, key=lambda k: SHARED_CHALLENGES[k]["at"])
        SHARED_CHALLENGES.pop(oldest, None)
    token = secrets.token_urlsafe(18)
    SHARED_CHALLENGES[token] = {"at": now, "data": data}
    return web.json_response({"id": token, "temporary": True, "expiresInHours": 36}, headers={"Cache-Control": "no-store"})

async def get_shared_challenge(request):
    token = request.match_info["token"]
    item = SHARED_CHALLENGES.get(token)
    if not item or time.time() - item["at"] > SHARE_TTL_SECONDS:
        SHARED_CHALLENGES.pop(token, None)
        raise web.HTTPNotFound(text="共有した問題は期限切れか、サーバーの再起動で消えました")
    return web.json_response({"data": item["data"]}, headers={"Cache-Control": "no-store"})

app = web.Application()
app.add_routes([web.post("/api/challenges", create_shared_challenge), web.get("/api/challenges/{token}", get_shared_challenge), web.get("/", index), web.get("/studio", lambda request: web.FileResponse(ROOT / "public" / "studio.html")), web.get("/profile.js", lambda request: web.FileResponse(ROOT / "public" / "profile.js")), web.get("/studio.js", lambda request: web.FileResponse(ROOT / "public" / "studio.js")), web.get("/studio.css", lambda request: web.FileResponse(ROOT / "public" / "studio.css")), web.get("/custom.css", lambda request: web.FileResponse(ROOT / "public" / "custom.css")), web.get("/custom_ui.js", lambda request: web.FileResponse(ROOT / "public" / "custom_ui.js")), web.get("/examples.json", lambda request: web.FileResponse(ROOT / "examples.json")), web.get("/main.js", lambda request: web.FileResponse(ROOT / "public" / "main.js")), web.get("/party_ui.js", lambda request: web.FileResponse(ROOT / "public" / "party_ui.js")), web.get("/party.css", lambda request: web.FileResponse(ROOT / "public" / "party.css")), web.get("/rules.js", lambda request: web.FileResponse(ROOT / "public" / "rules.js")), web.get("/rules.css", lambda request: web.FileResponse(ROOT / "public" / "rules.css")), web.get("/ws", websocket), web.get("/health", health)])
app.cleanup_ctx.append(task_ctx)

if __name__ == "__main__":
    web.run_app(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
