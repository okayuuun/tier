"""Share a self-authored Atelier quiz and collect a casual leaderboard.

Public visitors never receive the answer key before submitting. Scores and
timings are computed server-side, not trusted from the browser. Neon stores
published challenges and submissions when ROOM_DATABASE_URL is configured.
Without a database the UI explicitly calls the link temporary.
"""
import asyncio
import json
import re
import secrets
import time

from aiohttp import web

from custom_live import validate_game
from room_store import store as ROOM_STORE

DURABLE_TTL = 30 * 86400
TEMP_TTL = 36 * 3600
MAX_MEMORY_CHALLENGES = 48
MAX_DURABLE_CHALLENGES = 200  # Keep free database storage bounded.
MAX_ATTEMPTS_PER_CHALLENGE = 2000
MAX_PUBLIC_LEADERS = 100
MAX_BODY = 690_000
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{16,40}$")
NAME_RE = re.compile(r"^[^\x00-\x1f\x7f]{1,24}$")

# Only scored exercises are supported: open-ended mysteries have no objective
# answer that can be ranked by number correct.
SCORED_GAMES = {"tier", "quiz", "either", "value"}


def clean_challenge(raw):
    if not isinstance(raw, dict) or raw.get("game") not in SCORED_GAMES:
        raise ValueError("ランキング対応はTier表・理解度クイズ・2択・3択のみです")
    validated = validate_game(raw)  # Strict image/question/answer validation.
    kind = validated["game"]
    config_key = "rounds" if kind == "tier" else "qs"
    return {"v": 2, "game": kind, "title": validated["title"],
            "config": {config_key: validated["rounds"]},
            "truth": validated["truth"]}


def public_challenge(data):
    # No correct answers or author secrets in GET /challenge or /leaderboard.
    return {key: value for key, value in data.items() if key != "truth"}


def score_answers(data, answers):
    truth = data["truth"]
    if not isinstance(answers, list) or len(answers) != len(truth):
        raise ValueError("すべての問題に回答してください")
    if data["game"] == "tier":
        for row in answers:
            if (not isinstance(row, list) or len(row) != 5 or
                    any(type(v) is not int for v in row) or
                    set(row) != set(range(5))):
                raise ValueError("Tier表の並びが正しくありません")
        return (sum(a == b for chosen, correct in zip(answers, truth)
                    for a, b in zip(chosen, correct)), len(truth) * 5)
    option_count = {"quiz": 4, "either": 2, "value": 3}[data["game"]]
    if any(type(v) is not int or not 0 <= v < option_count for v in answers):
        raise ValueError("選択肢を確認してください")
    return sum(a == b for a, b in zip(answers, truth)), len(truth)


