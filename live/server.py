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

ROOT = Path(__file__).parent
CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
ROOMS = {}
MAX_PLAYERS = 12
# Steamの遊び方に近づけ、Tier表ではプレイヤーごとに別のお題を割り当てる。
TIER_POOL = [
    {"title": "もらって嬉しいプレゼント", "items": ["手紙", "お菓子", "ゲーム", "服", "一緒に遊ぶ約束"]},
    {"title": "理想の休日", "items": ["寝る", "ゲームする", "旅行する", "映画を観る", "買い物をする"]},
    {"title": "テンションが上がる場所", "items": ["遊園地", "水族館", "カラオケ", "テーマカフェ", "温泉"]},
    {"title": "いちばん好きな食べ物", "items": ["寿司", "ラーメン", "カレー", "焼肉", "パスタ"]},
    {"title": "友達と一緒にするなら", "items": ["ゲーム", "映画", "スポーツ", "旅行", "料理"]},
    {"title": "好きな季節", "items": ["春", "初夏", "真夏", "秋", "冬"]},
    {"title": "大切にしたいもの", "items": ["自由", "安定", "仲間", "挑戦", "楽しさ"]},
    {"title": "朝起きて最初にしたいこと", "items": ["二度寝", "朝ご飯", "SNS", "音楽", "散歩"]},
    {"title": "一緒に出かけたいところ", "items": ["映画館", "動物園", "ショッピング", "海", "遊園地"]},
    {"title": "いちばん嬉しい言葉", "items": ["ありがとう", "好き", "すごいね", "頼りになる", "一緒にいよう"]},
    {"title": "最も疲れがとれること", "items": ["睡眠", "ゲーム", "入浴", "会話", "散歩"]},
]

CONFIGS = {
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
            "score": room["points"].get(pid, 0)}


def active_target(room):
    if room["phase"] not in ("guess", "reveal") or room["roundIndex"] >= len(room["active"]):
        return None
    return room["active"][room["roundIndex"]]


def room_snapshot(room, pid):
    target = active_target(room)
    phase = room["phase"]
    reveal = None
    visible_config = room["config"]
    if room["game"] == "tier" and phase == "answer":
        visible_config = room["playerConfigs"].get(pid, visible_config)
    elif room["game"] == "tier" and target:
        visible_config = room["playerConfigs"].get(target, visible_config)
    if phase == "reveal" and target:
        reveal = {
            "truth": room["answers"][target],
            "targetId": target,
            "rows": [
                {"id": opid, "name": room["players"][opid]["name"], "guess": g,
                 "score": sum(a == b for a, b in zip(g, room["answers"][target]))}
                for opid, g in room["guesses"].items()
            ],
        }
    return {
        "type": "state", "me": pid,
        "room": {"code": room["code"], "owner": room["owner"], "game": room["game"],
                 "config": visible_config, "phase": phase,
                 "players": [public_player(p, room) for p in room["players"].values()],
                 "roundIndex": room["roundIndex"], "totalTargets": len(room["active"]),
                 "targetId": target, "active": room["active"],
                 "answeredCount": len(room["answers"]), "guessCount": len(room["guesses"]),
                 "myAnswer": room["answers"].get(pid), "myGuess": room["guesses"].get(pid),
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


def validate_answers(room, arr):
    config = room["config"]
    if not isinstance(arr, list):
        return False
    if room["game"] == "tier":
        return len(arr) == 5 and set(type(x) for x in arr) == {int} and set(arr) == set(range(5))
    qs = config["qs"]
    return len(arr) == len(qs) and all(type(x) is int and 0 <= x < len(qs[i]["options"]) for i, x in enumerate(arr))


def valid_config(game, config):
    if game != "tier":
        return CONFIGS[game]
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
                    "guesses": {}, "roundIndex": 0, "points": {}, "lastUsed": time.time()}
            ROOMS[c] = room
        else:
            c = str(obj.get("code", "")).upper().strip()
            room = ROOMS.get(c)
            if not room:
                raise ValueError("そのルームは見つかりません。サーバー再起動で消えた可能性もあります")
        returning = next((p for p in room["players"].values() if p["sid"] == sid), None)
        if returning:
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
            room["players"][pid] = {"id": pid, "sid": sid, "name": name, "ws": ws}
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
    if t == "configure":
        if not is_owner or phase != "lobby":
            raise ValueError("ルーム作成者が待機中に設定できます")
        game = obj.get("game")
        if game not in CONFIGS:
            raise ValueError("ゲームが不正です")
        room["game"] = game
        room["config"] = valid_config(game, obj.get("config") or {})
    elif t == "start":
        if not is_owner or phase != "lobby":
            raise ValueError("ルーム作成者だけが開始できます")
        if len([p for p in room["players"].values() if p["ws"] and not p["ws"].closed]) < 2:
            raise ValueError("2人以上オンラインで参加してください")
        room["active"] = [p["id"] for p in room["players"].values() if p["ws"] and not p["ws"].closed]
        room["answers"] = {}
        room["guesses"] = {}
        room["playerConfigs"] = {}
        if room["game"] == "tier":
            # Host gets the custom topic, everyone else gets a distinct preset.
            pool = [t for t in TIER_POOL if t["title"] != room["config"]["title"]]
            secrets.SystemRandom().shuffle(pool)
            for i, player_id in enumerate(room["active"]):
                if player_id == room["owner"]:
                    room["playerConfigs"][player_id] = room["config"]
                else:
                    room["playerConfigs"][player_id] = pool[i % len(pool)]
        room["roundIndex"] = 0
        room["points"] = {p: 0 for p in room["players"]}
        room["phase"] = "answer"
    elif t == "answer":
        if phase != "answer" or pid not in room["active"]:
            raise ValueError("今は正解を登録できません")
        answers = obj.get("answers")
        if not validate_answers(room, answers):
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
        if not validate_answers(room, guess):
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
        if phase == "answer":
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
    elif t == "restart":
        if not is_owner or phase != "final":
            raise ValueError("ルーム作成者だけがもう一度始められます")
        room["phase"] = "lobby"
        room["active"] = []
        room["playerConfigs"] = {}
        room["answers"] = {}
        room["guesses"] = {}
        room["playerConfigs"] = {}
        if room["game"] == "tier":
            # Host gets the custom topic, everyone else gets a distinct preset.
            pool = [t for t in TIER_POOL if t["title"] != room["config"]["title"]]
            secrets.SystemRandom().shuffle(pool)
            for i, player_id in enumerate(room["active"]):
                if player_id == room["owner"]:
                    room["playerConfigs"][player_id] = room["config"]
                else:
                    room["playerConfigs"][player_id] = pool[i % len(pool)]
        room["roundIndex"] = 0
        room["points"] = {p: 0 for p in room["players"]}
        # On a fresh match, remove disconnected members from the lobby.
        for oldid in [x for x, p in room["players"].items() if not p["ws"] or p["ws"].closed]:
            del room["players"][oldid]
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
    room["phase"] = "reveal"


async def index(request):
    return web.FileResponse(ROOT / "public" / "index.html")


async def health(request):
    return web.json_response({"status": "ok", "rooms": len(ROOMS)})


async def websocket(request):
    ws = web.WebSocketResponse(heartbeat=20, max_msg_size=16000)
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


app = web.Application()
app.add_routes([web.get("/", index), web.get("/ws", websocket), web.get("/health", health)])
app.cleanup_ctx.append(task_ctx)

if __name__ == "__main__":
    web.run_app(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))