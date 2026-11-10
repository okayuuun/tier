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
from room_store import store as ROOM_STORE

MAX_LOGS = 5000
LOG_DAYS = 30
HISTORY_DAYS = 90
GAMES = ("tier", "value", "either", "quiz", "ito", "akaito", "propose", "soup", "unique", "wolf", "unanimous", "insider", "secret_rank", "describe", "drawfake", "mysterymail", "senryu", "tanka", "booktitle", "artguide", "drawrelay", "artcontest", "artforbid", "drawbluff", "artmix", "artcollab", "reverseart", "invent", "chardesign", "episode", "millishira", "oneword", "spectrum", "quiet", "bluff", "wordagents", "royalletter", "cipherrelay", "skyfire", "scoutline", "aiuebattle")
LABELS = {
    "royalletter": "密書の駆け引き", "cipherrelay": "ひみつの暗号便",
    "skyfire": "みんなの花火", "scoutline": "スカウト・ライン",
    "aiuebattle": "ひらがな文字バトル",
    "oneword": "ひとこと一致", "spectrum": "感覚メーター", "quiet": "無言の数字",
    "bluff": "花かドクロか", "wordagents": "暗号ワード対決",
    "tier": "みんなでティア表！", "value": "これって重い？判定シート", "either": "恋愛究極の２択",
    "quiz": "理解度チェック", "ito": "ito（クモノイト）", "akaito": "ito（アカイイト）",
    "propose": "たった今考えたプロポーズの言葉を君に捧ぐよ。", "soup": "ウミガメのスープ",
    "unique": "全員不一致", "wolf": "ワードウルフ",
    "senryu": "昼ドラ川柳", "tanka": "５７５７７（ゴーシチゴーシチシチ）", "booktitle": "横暴編集長",
    "artguide": "こっそり絵の指示書", "drawrelay": "お絵描き伝言リレー",
    "artcontest": "お絵描き作品コンテスト", "artforbid": "NGお絵描き", "drawbluff": "絵のタイトル当て",
    "millishira": "キャラクター・ミリしら",
    "episode": "誰のエピソード？",
    "invent": "発明プレゼン大会", "chardesign": "キャラクターデザイン依頼",
    "artmix": "イラスト×セリフ大合体", "artcollab": "合作お絵描き", "reverseart": "逆お絵描きクイズ",
    "unanimous": "全員一致ゲーム", "insider": "インサイダーゲーム", "secret_rank": "シークレットランキング",
    "describe": "カタカナーシ（Webアレンジ）", "drawfake": "エセ芸術家ニューヨークへ行く（Webアレンジ）", "mysterymail": "謎解きメール",
}
ACTION_LABELS = {
    "milli_publish":"ミリしら共有セット公開", "milli_submit":"ミリしら回答",
    "ep_topic":"エピソードのお題設定", "ep_submit":"匿名エピソードの提出", "ep_guess":"投稿者の予想", "ep_force":"エピソードを先に進める", "ep_next":"次のお題",
    "rl_play":"密書のカード使用", "rl_next":"密書の次ラウンド",
    "dc_clue":"暗号ヒント提出", "dc_guess":"暗号予想", "dc_next":"暗号の次ラウンド",
    "dc_skip":"暗号の途中集計", "hf_hint":"花火のヒント", "hf_play":"花火カード使用",
    "hf_discard":"花火カード破棄", "sc_play":"スカウトカード使用",
    "sc_scout":"カードスカウト", "sc_skip":"スカウトのパス", "sc_next":"次の勝負",
    "ai_theme":"文字バトルお題設定", "ai_write":"秘密の言葉登録",
    "ai_attack":"ひらがな攻撃", "ai_next":"次の文字バトル",
    "bg_hint":"ひとことヒント提出", "bg_answer":"お題回答", "bg_skip":"ひとこと途中進行",
    "bg_next":"ひとこと次へ", "sp_clue":"感覚ヒント提出", "sp_guess":"感覚位置予想",
    "sp_force":"感覚途中集計", "sp_next":"感覚次へ", "qt_play":"無言のカードを出す",
    "qt_next":"無言の次ステージ", "bl_place":"花かドクロを置く", "bl_bid":"枚数入札",
    "bl_pass":"パス", "bl_flip":"カード公開", "bl_next":"次の勝負",
    "wa_clue":"チームのヒント", "wa_pick":"言葉を公開", "wa_pass":"チーム手番終了",
    "create":"ルーム作成", "join":"ルーム参加", "configure":"ゲーム設定", "start":"ゲーム開始",
    "example":"ランダム例題を取得", "topic":"お題提出", "answer":"秘密の正解を登録", "guess":"予想を提出",
    "next":"次のラウンド", "force":"スキップ・進行", "end":"ゲーム終了", "restart":"再プレイ",
    "leave":"ルーム退出", "studio_load":"自作問題読込", "studio_answer":"自作問題回答",
    "ito_clue":"例えを提出", "ito_play":"数字を公開", "prop_submit":"プロポーズ提出",
    "prop_pick":"プロポーズ審査", "soup_ask":"質問", "soup_solve":"真相を推理",
    "soup_reply":"質問に回答", "soup_resolve":"真相を公開",
    "unique_answer":"不一致の回答", "wolf_vote":"ワードウルフ投票",
    "art_target":"絵の秘密のお題を設定", "art_hints":"絵のヒントを公開", "art_submit":"イラスト提出",
    "art_pick":"イラストを採用", "art_force":"お絵描きの途中集計", "art_next":"次の出題者",
    "relay_seed":"伝言のお題を作成", "relay_draw":"伝言の絵を提出", "relay_caption":"伝言を文章化", "relay_next":"伝言結果を表示",
    "word_format":"句の型を設定", "word_submit":"句・タイトルを提出", "word_show":"句を発表",
    "word_pick":"親が作品を採用", "word_vote":"編集会議で投票", "word_force":"途中集計", "word_next":"次のラウンド",
    "un_answer":"全員一致の回答", "un_next":"全員一致の次の問題", "un_redraw":"一致お題変更", "un_force":"一致ゲーム途中集計",
    "in_question":"質問する", "in_answer":"親の回答", "in_guess":"正解の推理", "in_vote":"内通者投票", "in_skip":"内通者投票へ進行", "in_force":"内通者投票の途中集計", "in_next":"内通者の次のラウンド",
    "sr_order":"秘密の並び提出", "sr_guess":"秘密の基準を予想", "sr_force":"秘密ランキングの答え合わせ", "sr_next":"秘密ランキングの次の主役",
    "desc_clue":"説明を送信", "desc_guess":"説明への回答", "desc_skip":"説明の正解公開", "desc_next":"説明役を交代",
    "draw_stroke":"お絵描きの線を提出", "draw_vote":"エセ芸術家に投票", "draw_guess":"エセ役の逆転回答", "draw_next":"次のお絵描きラウンド",
    "mail_answer":"謎解きメールの解答", "mail_hint":"謎解きメールのヒント公開", "mail_next":"次の事件",
    "mx_draw":"絵を提出", "mx_caption":"セリフを提出", "mx_vote":"作品に投票", "mx_force":"組み合わせの途中集計", "mx_next":"次のラウンド",
    "co_topic":"合作のお題を設定", "co_submit":"線を描き足す", "co_skip":"手番をスキップ", "co_next":"合作の次のラウンド",
    "inv_brief":"発明品のお題編集", "inv_publish":"発明品の出題開始", "inv_submit":"発明品を提出", "inv_vote":"発明品投票", "inv_force":"発明品の途中集計", "inv_next":"次の発明品ラウンド",
    "char_brief":"デザイン条件編集", "char_publish":"デザインの募集開始", "char_submit":"キャラデザイン提出", "char_pick":"キャラデザイン採用", "char_force":"デザインの途中審査", "char_next":"次の依頼人",
    "rv_hint":"絵描きへヒント", "rv_draw":"逆お絵描きを提出", "rv_guess":"絵の正体を推理", "rv_judge":"推理の正誤判定", "rv_force":"途中判定", "rv_next":"次の絵描き"
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
        elif room.get("drawextra"):
            p=room["drawextra"]
            details={"type":"drawing_extra","round":p.get("round"),"rounds":[{"round":r.get("round"),"topic":r.get("topic"),"winners":r.get("winners"),"prompt":r.get("prompt"),"votes":[x.get("votes") for x in r.get("entries",[])]} for r in p.get("history",[])]}
        elif room.get("draw"):
            p=room["draw"]
            if room.get("game")=="artguide":
                rows=[{"round":r.get("round"),"topic":r.get("topic"),"target":r.get("target"),
                       "winnerName":r.get("winnerName"),"participants":[x.get("name") for x in r.get("pictures",[])]}
                      for r in p.get("history",[])]
            else:
                rows=[{"owner":owner,"steps":len(steps)} for owner,steps in p.get("chains",{}).items()]
            details={"type":"drawing","rounds":rows,"round":p.get("round",p.get("stage"))}
        elif room.get("word"):
            w=room["word"]
            details={"type":"word","format":w.get("format"),"round":w.get("round"),"rounds":w.get("history",[])}
        elif room.get("design"):
            p = room["design"]
            details = {"type":"design","mode":room.get("game"),"round":p.get("round"),"rounds":[{"round":x.get("round"),"brief":x.get("brief"),"winnerNames":[e.get("name") for e in x.get("entries",[]) if e.get("id") in (x.get("winners") or [x.get("winner")])],"entries":[{"name":e.get("name"),"product":e.get("product"),"character":e.get("character"),"votes":e.get("votes")} for e in x.get("entries",[])]} for x in p.get("history",[])]}
        elif room.get("drawmix"):
            p = room["drawmix"]
            details = {"type": "drawing", "rounds": p.get("history", []), "round": p.get("round"), "mode": room.get("game")}
        elif room.get("more"):
            p = room["more"]
            details = {"type": "party", "rounds": p.get("history", []),
                       "round": p.get("round"), "mode": room.get("game"), "currentStep": p.get("step")}
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
        async def disconnect(p):
            ws=p.get("ws")
            if not ws or ws.closed:
                return
            try:
                await asyncio.wait_for(ws.send_json({
                    "type":"error","message":"管理者がルームを終了しました"}),2)
                await asyncio.wait_for(
                    ws.close(code=1000,message=b"closed by moderator"),3)
            except (asyncio.TimeoutError, ConnectionError, RuntimeError, OSError):
                pass
        await asyncio.gather(*(disconnect(p) for p in list(room["players"].values())))
        self.rooms.pop(code, None)
        ROOM_STORE.delete("game",code)
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