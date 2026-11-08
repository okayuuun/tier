"""Owner-only management for Nakamikurabe.

Access is protected by MASTER_PASSWORD, not the cosmetic 'okayu' entry command.
Logs intentionally omit session keys, IP addresses, private message bodies and images.
Storage is SQLite (ephemeral on Render free unless MASTER_DB_PATH is on a persistent disk).
"""
import asyncio
import datetime as dt
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from pathlib import Path
from aiohttp import web

MAX_LOGS = 5000
LOG_DAYS = 30
HISTORY_DAYS = 90
GAMES = ("tier", "value", "either", "quiz", "ito", "akaito", "propose", "soup", "unique", "wolf", "unanimous", "insider", "secret_rank", "describe", "drawfake", "mysterymail")
LABELS = {
    "tier": "みんなでティア表！", "value": "これって重い？判定シート", "either": "恋愛究極の２択",
    "quiz": "理解度チェック", "ito": "ito（クモノイト）", "akaito": "ito（アカイイト）",
    "propose": "たった今考えたプロポーズの言葉を君に捧ぐよ。", "soup": "ウミガメのスープ",
    "unique": "全員不一致", "wolf": "ワードウルフ",
    "unanimous": "全員一致ゲーム", "insider": "インサイダーゲーム", "secret_rank": "シークレットランキング",
    "describe": "カタカナーシ（Webアレンジ）", "drawfake": "エセ芸術家ニューヨークへ行く（Webアレンジ）", "mysterymail": "謎解きメール",
}
ACTION_LABELS = {
    "create":"ルーム作成", "join":"ルーム参加", "configure":"ゲーム設定", "start":"ゲーム開始",
    "example":"ランダム例題を取得", "topic":"お題提出", "answer":"秘密の正解を登録", "guess":"予想を提出",
    "next":"次のラウンド", "force":"スキップ・進行", "end":"ゲーム終了", "restart":"再プレイ",
    "leave":"ルーム退出", "studio_load":"自作問題読込", "studio_answer":"自作問題回答",
    "ito_clue":"例えを提出", "ito_play":"数字を公開", "prop_submit":"プロポーズ提出",
    "prop_pick":"プロポーズ審査", "soup_ask":"質問", "soup_solve":"真相を推理",
    "soup_reply":"質問に回答", "soup_resolve":"真相を公開",
    "unique_answer":"不一致の回答", "wolf_vote":"ワードウルフ投票",
    "un_answer":"全員一致の回答", "un_next":"全員一致の次の問題", "un_redraw":"一致お題変更", "un_force":"一致ゲーム途中集計",
    "in_question":"質問する", "in_answer":"親の回答", "in_guess":"正解の推理", "in_vote":"内通者投票", "in_skip":"内通者投票へ進行", "in_force":"内通者投票の途中集計", "in_next":"内通者の次のラウンド",
    "sr_order":"秘密の並び提出", "sr_guess":"秘密の基準を予想", "sr_force":"秘密ランキングの答え合わせ", "sr_next":"秘密ランキングの次の主役",
    "desc_clue":"説明を送信", "desc_guess":"説明への回答", "desc_skip":"説明の正解公開", "desc_next":"説明役を交代",
    "draw_stroke":"お絵描きの線を提出", "draw_vote":"エセ芸術家に投票", "draw_guess":"エセ役の逆転回答", "draw_next":"次のお絵描きラウンド",
    "mail_answer":"謎解きメールの解答", "mail_hint":"謎解きメールのヒント公開", "mail_next":"次の事件",
}


def utc_stamp(ts):
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).isoformat(timespec="seconds")


def clean_history(value, depth=0):
    """Remove embedded images, network/session references and cap payload size."""
    if depth > 7:
        return None
    if isinstance(value, dict):
        excluded = {"sid", "ws", "avatar", "image", "img", "imageUrl", "imageData", "token", "session"}
        return {str(k)[:60]: clean_history(v, depth + 1) for k, v in list(value.items())[:80]
                if k not in excluded and not str(k).lower().startswith("secret")}
    if isinstance(value, list):
        return [clean_history(v, depth + 1) for v in value[:40]]
    if isinstance(value, str):
        if value.startswith("data:image") or value.startswith("blob:"):
            return "[画像]"
        return value[:450]
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return str(value)[:150]


