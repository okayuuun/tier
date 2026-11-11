"""Optional PostgreSQL-backed durable snapshots for game and art-chat rooms.

Set ROOM_DATABASE_URL to enable. Without it, the existing in-memory service
works unchanged. Never write credentials or room secrets to logs/public JSON.
Restoring sockets is impossible: websocket clients reconnect and reuse their
own session/resume credentials against reconstructed room state.
"""
import asyncio
import json
import logging
import os
import time
import zlib
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


def normalize_postgres_dsn(dsn):
    """Accept Neon's standard Connect URL with asyncpg.

    Neon may append channel_binding=require. asyncpg doesn't recognize this
    libpq option and forwards unknown query parameters as PostgreSQL server
    settings, resulting in a startup failure. It supports sslmode, so retain
    SSL/TLS while omitting only the unsupported channel_binding option.
    Never display or log the returned URL: it contains a DB password.
    """
    parsed = urlsplit(dsn)
    if parsed.scheme not in ("postgres", "postgresql"):
        return dsn
    options = parse_qsl(parsed.query, keep_blank_values=True)
    if not any(key == "channel_binding" for key, _ in options):
        return dsn
    retained = [(key, value) for key, value in options
                if key != "channel_binding"]
    return urlunsplit(parsed._replace(query=urlencode(retained)))


LOG = logging.getLogger("nakami.rooms")


def retention_hours(name, default, maximum):
    """Allow bounded retention without accidentally filling a free database."""
    raw = os.environ.get(name, str(default))
    try:
        hours = int(raw)
    except (ValueError, TypeError):
        LOG.warning("Invalid retention for %s; using default", name)
        return default
    if not 1 <= hours <= maximum:
        LOG.warning("%s must be between 1 and %d hours; using default", name, maximum)
        return default
    return hours


# Defaults: game rooms 3 days; art-chat 7 days. Configurable via Render.
GAME_RETENTION_HOURS = retention_hours("GAME_ROOM_RETENTION_HOURS", 72, 336)
ART_RETENTION_HOURS = retention_hours("ECHA_ROOM_RETENTION_HOURS", 168, 720)
GAME_TTL = GAME_RETENTION_HOURS * 3600
ART_TTL = ART_RETENTION_HOURS * 3600
# Keep the existing strict cap for ordinary game rooms.
MAX_UNCOMPRESSED_BYTES = 12_000_000
MAX_COMPRESSED_BYTES = 5_000_000
# Art rooms can contain thousands of strokes. These are byte-safety bounds,
# not a cap on the number of pen, eraser or bucket operations.
ART_MAX_UNCOMPRESSED_BYTES = 64_000_000
ART_MAX_COMPRESSED_BYTES = 24_000_000
SCHEMA_VERSION = 1
_PRIVATE_RUNTIME_KEYS = frozenset(("ws", "lock", "notifyLock", "_persistTask", "_restoredAt"))


def _clean(value):
    if isinstance(value, dict):
        return {str(key): _clean(item) for key, item in value.items()
                if key not in _PRIVATE_RUNTIME_KEYS}
    if isinstance(value, (list, tuple)):
        return [_clean(item) for item in value]
    if isinstance(value, set):
        return [_clean(item) for item in sorted(value, key=str)]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    raise TypeError(f"Unserializable room state type: {type(value).__name__}")


def serialize_room(kind, room):
    if kind not in ("game", "art"):
        raise ValueError("Unknown room type")
    if kind == "art":
        # Exclude nonserializable live sockets before descending into members.
        data = _clean({k: v for k, v in room.items() if k != "members"})
    else:
        data = _clean(room)
    raw = json.dumps({"v": SCHEMA_VERSION, "kind": kind, "room": data},
                     ensure_ascii=False, allow_nan=False,
                     separators=(",", ":")).encode("utf-8")
    raw_cap = ART_MAX_UNCOMPRESSED_BYTES if kind == "art" else MAX_UNCOMPRESSED_BYTES
    compressed_cap = ART_MAX_COMPRESSED_BYTES if kind == "art" else MAX_COMPRESSED_BYTES
    if len(raw) > raw_cap:
        raise ValueError("Room snapshot too large to persist")
    compressed = zlib.compress(raw, level=3)
    if len(compressed) > compressed_cap:
        raise ValueError("Compressed room snapshot is too large")
    return compressed


