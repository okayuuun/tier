"""An established art room must remain joinable after 60 past browser sessions.

The old cap treated the lifetime reconnect-token cache as a lifetime join
limit. The correct behavior is to retire the oldest disconnected guest token
without deleting existing strokes, owner credentials or current participants.
"""
import asyncio
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
from echa_backend import ROOMS, MAX_IDENTITIES, register
from room_store import serialize_room, deserialize_room


async def received(ws, expected):
    for _ in range(12):
        packet = await asyncio.wait_for(ws.receive_json(), 5)
        if packet.get('type') == 'error':
            raise AssertionError(packet)
        if packet.get('type') == expected:
            return packet
    raise AssertionError('Missing '+expected)


async def verify():
    ROOMS.clear()
    app = web.Application()
    register(app)
    try:
        async with TestClient(TestServer(app)) as client:
            resp = await client.post('/api/echa/create')
            assert resp.status == 200
            data = await resp.json()
            code = data['code']
            creator = await client.ws_connect('/api/echa/ws')
            await creator.send_json({
                'type':'join', 'code':code, 'name':'主催者',
                'ownerKey':data['ownerKey']
            })
            first = await received(creator, 'snapshot')
            owner_id, owner_token = first['me'], first['resumeToken']
            await received(creator, 'members')

            room = ROOMS[code]
            artwork = {
                'id':'original-ink', 'by':'old-member-0', 'name':'旧参加者',
                'layer':'base', 'tool':'pen', 'color':'#553388',
                'opacity':1, 'width':9, 'points':[[.1,.2],[.2,.3]]
            }
            room['strokes'].append(artwork)
            room['version'] += 1

            # Fill the old 60-identity quota without increasing active users.
            for i in range(MAX_IDENTITIES-1):
                room['identities'][f'history-token-{i}'] = {
                    'id':f'old-member-{i}', 'name':f'過去の人{i}',
                    'color':'#123456', 'owner':False
                }
            room['fillLast']['old-member-0'] = 123.0
            assert len(room['identities']) == MAX_IDENTITIES
            assert len(room['members']) == 1

            # The room must still be valid for cloud persistence.
            before = deserialize_room('art', serialize_room('art', room))
            assert len(before['identities']) == MAX_IDENTITIES
            assert before['strokes'] == [artwork]

            # Existing creator credentials still rejoin when the cache is full.
            resumed = await client.ws_connect('/api/echa/ws')
            await resumed.send_json({
                'type':'join', 'code':code, 'name':'主催者',
                'resumeToken':owner_token
            })
            restored = await received(resumed, 'snapshot')
            assert restored['me'] == owner_id
            assert restored['owner'] is True
            assert len(room['identities']) == MAX_IDENTITIES
            assert owner_token in room['identities']
            await creator.close()

            # New tabs/people rotate inactive history, never deleting any art.
            for i in range(4):
                newcomer = await client.ws_connect('/api/echa/ws')
                await newcomer.send_json({
                    'type':'join', 'code':code, 'name':f'新しい参加者{i}'
                })
                snapshot = await received(newcomer, 'snapshot')
                assert snapshot['strokes'] == [artwork]
                assert len(room['strokes']) == 1
                assert len(room['identities']) == MAX_IDENTITIES
                assert owner_token in room['identities']
                assert snapshot['me'] != owner_id
                assert len(room['members']) <= 2
                await newcomer.close()

            assert 'history-token-0' not in room['identities']
            assert 'old-member-0' not in room['fillLast']
            assert room['strokes'] == [artwork]
            after = deserialize_room('art', serialize_room('art', room))
            assert after['strokes'] == [artwork]
            assert owner_token in after['identities']
            assert len(after['identities']) == MAX_IDENTITIES
            await resumed.close()
    finally:
        ROOMS.clear()


if __name__ == '__main__':
    asyncio.run(verify())
    print('PASS: 60 historical identities do not block joins or delete artwork')
