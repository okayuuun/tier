"""New art rooms use smaller canvases and four layers without deleting old ink."""
import asyncio
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
import echa_backend as art
from room_store import serialize_room, deserialize_room


async def receive(ws, expected):
    for _ in range(20):
        msg=await asyncio.wait_for(ws.receive_json(),5)
        if msg.get('type')==expected:return msg
        if msg.get('type')=='error':raise AssertionError(msg)
    raise AssertionError('Missing '+expected)


async def main():
    art.ROOMS.clear()
    app=web.Application()
    art.register(app)
    try:
        async with TestClient(TestServer(app)) as client:
            created=await (await client.post('/api/echa/create')).json()
            code=created['code']
            assert (created['width'],created['height'])==(1920,1280)
            room=art.ROOMS[code]
            assert room['maxLayers']==4 and room['undoHistory']==[]
            ws=await client.ws_connect('/api/echa/ws')
            await ws.send_json({'type':'join','code':code,'name':'作者',
                                'ownerKey':created['ownerKey']})
            snap=await receive(ws,'snapshot')
            assert (snap['width'],snap['height'],snap['maxLayers'])==(1920,1280,4)
            await receive(ws,'members')

            # Four layers at most, with no destructive removal.
            for _ in range(3):
                await ws.send_json({'type':'layer_op','op':'add'})
                await receive(ws,'layers')
            assert len(room['layers'])==4
            await ws.send_json({'type':'layer_op','op':'add'})
            extra=await receive(ws,'error')
            assert '4枚' in extra['message']
            assert len(room['layers'])==4

            # All pen strokes remain; undo only reaches the most recent 12.
            for i in range(15):
                await ws.send_json({'type':'begin','point':[.1,.2],
                                    'layer':'base','tool':'pen',
                                    'color':'#113355','width':4,'opacity':1})
                await ws.send_json({'type':'end'})
                await receive(ws,'end')
            assert len(room['strokes'])==15
            assert len(room['undoHistory'])==12
            original_ids={s['id'] for s in room['strokes'][:3]}
            for _ in range(12):
                await ws.send_json({'type':'undo'})
                await receive(ws,'remove')
            assert len(room['strokes'])==3
            assert {s['id'] for s in room['strokes']}==original_ids
            await ws.send_json({'type':'undo'})
            await ws.send_json({'type':'sync'})
            remaining=await receive(ws,'sync')
            assert len(remaining['strokes'])==3
            assert len(room['strokes'])==3
            saved=deserialize_room('art',serialize_room('art',room))
            assert saved['width']==1920 and saved['height']==1280
            assert saved['maxLayers']==4 and len(saved['strokes'])==3
            assert saved['undoHistory']==[]

            # Old rooms remain at their original size with all 8 layers.
            old={**room,'code':'OLD777'}
            old.pop('width');old.pop('height');old.pop('maxLayers')
            old.pop('undoHistory')
            legacy=deserialize_room('art',serialize_room('art',old))
            assert (legacy['width'],legacy['height'],legacy['maxLayers'])==(3072,2048,8)
            assert len(legacy['strokes'])==3
            await ws.close()
    finally:
        art.ROOMS.clear()


if __name__=='__main__':
    asyncio.run(main())
    print('PASS: small new art rooms, 4 layers, 12 undo steps and legacy preservation')