def deserialize_room(kind, blob):
    compressed_cap = ART_MAX_COMPRESSED_BYTES if kind == "art" else MAX_COMPRESSED_BYTES
    raw_cap = ART_MAX_UNCOMPRESSED_BYTES if kind == "art" else MAX_UNCOMPRESSED_BYTES
    if len(blob) > compressed_cap:
        raise ValueError("Room snapshot exceeds storage limit")
    decoder = zlib.decompressobj()
    raw = decoder.decompress(blob, raw_cap + 1)
    if len(raw) > raw_cap or not decoder.eof or decoder.unused_data:
        raise ValueError("Oversized or incomplete saved room")
    obj = json.loads(raw.decode("utf-8"))
    if obj.get("v") != SCHEMA_VERSION or obj.get("kind") != kind:
        raise ValueError("Unsupported snapshot schema")
    room = obj["room"]
    if not isinstance(room, dict):
        raise ValueError("Invalid saved room")
    code = room.get("code")
    if not isinstance(code, str) or not (4 <= len(code) <= 10):
        raise ValueError("Invalid room code in snapshot")
    if kind == "game":
        players = room.get("players")
        if not isinstance(players, dict) or len(players) > 12:
            raise ValueError("Invalid game players")
        for p in players.values():
            if not isinstance(p, dict):
                raise ValueError("Invalid player data")
            p["ws"] = None
        room["lock"] = asyncio.Lock()
        room.setdefault("createdAt", time.time())
        room.setdefault("lastUsed", time.time())
    else:
        for key in ("strokes", "layers", "identities", "messages", "drawing"):
            if key not in room:
                raise ValueError("Incomplete art room")
        if len(room["identities"]) > 60:
            raise ValueError("Invalid restored art participants")
        # Preserve any still-in-progress brush work at restart, then treat it
        # as completed so a reconnect cannot start with an orphaned stroke.
        for stroke in room["drawing"].values():
            room["strokes"].append(stroke)
            room["version"] += 1
        room["drawing"] = {}
        room["members"] = {}
        room["notifyLock"] = asyncio.Lock()
        room.setdefault("last", time.time())
    return room


