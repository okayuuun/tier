"""Optional downsize must preserve legacy artwork and all existing layers."""
import asyncio
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
import echa_backend as art
from room_store import serialize_room, deserialize_room


async def got(ws, kind):
    for _ in range(20):
        msg=await asyncio.wait_for(ws.receive_json(),5)
        if msg.get('type')==kind:return msg
        if msg.get('type')=='error':
            raise AssertionError(msg)
    raise AssertionError('Missing '+kind)


async def run():
    art.ROOMS.clear()
    app=web.Application()
    art.register(app)
    try:
        async with TestClient(TestServer(app)) as client:
            meta=await (await client.post('/api/echa/create')).json()
            room=art.ROOMS[meta['code']]
            # Simulate an older 3072x2048 room with more than 4 layers.
            room['width']=3072;room['height']=2048;room['maxLayers']=8
            room['layers']=[art.new_layer('base','レイヤー1')]+[
                art.new_layer('layer_'+str(i),'古いレイヤー'+str(i))
                for i in range(2,7)]
            room['layerSeq']=6
            first={'id':'old1','tool':'pen','layer':'base','by':'guest-old',
                   'width':8,'color':'#123456','opacity':1,'points':[[.1,.2],[.9,.8]]}
            second={'id':'old2','tool':'eraser','layer':'layer_3','by':'guest-old',
                    'width':30,'color':'#123456','opacity':1,'points':[[.3,.4],[.6,.7]]}
            room['strokes']=[first,second]
            ws=await client.ws_connect('/api/echa/ws')
            await ws.send_json({'type':'join','code':meta['code'],
                                'name':'主催者','ownerKey':meta['ownerKey']})
            before=await got(ws,'snapshot')
            assert before['width']==3072 and before['maxLayers']==8
            await got(ws,'members')
            guest=await client.ws_connect('/api/echa/ws')
            await guest.send_json({'type':'join','code':meta['code'],'name':'ゲスト'})
            await got(guest,'snapshot')
            await got(guest,'members')
            await got(ws,'members')

            await guest.send_json({'type':'resize'})
            error=await asyncio.wait_for(guest.receive_json(),5)
            assert error['type']=='error' and '作成者' in error['message']
            assert room['width']==3072
            await ws.send_json({'type':'resize'})
            result=await got(ws,'resize')
            await got(guest,'resize')
            assert result['width']==1920 and result['height']==1280
            assert round(result['widthFactor'],4)==.625
            assert room['width']==1920 and room['height']==1280
            assert len(room['layers'])==6 and room['maxLayers']==6
            assert [s['id'] for s in room['strokes']]==['old1','old2']
            assert room['strokes'][0]['points']==[[.1,.2],[.9,.8]]
            assert room['strokes'][1]['points']==[[.3,.4],[.6,.7]]
            assert room['strokes'][0]['width']==5
            assert room['strokes'][1]['width']==19
            snapshot=deserialize_room('art',serialize_room('art',room))
            assert snapshot['width']==1920 and snapshot['maxLayers']==6
            assert len(snapshot['strokes'])==2 and len(snapshot['layers'])==6
            await ws.send_json({'type':'resize'})
            error=await asyncio.wait_for(ws.receive_json(),5)
            assert error['type']=='error' and 'すでに軽量サイズ' in error['message']
            await ws.close()
            await guest.close()
    finally:
        art.ROOMS.clear()


if __name__=='__main__':
    asyncio.run(run())
    print('PASS: optional old-room shrink preserves every stroke and layer')
