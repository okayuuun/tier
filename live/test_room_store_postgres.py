"""Actual PostgreSQL integration: room snapshots, restart recovery and deletion.

CI supplies TEST_ROOM_DATABASE_URL through a temporary Postgres service.
Do not use real production credentials or expose connection URLs in logs.
"""
import asyncio
import os
import zlib
import time
from room_store import (RoomStore, serialize_room, deserialize_room,
                        normalize_postgres_dsn, retention_hours, GAME_TTL, ART_TTL)
from unittest.mock import patch


class Socket:
    closed=False


def game_room():
    return {
        'code':'DUR777','createdAt':time.time(),'lastUsed':time.time(),
        'creatorSid':'durable_creator_sid_1234567890',
        'owner':'owner-id','phase':'bg_guess','game':'oneword',
        'active':['owner-id','friend-id'], 'matchNo':1,
        'points':{'owner-id':3,'friend-id':2},
        'lock':asyncio.Lock(),
        'players':{
            'owner-id':{'id':'owner-id','sid':'owner_session_123456789','name':'作成者',
                        'ws':Socket(),'emoji':'🍓'},
            'friend-id':{'id':'friend-id','sid':'friend_session_123456789','name':'参加者',
                         'ws':Socket(),'emoji':'🌸'},
        },
        'board':{
            'round':1,'roundLimit':6,'words':['りんご','かさ','ほし','みかん','はな','くも'],
            'clues':{'friend-id':'果物'},'guesser':'owner-id',
            'history':[{'answer':'雨'}]
        },
        'gameConfig':{'members':{'one':'two'}},
    }


def art_room():
    return {
        'code':'ART777','ownerKey':'very_secret_owner_key_123456',
        'created':time.time(),'last':time.time(),'version':2,
        'layers':[{'id':'base','name':'線画','visible':True,'opacity':1}],
        'layerSeq':1,'fillLast':{},'messages':[
            {'id':'hello','by':'artist','text':'テストです','ts':time.time()}],
        'strokes':[{'id':'stroke1','by':'artist','layer':'base',
                    'tool':'pen','color':'#ff88bb','points':[[0.1,0.2],[0.2,0.3]]}],
        'drawing':{'artist':{'id':'stroke2','by':'artist','layer':'base',
                    'tool':'pen','color':'#ffffff','points':[[0.3,0.4]]}},
        'identities':{'resume_secret_token':{
            'id':'artist','name':'描き手','owner':True,'color':'#112233'}},
        'members':{Socket():{'id':'artist','name':'描き手'}},
        'notifyLock':asyncio.Lock(),
    }