class MasterAdmin:
    def __init__(self):
        p = os.getenv("MASTER_DB_PATH", "/tmp/nakami_master.sqlite3")
        Path(p).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(p, timeout=5)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA busy_timeout=5000")
        self.db.execute("CREATE TABLE IF NOT EXISTS published (game TEXT PRIMARY KEY, enabled INTEGER NOT NULL)")
        self.db.execute("CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL NOT NULL, room TEXT, game TEXT, player TEXT, action TEXT NOT NULL, detail TEXT)")
        self.db.execute("CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, stamp TEXT UNIQUE NOT NULL, ts REAL NOT NULL, room TEXT, game TEXT, players TEXT, results TEXT, ended_early INTEGER)")
        self.db.execute("CREATE INDEX IF NOT EXISTS audit_when ON audit(ts DESC)")
        self.db.execute("CREATE INDEX IF NOT EXISTS history_when ON history(ts DESC)")
        self.db.executemany("INSERT OR IGNORE INTO published(game,enabled) VALUES (?,1)", [(g,) for g in GAMES])
        self.db.commit()
        self.sessions = {}
        self.failures = {}
        self._last_trim = 0
        self.rooms = None
        self.broadcast = None

    def public_games(self):
        return [r["game"] for r in self.db.execute("SELECT game FROM published WHERE enabled=1").fetchall() if r["game"] in GAMES]

    def published(self, game):
        return game in self.public_games()

    def all_games(self):
        d = {r["game"]: bool(r["enabled"]) for r in self.db.execute("SELECT game,enabled FROM published")}
        return [{"id": g, "label": LABELS[g], "enabled": d.get(g, True)} for g in GAMES]

    def _trim(self):
        now = time.time()
        if now - self._last_trim < 3600:
            return
        self.db.execute("DELETE FROM audit WHERE ts < ?", (now - LOG_DAYS * 86400,))
        self.db.execute("DELETE FROM audit WHERE id NOT IN (SELECT id FROM audit ORDER BY id DESC LIMIT ?)", (MAX_LOGS,))
        self.db.execute("DELETE FROM history WHERE ts < ?", (now - HISTORY_DAYS * 86400,))
        self.db.commit()
        self._last_trim = now

    def log_action(self, room, name, action, detail=""):
        if action not in ACTION_LABELS and action not in ("admin_visibility", "admin_delete", "admin_terminate", "admin_export", "shared_challenge"):
            # Still record the recognized WebSocket event name as metadata.
            action = str(action)[:55]
        self.db.execute("INSERT INTO audit(ts,room,game,player,action,detail) VALUES (?,?,?,?,?,?)",
                        (time.time(), str(room.get("code", ""))[:12], str(room.get("game", ""))[:36],
                         str(name)[:24], action[:60], str(detail)[:180]))
        self.db.commit()
        self._trim()

    def save_match(self, room):
        stamp = f"{room.get('code', '')}:{room.get('matchNo', 0)}"
        players = [{"name": p.get("name", "")[:24], "score": room.get("points", {}).get(pid, 0)}
                   for pid, p in room.get("players", {}).items()]
        details = {"type": "standard", "rounds": room.get("history", [])}
        if room.get("custom"):
            details = {"type": "studio", "title": room["custom"].get("title", ""),
                       "history": room.get("studioHistory", [])}
        elif room.get("party"):
            p = room["party"]
            details = {"type": "party", "rounds": p.get("history", p.get("rounds", [])),
                       "round": p.get("round"), "rings": p.get("rings"), "lives": p.get("lives")}
        details["status"] = room.get("phase", "")
        summary = json.dumps(clean_history(details), ensure_ascii=False)[:40000]
        self.db.execute("INSERT OR REPLACE INTO history(stamp,ts,room,game,players,results,ended_early) VALUES (?,?,?,?,?,?,?)",
                        (stamp, time.time(), room.get("code", ""), room.get("game", ""),
                         json.dumps(players, ensure_ascii=False), summary, int(bool(room.get("endedEarly")))))
        self.db.commit()
        self._trim()

    def _require_auth(self, req):
        key = req.cookies.get("nakami_master", "")
        hashed = __import__("hashlib").sha256(key.encode()).hexdigest()
        expires = self.sessions.get(hashed, 0)
        if not key or expires <= time.time():
            raise web.HTTPUnauthorized(text="管理者ログインが必要です")
        return hashed

    @staticmethod
    def _origin(req):
        if req.method not in ("POST", "DELETE", "PUT", "PATCH"):
            return
        if req.headers.get("X-Master-Request") != "1":
            raise web.HTTPForbidden(text="管理操作のヘッダーがありません")
        origin = req.headers.get("Origin", "")
        from urllib.parse import urlsplit
        u = urlsplit(origin)
        if not origin or u.netloc.lower() != req.host.lower() or u.scheme not in ("http", "https"):
            raise web.HTTPForbidden(text="別のサイトからは管理操作できません")

    def auth(self, req, write=False):
        self._require_auth(req)
        if write:
            self._origin(req)

    async def login(self, request):
        self._origin(request)
        password = os.getenv("MASTER_PASSWORD", "")
        if len(password) < 12 or password.lower() == "okayu":
            raise web.HTTPServiceUnavailable(text="Render の環境変数 MASTER_PASSWORD に12文字以上の強いパスワードを登録してください")
        ip = request.remote or "unknown"
        record = self.failures.get(ip, (0, 0))
        if record[1] > time.time() and record[0] >= 5:
            raise web.HTTPTooManyRequests(text="ログイン試行回数が多いため、しばらくお待ちください")
        data = await request.json()
        entered = str(data.get("password", ""))[:256]
        if not hmac.compare_digest(password.encode(), entered.encode()):
            count = record[0] + 1 if record[1] > time.time() else 1
            self.failures[ip] = (count, time.time() + 900)
            raise web.HTTPUnauthorized(text="パスワードが正しくありません")
        self.failures.pop(ip, None)
        token = secrets.token_urlsafe(40)
        digest = __import__("hashlib").sha256(token.encode()).hexdigest()
        self.sessions[digest] = time.time() + 12 * 3600
        resp = web.json_response({"ok": True})
        resp.set_cookie("nakami_master", token, httponly=True, secure=request.secure or request.headers.get("X-Forwarded-Proto") == "https",
                        samesite="Strict", max_age=43200, path="/")
        return resp

    async def logout(self, request):
        self.auth(request, True)
        key = request.cookies.get("nakami_master", "")
        self.sessions.pop(__import__("hashlib").sha256(key.encode()).hexdigest(), None)
        resp = web.json_response({"ok": True})
        resp.del_cookie("nakami_master", path="/")
        return resp

    async def availability(self, request):
        return web.json_response({"games": self.public_games()}, headers={"Cache-Control": "no-store"})

    async def state(self, request):
        self.auth(request)
        self._trim()
        rooms = []
        for room in (self.rooms or {}).values():
            rooms.append({"code": room["code"], "game": room["game"], "phase": room["phase"],
                          "players": [{"name": p.get("name", "")[:24], "online": bool(p.get("ws") and not p["ws"].closed)} for p in room["players"].values()],
                          "started": room.get("matchNo", 0), "lastActivity": utc_stamp(room.get("lastUsed", time.time()))})
        counts = {"events": self.db.execute("SELECT COUNT(*) FROM audit").fetchone()[0],
                  "history": self.db.execute("SELECT COUNT(*) FROM history").fetchone()[0]}
        return web.json_response({"games": self.all_games(), "rooms": rooms, "counts": counts,
                                  "note": "ログは30日／最大5000件、対戦履歴は90日。Render無料インスタンスでは再デプロイ時に消えることがあります。"},
                                 headers={"Cache-Control": "no-store"})

    async def logs(self, request):
        self.auth(request)
        q = request.query.get("q", "")[:60]
        game = request.query.get("game", "")[:30]
        page = min(100000, max(0, int(request.query.get("offset", "0") or 0)))
        sql = "SELECT id,ts,room,game,player,action,detail FROM audit WHERE 1=1"
        args = []
        if q:
            sql += " AND (player LIKE ? OR room LIKE ? OR action LIKE ? OR detail LIKE ?)"
            args.extend(["%"+q+"%"] * 4)
        if game in GAMES:
            sql += " AND game=?"; args.append(game)
        rows = [dict(x) for x in self.db.execute(sql+" ORDER BY ts DESC LIMIT 100 OFFSET ?", [*args,page]).fetchall()]
        for r in rows:
            r["time"] = utc_stamp(r.pop("ts"))
            r["label"] = ACTION_LABELS.get(r["action"], r["action"])
        return web.json_response({"rows": rows, "offset": page})

    async def histories(self, request):
        self.auth(request)
        rows = []
        for r in self.db.execute("SELECT id,ts,room,game,players,results,ended_early FROM history ORDER BY ts DESC LIMIT 100").fetchall():
            rows.append({"id": r["id"], "time": utc_stamp(r["ts"]), "room": r["room"], "game": r["game"],
                         "players": json.loads(r["players"]), "results": json.loads(r["results"]),
                         "endedEarly": bool(r["ended_early"])})
        return web.json_response({"rows": rows})

    async def set_public(self, request):
        self.auth(request, True)
        data = await request.json()
        game = data.get("game")
        if game not in GAMES or not isinstance(data.get("enabled"), bool):
            raise web.HTTPBadRequest(text="ゲームと公開状態を確認してください")
        self.db.execute("UPDATE published SET enabled=? WHERE game=?", (int(data["enabled"]), game))
        self.db.commit()
        self.log_action({"code": "ADMIN", "game": game}, "管理者", "admin_visibility", "公開" if data["enabled"] else "非公開")
        # Broadcast availability to existing lobby players immediately.
        if self.broadcast:
            for room in list((self.rooms or {}).values()):
                await self.broadcast(room)
        return web.json_response({"games": self.all_games()})

    async def delete_record(self, request):
        self.auth(request, True)
        kind = request.match_info.get("kind")
        if kind not in ("audit", "history"):
            raise web.HTTPBadRequest()
        try:
            rid = int(request.match_info["id"])
        except ValueError:
            raise web.HTTPBadRequest()
        self.db.execute(f"DELETE FROM {kind} WHERE id=?", (rid,))
        self.db.commit()
        return web.json_response({"ok": True})

    async def purge(self, request):
        self.auth(request, True)
        data = await request.json()
        kind = data.get("kind")
        if kind not in ("audit", "history", "all") or data.get("confirm") != "DELETE":
            raise web.HTTPBadRequest(text="対象と確認文字列を確認してください")
        if kind in ("audit", "all"):
            self.db.execute("DELETE FROM audit")
        if kind in ("history", "all"):
            self.db.execute("DELETE FROM history")
        self.db.commit()
        return web.json_response({"ok": True})

    async def terminate_room(self, request):
        self.auth(request, True)
        code = request.match_info.get("code", "")
        room = (self.rooms or {}).get(code)
        if not room:
            raise web.HTTPNotFound(text="ルームが見つかりません")
        room["endedEarly"] = True
        self.save_match(room)
        for p in list(room["players"].values()):
            ws = p.get("ws")
            if ws and not ws.closed:
                await ws.send_json({"type": "error", "message": "管理者がルームを終了しました"})
                await ws.close(code=1000, message=b"closed by moderator")
        self.rooms.pop(code, None)
        self.log_action({"code": code, "game": room["game"]}, "管理者", "admin_terminate", "ルームを終了")
        return web.json_response({"ok": True})

    async def export(self, request):
        self.auth(request)
        tables = {}
        for name in ("published", "audit", "history"):
            tables[name] = [dict(r) for r in self.db.execute(f"SELECT * FROM {name}").fetchall()]
        return web.json_response({"exportedAt": utc_stamp(time.time()), "records": tables},
                                 headers={"Content-Disposition": 'attachment; filename="nakami-master-backup.json"',
                                          "Cache-Control": "no-store"})

    def register(self, app, rooms, broadcast):
        self.rooms = rooms
        self.broadcast = broadcast
        app.add_routes([
            web.get("/api/games", self.availability),
            web.post("/api/master/login", self.login),
            web.post("/api/master/logout", self.logout),
            web.get("/api/master/state", self.state),
            web.get("/api/master/logs", self.logs),
            web.get("/api/master/history", self.histories),
            web.post("/api/master/visibility", self.set_public),
            web.delete("/api/master/{kind:audit|history}/{id}", self.delete_record),
            web.post("/api/master/purge", self.purge),
            web.post("/api/master/terminate/{code}", self.terminate_room),
            web.get("/api/master/export", self.export),
        ])