class RankedStore:
    def __init__(self):
        self._memory = {}
        self._lock = asyncio.Lock()

    @property
    def durable(self):
        return ROOM_STORE.enabled and ROOM_STORE.pool is not None

    async def start(self):
        if not self.durable:
            return
        async with ROOM_STORE.pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS nakami_ranked_challenges (
                    id TEXT PRIMARY KEY,
                    created DOUBLE PRECISION NOT NULL,
                    expires DOUBLE PRECISION NOT NULL,
                    payload TEXT NOT NULL
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS nakami_ranked_attempts (
                    token TEXT PRIMARY KEY,
                    challenge_id TEXT NOT NULL REFERENCES
                        nakami_ranked_challenges(id) ON DELETE CASCADE,
                    started DOUBLE PRECISION NOT NULL
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS nakami_ranked_scores (
                    token TEXT PRIMARY KEY REFERENCES
                        nakami_ranked_attempts(token) ON DELETE CASCADE,
                    challenge_id TEXT NOT NULL REFERENCES
                        nakami_ranked_challenges(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    score INTEGER NOT NULL,
                    max_score INTEGER NOT NULL,
                    duration_ms INTEGER NOT NULL,
                    submitted DOUBLE PRECISION NOT NULL
                )
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS nakami_ranked_scores_order
                ON nakami_ranked_scores
                    (challenge_id, score DESC, duration_ms ASC, submitted ASC)
            """)
        await self.prune()

    async def prune(self):
        if self.durable:
            async with ROOM_STORE.pool.acquire() as conn:
                await conn.execute("DELETE FROM nakami_ranked_challenges WHERE expires <= $1", time.time())
                # Delete abandoned attempts to prevent database growth.
                await conn.execute("""
                    DELETE FROM nakami_ranked_attempts a
                    WHERE started < $1 AND NOT EXISTS
                        (SELECT 1 FROM nakami_ranked_scores s WHERE s.token=a.token)
                """, time.time() - 86400)
        else:
            for k, record in list(self._memory.items()):
                if record["expires"] <= time.time():
                    self._memory.pop(k, None)

    async def create(self, data):
        token = secrets.token_urlsafe(18)
        now = time.time()
        ttl = DURABLE_TTL if self.durable else TEMP_TTL
        expires = now + ttl
        if self.durable:
            async with ROOM_STORE.pool.acquire() as conn:
                async with conn.transaction():
                    count = await conn.fetchval("""
                        SELECT COUNT(*) FROM nakami_ranked_challenges
                        WHERE expires>$1
                    """, now)
                    if count >= MAX_DURABLE_CHALLENGES:
                        raise web.HTTPTooManyRequests(
                            text="公開問題が現在の保存上限に達しています。しばらく後にお試しください")
                    await conn.execute("""
                        INSERT INTO nakami_ranked_challenges(id,created,expires,payload)
                        VALUES ($1,$2,$3,$4)
                    """, token, now, expires,
                    json.dumps(data, ensure_ascii=False, separators=(",", ":")))
        else:
            async with self._lock:
                self._memory[token] = {"data": data, "created": now,
                                       "expires": expires,
                                       "attempts": {}, "scores": {}}
                if len(self._memory) > MAX_MEMORY_CHALLENGES:
                    oldest = min(self._memory, key=lambda c: self._memory[c]["created"])
                    self._memory.pop(oldest, None)
        return {"id": token, "expiresAt": expires, "temporary": not self.durable,
                "expiresInHours": ttl // 3600}

    async def get(self, token):
        if not TOKEN_RE.fullmatch(token):
            raise web.HTTPNotFound(text="問題が見つかりません")
        if self.durable:
            async with ROOM_STORE.pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT payload,created,expires FROM nakami_ranked_challenges
                    WHERE id=$1 AND expires>$2
                """, token, time.time())
            if row is None:
                raise web.HTTPNotFound(text="問題が期限切れか削除済みです")
            return {"data": json.loads(row["payload"]), "created": row["created"],
                    "expires": row["expires"]}
        r = self._memory.get(token)
        if not r or r["expires"] <= time.time():
            raise web.HTTPNotFound(text="問題が期限切れか、サーバー再起動で消えました")
        return r

    async def start_attempt(self, token):
        record = await self.get(token)
        now = time.time()
        attempt = secrets.token_urlsafe(24)
        if self.durable:
            async with ROOM_STORE.pool.acquire() as conn:
                async with conn.transaction():
                    number = await conn.fetchval("""
                        SELECT COUNT(*) FROM nakami_ranked_attempts
                        WHERE challenge_id=$1
                    """, token)
                    if number >= MAX_ATTEMPTS_PER_CHALLENGE:
                        raise web.HTTPTooManyRequests(text="この問題の参加人数が上限に達しました")
                    await conn.execute("""
                        INSERT INTO nakami_ranked_attempts(token,challenge_id,started)
                        VALUES ($1,$2,$3)
                    """, attempt, token, now)
        else:
            async with self._lock:
                if len(record["attempts"]) >= MAX_ATTEMPTS_PER_CHALLENGE:
                    raise web.HTTPTooManyRequests(text="この問題の参加人数が上限に達しました")
                record["attempts"][attempt] = now
        return {"attempt": attempt}

    async def submit(self, token, attempt, name, answers):
        record = await self.get(token)
        if not isinstance(attempt, str) or not TOKEN_RE.fullmatch(attempt):
            raise web.HTTPBadRequest(text="回答用のリンク情報が不正です")
        if not isinstance(name, str) or not NAME_RE.fullmatch(name.strip()):
            raise web.HTTPBadRequest(text="ニックネームは1〜24文字で入力してください")
        name = name.strip()
        try:
            score, maximum = score_answers(record["data"], answers)
        except ValueError as exc:
            raise web.HTTPBadRequest(text=str(exc))
        now = time.time()
        if self.durable:
            async with ROOM_STORE.pool.acquire() as conn:
                async with conn.transaction():
                    started = await conn.fetchval("""
                        SELECT started FROM nakami_ranked_attempts
                        WHERE token=$1 AND challenge_id=$2
                    """, attempt, token)
                    if started is None:
                        raise web.HTTPBadRequest(text="回答を始め直してください")
                    # A timed attempt only lasts six hours. The client cannot
                    # forge its duration or submit again to improve its score.
                    duration = max(0, int((now - started) * 1000))
                    if duration > 6 * 3600 * 1000:
                        raise web.HTTPBadRequest(text="回答時間が終了しました。再挑戦してください")
                    inserted = await conn.fetchrow("""
                        INSERT INTO nakami_ranked_scores
                            (token,challenge_id,name,score,max_score,duration_ms,submitted)
                        VALUES ($1,$2,$3,$4,$5,$6,$7)
                        ON CONFLICT (token) DO NOTHING
                        RETURNING score,max_score,duration_ms,name
                    """, attempt, token, name, score, maximum, duration, now)
                    if not inserted:
                        inserted = await conn.fetchrow("""
                            SELECT score,max_score,duration_ms,name
                            FROM nakami_ranked_scores WHERE token=$1
                        """, attempt)
                    summary = dict(inserted)
        else:
            async with self._lock:
                started = record["attempts"].get(attempt)
                if started is None:
                    raise web.HTTPBadRequest(text="回答を始め直してください")
                duration = max(0, int((now - started) * 1000))
                if duration > 6 * 3600 * 1000:
                    raise web.HTTPBadRequest(text="回答時間が終了しました。再挑戦してください")
                summary = record["scores"].setdefault(attempt, {
                    "score": score, "max_score": maximum,
                    "duration_ms": duration, "name": name, "submitted": now})
        ranking = await self.leaders(token)
        rank = next((i+1 for i, x in enumerate(ranking["rows"])
                     if x["_token"] == attempt), None)
        return {"score": summary["score"], "maxScore": summary["max_score"],
                "durationMs": summary["duration_ms"],
                "name": summary["name"], "truth": record["data"]["truth"],
                "rank": rank, "leaders": [dict((k,v) for k,v in x.items() if k != "_token")
                                           for x in ranking["rows"]],
                "total": ranking["total"]}

    async def leaders(self, token):
        await self.get(token)
        if self.durable:
            async with ROOM_STORE.pool.acquire() as conn:
                results = await conn.fetch("""
                    SELECT token,name,score,max_score,duration_ms,submitted
                    FROM nakami_ranked_scores WHERE challenge_id=$1
                    ORDER BY score DESC, duration_ms ASC, submitted ASC, token ASC
                    LIMIT $2
                """, token, MAX_PUBLIC_LEADERS)
                total = await conn.fetchval(
                    "SELECT COUNT(*) FROM nakami_ranked_scores WHERE challenge_id=$1", token)
            scores = [dict(r) for r in results]
        else:
            r = self._memory[token]
            scores = [{"token": k, **v} for k, v in r["scores"].items()]
            scores.sort(key=lambda s: (-s["score"], s["duration_ms"], s["submitted"], s["token"]))
            total = len(scores)
            scores = scores[:MAX_PUBLIC_LEADERS]
        return {"rows": [{"_token": s["token"], "name": s["name"],
                          "score": s["score"], "maxScore": s["max_score"],
                          "durationMs": s["duration_ms"],
                          "submittedAt": s["submitted"]}
                         for s in scores], "total": total}


STORE = RankedStore()


async def create(request):
    if request.content_type != "application/json":
        raise web.HTTPUnsupportedMediaType()
    if request.content_length and request.content_length > MAX_BODY:
        raise web.HTTPRequestEntityTooLarge(max_size=MAX_BODY,
                                            actual_size=request.content_length)
    try:
        data = await request.json()
        # Whitelisting removes arbitrary top-level content and hidden metadata.
        cleaned = clean_challenge(data)
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise web.HTTPBadRequest(text=str(exc)[:180])
    if not request.app["master_admin"].published(cleaned["game"]):
        raise web.HTTPForbidden(text="このゲームは現在非公開です")
    result = await STORE.create(cleaned)
    return web.json_response(result, headers={"Cache-Control": "no-store"})


async def get(request):
    record = await STORE.get(request.match_info["id"])
    game = record["data"]["game"]
    if not request.app["master_admin"].published(game):
        raise web.HTTPForbidden(text="このゲームは現在非公開です")
    return web.json_response({"data": public_challenge(record["data"]),
                              "expiresAt": record["expires"],
                              "temporary": not STORE.durable},
                             headers={"Cache-Control": "no-store"})


async def start(request):
    record = await STORE.get(request.match_info["id"])
    if not request.app["master_admin"].published(record["data"]["game"]):
        raise web.HTTPForbidden(text="このゲームは現在非公開です")
    return web.json_response(await STORE.start_attempt(request.match_info["id"]),
                             headers={"Cache-Control": "no-store"})


async def submit(request):
    if request.content_type != "application/json":
        raise web.HTTPUnsupportedMediaType()
    if request.content_length and request.content_length > 10_000:
        raise web.HTTPRequestEntityTooLarge(max_size=10_000,
                                            actual_size=request.content_length)
    try:
        data = await request.json()
    except (ValueError, TypeError, json.JSONDecodeError):
        raise web.HTTPBadRequest(text="回答を読み込めません")
    if not isinstance(data, dict):
        raise web.HTTPBadRequest(text="回答の形式が違います")
    record = await STORE.get(request.match_info["id"])
    if not request.app["master_admin"].published(record["data"]["game"]):
        raise web.HTTPForbidden(text="このゲームは現在非公開です")
    result = await STORE.submit(request.match_info["id"], data.get("attempt"),
                                data.get("name"), data.get("answers"))
    return web.json_response(result, headers={"Cache-Control": "no-store"})


async def leaderboard(request):
    record = await STORE.get(request.match_info["id"])
    if not request.app["master_admin"].published(record["data"]["game"]):
        raise web.HTTPForbidden(text="このゲームは現在非公開です")
    result = await STORE.leaders(request.match_info["id"])
    return web.json_response({"rows": [dict((k,v) for k,v in row.items()
                                            if k != "_token")
                                       for row in result["rows"]],
                              "total": result["total"]},
                             headers={"Cache-Control": "no-store"})


async def lifecycle(app):
    await STORE.start()
    yield


def register(app):
    app.add_routes([
        web.post("/api/ranked", create),
        web.get("/api/ranked/{id}", get),
        web.post("/api/ranked/{id}/start", start),
        web.post("/api/ranked/{id}/submit", submit),
        web.get("/api/ranked/{id}/leaderboard", leaderboard),
    ])
    app.cleanup_ctx.append(lifecycle)
