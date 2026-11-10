"""End-to-end process-restart simulation with real PostgreSQL.

Run only with a disposable TEST_ROOM_DATABASE_URL. Loads two separate aiohttp
application instances in the same Python process (module reload simulates the
new process) to verify the route and websocket integration as well as storage.
"""
import asyncio
import importlib
import os

os.environ['ROOM_DATABASE_URL'] = os.environ['TEST_ROOM_DATABASE_URL']

import room_store
import echa_backend
import master_admin
import server
from aiohttp.test_utils import TestClient, TestServer


async def state(ws, phase=None):
    for _ in range(30):
        message = await asyncio.wait_for(ws.receive_json(), 6)
        if message.get('type') == 'error':
            raise AssertionError(message)
        if message.get('type') == 'state' and (
                phase is None or message['room']['phase'] == phase):
            return message
    raise AssertionError(f'Expected phase {phase}')


async def art_event(ws, type_):
    for _ in range(15):
        item = await asyncio.wait_for(ws.receive_json(), 6)
        if item.get('type') == 'error':
            raise AssertionError(item)
        if item.get('type') == type_:
            return item
    raise AssertionError('Expected art event '+type_)


async def main():
    sid1 = 'durable_app_owner_session_123456789'
    sid2 = 'durable_app_guest_session_123456789'

    async with TestClient(TestServer(server.app)) as client:
        host = await client.ws_connect('/ws')
        await host.send_json({'type':'create','name':'Host','sid':sid1})
        first = await state(host)
        code = first['room']['code']
        owner_id = first['me']
        assert first['room']['restoredAt'] is None
        assert first['room']['retentionHours']==room_store.GAME_RETENTION_HOURS
        assert first['room']['persistence']=='postgres'
        guest = await client.ws_connect('/ws')
        await guest.send_json({'type':'join','name':'Guest','code':code,'sid':sid2})
        friend = await state(guest)
        friend_id = friend['me']
        await host.send_json({'type':'configure','game':'quiet'})
        await host.send_json({'type':'start'})
        original_host = await state(host,'qt_play')
        original_guest = await state(guest,'qt_play')
        # Confirm a real cloud write through the same authenticated WebSocket.
        await host.send_json({'type':'save_now'})
        save_reply=await asyncio.wait_for(host.receive_json(),12)
        assert save_reply['type']=='save_status' and save_reply['ok']
        assert isinstance(save_reply['at'],(float,int))
        expected_host = original_host['room']['board']['myHand']
        expected_guest = original_guest['room']['board']['myHand']
        assert len(expected_host) == 1 and len(expected_guest) == 1

        response = await client.post('/api/echa/create')
        assert response.status == 200
        created = await response.json()
        art_code, key = created['code'], created['ownerKey']
        paint = await client.ws_connect('/api/echa/ws')
        await paint.send_json({'type':'join','code':art_code,
                               'name':'Drawer','ownerKey':key})
        snap = await art_event(paint,'snapshot')
        paint_pid, token = snap['me'],snap['resumeToken']
        assert snap['restoredAt'] is None
        assert snap['retentionHours']==room_store.ART_RETENTION_HOURS
        assert snap['persistence']=='postgres'
        await paint.send_json({'type':'begin','color':'#bb33cc','width':5,
                               'opacity':1,'tool':'pen','point':[.2,.3]})
        await paint.send_json({'type':'end'})
        await art_event(paint,'end')
        await paint.send_json({'type':'save_now'})
        confirmed_art=await art_event(paint,'save_status')
        assert confirmed_art['ok'] and confirmed_art['at']>0
        await server.ROOM_STORE.flush()

    # Simulate a fresh Render Python process: globals and sockets reset, but
    # the external PostgreSQL rows remain. Reload in dependency order.
    importlib.reload(room_store)
    importlib.reload(echa_backend)
    importlib.reload(master_admin)
    importlib.reload(server)
    async with TestClient(TestServer(server.app)) as client:
        assert code in server.ROOMS
        assert art_code in echa_backend.ROOMS
        assert all(p['ws'] is None for p in server.ROOMS[code]['players'].values())
        assert len(echa_backend.ROOMS[art_code]['strokes']) == 1

        restored_host = await client.ws_connect('/ws')
        await restored_host.send_json({'type':'join','name':'Host','code':code,'sid':sid1})
        after = await state(restored_host,'qt_play')
        assert after['me'] == owner_id
        assert isinstance(after['room']['restoredAt'], (float, int))
        assert after['room']['retentionHours']==room_store.GAME_RETENTION_HOURS
        assert after['room']['board']['myHand'] == expected_host
        restored_friend = await client.ws_connect('/ws')
        await restored_friend.send_json({'type':'join','name':'Guest','code':code,'sid':sid2})
        other = await state(restored_friend,'qt_play')
        assert other['me'] == friend_id
        assert other['room']['board']['myHand'] == expected_guest

        restored_paint = await client.ws_connect('/api/echa/ws')
        await restored_paint.send_json({'type':'join','code':art_code,
                                        'name':'Drawer','ownerKey':key,
                                        'resumeToken':token})
        paint_state = await art_event(restored_paint,'snapshot')
        assert paint_state['me'] == paint_pid
        assert isinstance(paint_state['restoredAt'], (float, int))
        assert paint_state['retentionHours']==room_store.ART_RETENTION_HOURS
        assert paint_state['owner'] is True
        assert len(paint_state['strokes']) == 1
        health=await client.get('/health')
        details=await health.json()
        assert details['roomPersistence']=='postgres'
        assert details['roomRetentionHours']=={
            'game':room_store.GAME_RETENTION_HOURS,
            'art':room_store.ART_RETENTION_HOURS,
        }
        assert paint_state['strokes'][0]['color'] == '#bb33cc'

        # The restored game can continue with real actions.
        await restored_host.send_json({'type':'qt_play',
                                       'number':expected_host[0]})
        newer = await state(restored_host)
        assert newer['room']['phase'] in ('qt_play','qt_reveal','final')

        # Clean up test-created rows so snapshots don't leak between runs.
        server.ROOMS.pop(code)
        echa_backend.ROOMS.pop(art_code)
        server.ROOM_STORE.delete('game',code)
        server.ROOM_STORE.delete('art',art_code)
        await server.ROOM_STORE.flush()

    print('PASS full app restart: game participants, private hands, art ownership, strokes, continuing play')


asyncio.run(main())
