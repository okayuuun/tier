"""Actual WebSocket smoke test for ordinary multiplayer game rooms.

Covers session restoration after a broken connection, room membership, and
application keepalive, not just the underlying synchronous game state machine.
"""
import asyncio
from aiohttp.test_utils import TestServer, TestClient
import server


async def state(ws):
    for _ in range(10):
        data = await asyncio.wait_for(ws.receive_json(), timeout=5)
        if data.get('type') == 'error':
            raise AssertionError(data['message'])
        if data.get('type') == 'state':
            return data
    raise AssertionError('The game server never sent a room state')


async def main():
    server.ROOMS.clear()
    async with TestClient(TestServer(server.app)) as client:
        first = await client.ws_connect('/ws')
        sid1='browser_session_first_player_1234'
        sid2='browser_session_second_player_5678'
        await first.send_json({'type':'create','name':'主催者','sid':sid1})
        a=await state(first)
        code=a['room']['code']
        original_id=a['me']
        assert a['room']['owner']==original_id
        second=await client.ws_connect('/ws')
        await second.send_json({'type':'join','code':code,'name':'友達','sid':sid2})
        b=await state(second)
        assert len(b['room']['players'])==2
        assert any(p['name']=='友達' for p in b['room']['players'])
        await state(first)
        await second.send_json({'type':'ping'})
        ping=await asyncio.wait_for(second.receive_json(),5)
        assert ping['type']=='pong'
        await first.close()
        await state(second)
        resumed=await client.ws_connect('/ws')
        await resumed.send_json({'type':'join','code':code,
                                 'name':'主催者','sid':sid1})
        again=await state(resumed)
        assert again['me']==original_id
        assert again['room']['code']==code
        assert len(again['room']['players'])==2
        assert all(p['online'] for p in again['room']['players'])
        await state(second)
        await resumed.send_json({'type':'ping'})
        pong=await asyncio.wait_for(resumed.receive_json(),5)
        assert pong['type']=='pong'
        await resumed.close()
        await second.close()
        # Server restart legitimately removes in-memory rooms; client should
        # present a new-room action instead of retrying a dead code forever.
        server.ROOMS.clear()
        missing=await client.ws_connect('/ws')
        await missing.send_json({'type':'join','code':code,'name':'主催者','sid':sid1})
        error=await asyncio.wait_for(missing.receive_json(),5)
        assert error['type']=='error'
        assert '見つかりません' in error['message']
        await missing.close()
    print('PASS: regular multiplayer create/join, two users, disconnect, reconnect, heartbeat and lost-room error')


asyncio.run(main())