async def main():
    # Retention is configurable without allowing unbounded database growth.
    assert GAME_TTL >= 3600 and ART_TTL >= 3600
    with patch.dict(os.environ, {'GAME_ROOM_RETENTION_HOURS':'96'}):
        assert retention_hours('GAME_ROOM_RETENTION_HOURS',72,336) == 96
    with patch.dict(os.environ, {'GAME_ROOM_RETENTION_HOURS':'999999'}):
        assert retention_hours('GAME_ROOM_RETENTION_HOURS',72,336) == 72
    with patch.dict(os.environ, {'GAME_ROOM_RETENTION_HOURS':'invalid'}):
        assert retention_hours('GAME_ROOM_RETENTION_HOURS',72,336) == 72
    # Neon Console's normal URL has channel_binding=require. asyncpg does not
    # recognize that parameter, but should retain SSL and password faithfully.
    neon_url = ('postgresql://app:p%40ssword@ep-example-pooler.aws.neon.tech/'
                'neondb?sslmode=require&channel_binding=require')
    normalized = normalize_postgres_dsn(neon_url)
    assert 'sslmode=require' in normalized
    assert 'channel_binding' not in normalized
    assert 'p%40ssword@' in normalized
    assert normalize_postgres_dsn(normalized) == normalized
    assert normalize_postgres_dsn('postgresql://user:pass@localhost/db') == (
        'postgresql://user:pass@localhost/db')
    assert RoomStore(neon_url).dsn == normalized
    dsn=os.environ['TEST_ROOM_DATABASE_URL']
    store=RoomStore(dsn,delay=.05)
    await store.start()
    g=game_room()
    a=art_room()
    store.mark('game',g)
    g['points']['owner-id']=5
    store.mark('game',g)
    store.mark('art',a)
    await store.flush()
    assert store.status=='postgres'
    explicit=await store.save_and_confirm('game',g,timeout=3.0)
    assert isinstance(explicit,float) and explicit>0
    async with store.pool.acquire() as conn:
        persisted=await conn.fetchrow("""
            SELECT version, data FROM nakami_live_room_snapshots
            WHERE kind='game' AND code='DUR777'
        """)
    assert persisted is not None
    assert persisted['version'] >= 2
    assert deserialize_room('game',bytes(persisted['data']))['points']['owner-id']==5
    # An invalid snapshot must NEVER be acknowledged as stored.
    malformed=game_room()
    malformed['code']='DUR780'
    malformed['bad']=object()
    assert await store.save_and_confirm('game',malformed,timeout=2.0) is None
    assert await RoomStore('').save_and_confirm('game',g,timeout=.1) is None
    await store.stop()

    fresh=RoomStore(dsn,delay=.05)
    await fresh.start()
    games,arts=await fresh.load()
    assert games['DUR777']['points']['owner-id']==5
    assert games['DUR777']['players']['owner-id']['ws'] is None
    assert games['DUR777']['players']['owner-id']['sid']=='owner_session_123456789'
    assert isinstance(games['DUR777']['lock'],asyncio.Lock)
    assert games['DUR777']['gameConfig']['members']=={'one':'two'}
    assert games['DUR777']['board']['clues']['friend-id']=='果物'
    assert arts['ART777']['ownerKey']=='very_secret_owner_key_123456'
    assert arts['ART777']['identities']['resume_secret_token']['id']=='artist'
    assert arts['ART777']['members']=={}
    assert len(arts['ART777']['strokes'])==2
    assert arts['ART777']['drawing']=={}
    assert arts['ART777']['version']==3
    # Check the actual JSON, not random compressed bytes (which may
    # coincidentally contain the letters "ws" and fail nondeterministically).
    encoded=serialize_room('game',games['DUR777'])
    assert b'"ws"' not in zlib.decompress(encoded)
    assert deserialize_room('game',serialize_room('game',games['DUR777']))['players']['owner-id']['ws'] is None

    games['DUR777']['phase']='final'
    fresh.mark('game',games['DUR777'])
    await fresh.flush()
    fresh.delete('game','DUR777')
    fresh.delete('art','ART777')
    await fresh.flush()
    check=RoomStore(dsn)
    await check.start()
    games2,arts2=await check.load()
    assert 'DUR777' not in games2 and 'ART777' not in arts2
    # Retention pruning must remove expired snapshots but preserve recent ones.
    old_game=game_room()
    old_game['code']='DUR778'
    old_art=art_room()
    old_art['code']='ART778'
    current_game=game_room()
    current_game['code']='DUR779'
    check.mark('game',old_game)
    check.mark('art',old_art)
    check.mark('game',current_game)
    await check.flush()
    async with check.pool.acquire() as conn:
        await conn.execute("""
            UPDATE nakami_live_room_snapshots SET updated_at=$1
            WHERE kind='game' AND code='DUR778'
        """, time.time()-GAME_TTL-60)
        await conn.execute("""
            UPDATE nakami_live_room_snapshots SET updated_at=$1
            WHERE kind='art' AND code='ART778'
        """, time.time()-ART_TTL-60)
    await check.prune()
    async with check.pool.acquire() as conn:
        rows=await conn.fetch("""
            SELECT code FROM nakami_live_room_snapshots
            WHERE code IN ('DUR778','ART778','DUR779')
        """)
    assert {row['code'] for row in rows}=={'DUR779'}, rows
    check.delete('game','DUR779')
    await check.flush()
    await check.stop()
    await fresh.stop()
    print('PASS PostgreSQL real DB: save, coalesce, restart, session identities, expiration cleanup and remove')

asyncio.run(main())
