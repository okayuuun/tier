"""Actual PostgreSQL integration: room snapshots, restart recovery and deletion.

CI supplies TEST_ROOM_DATABASE_URL through a temporary Postgres service.
Do not use real production credentials or expose connection URLs in logs.
"""
import asyncio
import os
import time
from room_store import RoomStore, serialize_room, deserialize_room


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
    assert 'ws' not in serialize_room('game',games['DUR777']).decode('latin-1','ignore')
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
    await check.stop()
    await fresh.stop()
    print('PASS PostgreSQL real DB: save, coalesce, restart, session identities, art restoration, remove')

asyncio.run(main())
