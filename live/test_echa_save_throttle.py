"""Painting packets should not enqueue an entire art-room DB snapshot."""
import asyncio
from unittest.mock import patch
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
import echa_backend as art


async def got(ws, kind):
    for _ in range(12):
        message=await asyncio.wait_for(ws.receive_json(),4)
        if message.get('type')=='error':
            raise AssertionError(message)
        if message.get('type')==kind:
            return message
    raise AssertionError('Missing '+kind)


async def main():
    art.ROOMS.clear()
    app=web.Application()
    art.register(app)
    try:
        with patch.object(art.ROOM_STORE, "mark") as marked:
            async with TestClient(TestServer(app)) as client:
                data=await (await client.post('/api/echa/create')).json()
                one=await client.ws_connect('/api/echa/ws')
                await one.send_json({'type':'join','name':'作者','code':data['code'],
                                     'ownerKey':data['ownerKey']})
                await got(one,'snapshot')
                await got(one,'members')
                two=await client.ws_connect('/api/echa/ws')
                await two.send_json({'type':'join','name':'参加者','code':data['code']})
                await got(two,'snapshot')
                await got(two,'members')
                await got(one,'members')
                marked.reset_mock()

                await one.send_json({'type':'begin','point':[.2,.2],
                                     'color':'#123456','width':8,
                                     'opacity':1,'tool':'pen'})
                await got(two,'begin')
                assert marked.call_count==0,'Begin should not serialize a full room'
                await one.send_json({'type':'points','points':[[.3,.3],[.4,.4]]})
                await got(two,'points')
                assert marked.call_count==0,'Live points should not trigger database snapshots'
                await one.send_json({'type':'end'})
                await got(one,'end')
                await got(two,'end')
                assert marked.call_count==1,'Completed mark must still be saved'
                assert len(art.ROOMS[data['code']]['strokes'])==1
                marked.reset_mock()

                await one.send_json({'type':'undo'})
                await got(two,'remove')
                assert marked.call_count==1,'Undo must save the updated artwork'
                marked.reset_mock()
                await one.send_json({'type':'chat','text':'こんにちは'})
                await got(two,'chat')
                assert marked.call_count==1,'Chat state should remain persistent'
                await one.close()
                await two.close()
    finally:
        art.ROOMS.clear()


if __name__=='__main__':
    asyncio.run(main())
    print('PASS: cloud snapshots only for durable changes, not live brush packets')