class RoomStore:
    def __init__(self, dsn=None, *, delay=0.35):
        self.dsn = normalize_postgres_dsn(
            dsn if dsn is not None else os.environ.get("ROOM_DATABASE_URL", ""))
        self.enabled = bool(self.dsn)
        self.delay = delay
        self.pool = None
        self._queue = {}
        self._tasks = {}
        self._versions = {}
        # Versions are only acknowledged AFTER PostgreSQL executes a write.
        # A queued, serializing, or failed write is never reported as saved.
        self._saved_versions = {}
        self._invalid_versions = {}
        self._saved_times = {}
        # Art can receive hundreds of completed brush marks per minute. Keep
        # full-room compression off the hot path by spacing art snapshots.
        # This only affects automatic saves, not the WebSocket paint events.
        self._last_art_write = {}
        self._closing = False
        self._last_warning = 0.0
        self._last_error = 0.0
        self._last_success = 0.0

    async def start(self):
        if not self.enabled:
            return
        # Never log the URL: it contains the DB username and password.
        import asyncpg
        self.pool = await asyncpg.create_pool(dsn=self.dsn,
                                                min_size=1, max_size=3,
                                                timeout=10, command_timeout=10,
                                                statement_cache_size=0)
        async with self.pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS nakami_live_room_snapshots (
                    kind TEXT NOT NULL,
                    code TEXT NOT NULL,
                    version BIGINT NOT NULL,
                    data BYTEA NOT NULL,
                    updated_at DOUBLE PRECISION NOT NULL,
                    PRIMARY KEY(kind, code)
                )
            """)
        LOG.info("PostgreSQL-backed room recovery enabled")

    async def prune(self):
        """Remove snapshots past their replay window (and reclaim DB space)."""
        if not self.enabled or not self.pool:
            return
        async with self.pool.acquire() as conn:
            now=time.time()
            await conn.execute("""
                DELETE FROM nakami_live_room_snapshots
                WHERE (kind='game' AND updated_at < $1)
                   OR (kind='art' AND updated_at < $2)
                   OR kind NOT IN ('game','art')
            """, now-GAME_TTL, now-ART_TTL)

    async def load(self):
        if not self.enabled:
            return {}, {}
        await self.prune()
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT kind, code, version, data, updated_at
                   FROM nakami_live_room_snapshots
                   WHERE updated_at > $1
                   ORDER BY updated_at DESC LIMIT 160""",
                time.time() - ART_TTL)
        games, art = {}, {}
        for item in rows:
            kind, code = item["kind"], item["code"]
            if kind not in ("game", "art"):
                continue
            ttl = GAME_TTL if kind == "game" else ART_TTL
            if item["updated_at"] < time.time() - ttl:
                continue
            try:
                room = deserialize_room(kind, bytes(item["data"]))
                if room["code"] != code:
                    continue
                (games if kind == "game" else art)[code] = room
                self._versions[(kind, code)] = item["version"]
                self._saved_versions[(kind, code)] = item["version"]
                self._saved_times[(kind, code)] = item["updated_at"]
            except (TypeError, ValueError, KeyError, OverflowError):
                LOG.exception("Skipping invalid %s room snapshot", kind)
        restored_at = time.time()
        for room in list(games.values()) + list(art.values()):
            # Session-independent indicator; do not persist it, so it always
            # describes a recovery by the current server process.
            room["_restoredAt"] = restored_at
        LOG.info("Recovered %d game rooms and %d art rooms", len(games), len(art))
        return games, art

    async def save_and_confirm(self, kind, room, *, timeout=9.0):
        """Save one room and return its committed timestamp, or None.

        Used for a user-requested explicit backup. The background write loop
        still coalesces edits so many people clicking Save do not produce
        redundant snapshots. A transient DB failure will return None rather
        than giving a misleading success message. Does NOT disclose the DSN.
        """
        if not self.enabled or self._closing or self.pool is None:
            return None
        if kind not in ("game", "art") or not isinstance(room, dict):
            return None
        code = room.get("code")
        if not isinstance(code, str):
            return None
        key = (kind, code)
        version = self._enqueue(kind, code, room)
        loop = asyncio.get_running_loop()
        deadline = loop.time() + max(0.0, float(timeout))
        while True:
            if self._saved_versions.get(key, -1) >= version:
                return self._saved_times[key]
            if self._invalid_versions.get(key, -1) >= version:
                return None
            if loop.time() >= deadline:
                return None
            await asyncio.sleep(min(0.06, max(0.0, deadline-loop.time())))

    def mark(self, kind, room):
        """Coalesce edits to avoid a database query for every brush point."""
        if not self.enabled or self._closing:
            return
        code = room.get("code")
        if not isinstance(code, str):
            return
        self._enqueue(kind, code, room)

    def delete(self, kind, code):
        if not self.enabled or self._closing:
            return
        self._enqueue(kind, code, None)

    def _enqueue(self, kind, code, room):
        key = (kind, code)
        version = self._versions.get(key, 0) + 1
        self._versions[key] = version
        self._queue[key] = (version, room)
        if key not in self._tasks or self._tasks[key].done():
            self._tasks[key] = asyncio.create_task(self._write_loop(key))
        return version

    async def _write_loop(self, key):
        attempts = 0
        try:
            await asyncio.sleep(self.delay)
            while key in self._queue:
                if key[0] == "art":
                    # Absorb bursts of edits into one snapshot instead of
                    # repeatedly serializing every stroke on the event loop.
                    # Capture the newest queued version AFTER the short pause.
                    since = time.monotonic() - self._last_art_write.get(key, 0)
                    if since < 1.5:
                        await asyncio.sleep(1.5 - since)
                version, room = self._queue.pop(key)
                try:
                    await self._write_one(key, version, room)
                    if key[0] == "art":
                        self._last_art_write[key] = time.monotonic()
                    saved_at = time.time()
                    self._saved_versions[key] = max(
                        version, self._saved_versions.get(key, -1))
                    self._saved_times[key] = saved_at
                    if key[0] == "art" and room is None:
                        self._last_art_write.pop(key, None)
                    self._last_success = saved_at
                    attempts = 0
                except (TypeError, ValueError):
                    # Local data that cannot be serialized will not become
                    # valid merely because a database reconnects.
                    self._invalid_versions[key] = max(
                        version, self._invalid_versions.get(key, -1))
                    self._last_error = time.time()
                    LOG.exception("Unsavable room snapshot skipped")
                except Exception:
                    self._last_error = time.time()
                    # An external DB can temporarily disconnect. Keep the
                    # newest pending state for retry; never crash the game loop.
                    if key not in self._queue:
                        self._queue[key] = (version, room)
                    attempts += 1
                    if time.monotonic() - self._last_warning > 30:
                        self._last_warning = time.monotonic()
                        LOG.exception("Room snapshot storage temporarily unavailable")
                    await asyncio.sleep(min(8, 2 ** min(attempts, 3)))
        except asyncio.CancelledError:
            raise
        finally:
            self._tasks.pop(key, None)

    async def _write_one(self, key, version, room):
        if not self.pool:
            raise RuntimeError("Room store not started")
        kind, code = key
        if room is not None:
            data = serialize_room(kind, room)
        async with self.pool.acquire() as conn:
            if room is None:
                await conn.execute("""
                    DELETE FROM nakami_live_room_snapshots
                    WHERE kind=$1 AND code=$2 AND version <= $3
                """, kind, code, version)
            else:
                await conn.execute("""
                    INSERT INTO nakami_live_room_snapshots
                      (kind, code, version, data, updated_at)
                    VALUES ($1,$2,$3,$4,$5)
                    ON CONFLICT(kind, code) DO UPDATE SET
                      version=EXCLUDED.version, data=EXCLUDED.data,
                      updated_at=EXCLUDED.updated_at
                    WHERE nakami_live_room_snapshots.version <= EXCLUDED.version
                """, kind, code, version, data, time.time())

    @property
    def status(self):
        if not self.enabled:
            return "memory"
        if self._last_error > self._last_success:
            return "degraded"
        return "postgres"

    async def flush(self):
        if not self.enabled:
            return
        tasks = list(self._tasks.values())
        if not tasks:
            return
        try:
            await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), 12)
        except asyncio.TimeoutError:
            LOG.error("Timed out flushing room snapshots: %d pending", len(self._queue))

    async def stop(self):
        if not self.enabled:
            return
        self._closing = True
        await self.flush()
        if self.pool:
            await self.pool.close()
            self.pool = None

store = RoomStore()
