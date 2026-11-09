"""Websocket collaboration smoke test: two artists, incremental broadcast and host actions."""
import asyncio
import json
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
from echa_backend import register, ROOMS, style_of, clean_point

async def take_type(ws,target):
    for _ in range(12):
        message=await asyncio.wait_for(ws.receive_json(),4)
        if message.get('type')==target:
            return message
        if message.get('type')=='error':
            raise AssertionError(message)
    raise AssertionError('Expected event '+target)

async def main():
    ROOMS.clear()
    app=web.Application()
    register(app)
    async with TestClient(TestServer(app)) as client:
        resp=await client.post('/api/echa/create')
        assert resp.status==200
        d=await resp.json()
        code,key=d['code'],d['ownerKey']
        assert len(code)==6 and len(key)>=15
        one=await client.ws_connect('/api/echa/ws')
        await one.send_json({'type':'join','code':code,'name':'作者','ownerKey':key})
        first=await take_type(one,'snapshot')
        assert first['owner'] and first['strokes']==[] and first['width']==3072
        await take_type(one,'members')
        two=await client.ws_connect('/api/echa/ws')
        await two.send_json({'type':'join','code':code,'name':'参加者'})
        second=await take_type(two,'snapshot')
        assert not second['owner'] and len(second['members'])==2
        assert 'ownerKey' not in json.dumps(second)
        await take_type(two,'members')
        await take_type(one,'members')
        stroke={'type':'begin','color':'#12abEF','width':7,'opacity':0.8,'tool':'pen','point':[.1,.2]}
        await one.send_json(stroke)
        begin=await take_type(two,'begin')
        assert begin['stroke']['color']=='#12abef'
        await one.send_json({'type':'points','points':[[.2,.3],[.3,.4]]})
        points=await take_type(two,'points')
        assert len(points['points'])==2
        await one.send_json({'type':'end'})
        ending=await take_type(one,'end')
        await take_type(two,'end')
        assert len(ROOMS[code]['strokes'])==1
        await two.send_json({'type':'sync'})
        synced=await take_type(two,'sync')
        assert synced['strokes'][0]['points']==[[.1,.2],[.2,.3],[.3,.4]]
        await two.send_json({'type':'undo'})
        await asyncio.sleep(.1)
        assert len(ROOMS[code]['strokes'])==1
        await one.send_json({'type':'undo'})
        await take_type(one,'remove')
        await take_type(two,'remove')
        assert ROOMS[code]['strokes']==[]
        await two.send_json({'type':'chat','text':'こんにちは！'})
        chat=await take_type(one,'chat')
        assert chat['item']['text']=='こんにちは！'
        await take_type(two,'chat')
        await two.send_json({'type':'clear'})
        err=await take_type(two,'error')
        assert '作成者' in err['message']
        await one.send_json({'type':'clear'})
        await take_type(one,'clear')
        await take_type(two,'clear')
        # Shared layer changes must broadcast to both clients.
        assert len(first['layers'])==1 and first['layers'][0]['id']=='base'
        await two.send_json({'type':'layer_op','op':'add'})
        update1=await take_type(one,'layers')
        update2=await take_type(two,'layers')
        assert update1['layers']==update2['layers']
        assert len(update1['layers'])==2
        layer_id=update1['selected']
        assert layer_id!='base'
        await two.send_json({'type':'layer_op','op':'rename','id':layer_id,'name':'線画'})
        await take_type(one,'layers')
        await take_type(two,'layers')
        assert ROOMS[code]['layers'][1]['name']=='線画'
        await two.send_json({'type':'layer_op','op':'opacity','id':layer_id,'value':.45})
        await take_type(one,'layers')
        await take_type(two,'layers')
        assert ROOMS[code]['layers'][1]['opacity']==.45
        await one.send_json({'type':'layer_op','op':'visible','id':layer_id,'value':False})
        await take_type(one,'layers')
        await take_type(two,'layers')
        await two.send_json({**stroke,'layer':layer_id})
        denied=await take_type(two,'error')
        assert '表示中' in denied['message']
        await one.send_json({'type':'layer_op','op':'visible','id':layer_id,'value':True})
        await take_type(one,'layers')
        await take_type(two,'layers')
        await two.send_json({**stroke,'layer':layer_id})
        await take_type(one,'begin')
        await two.send_json({'type':'end'})
        completed=await take_type(one,'end')
        await take_type(two,'end')
        assert completed['stroke']['layer']==layer_id
        assert len(ROOMS[code]['strokes'])==1
        await two.send_json({'type':'layer_op','op':'move','id':layer_id,'direction':-1})
        moved=await take_type(one,'layers')
        await take_type(two,'layers')
        assert moved['layers'][0]['id']==layer_id
        await two.send_json({'type':'layer_op','op':'remove','id':layer_id})
        denied=await take_type(two,'error')
        assert '部屋作成者' in denied['message']
        await one.send_json({'type':'layer_op','op':'remove','id':layer_id})
        removed=await take_type(one,'layers')
        await take_type(two,'layers')
        assert removed['deleted']==layer_id and removed['strokes']==[]
        assert len(ROOMS[code]['layers'])==1 and not ROOMS[code]['strokes']
        await two.send_json({'type':'sync'})
        latest=await take_type(two,'sync')
        assert len(latest['layers'])==1
        # Bucket click is a single atomic, undoable, layer-aware operation.
        await two.send_json({'type':'fill','point':[.3,.4],'layer':'base',
                             'color':'#ff0088','opacity':.7,
                             'tolerance':15,'reference':'all'})
        bucket=await take_type(one,'end')
        await take_type(two,'end')
        assert bucket['stroke']['tool']=='fill'
        assert bucket['stroke']['layer']=='base'
        assert bucket['stroke']['reference']=='all'
        assert bucket['stroke']['point']==[.3,.4]
        assert len(ROOMS[code]['strokes'])==1
        await two.send_json({'type':'fill','point':[.3,.4],'layer':'base',
                             'color':'#00ff00','opacity':1,
                             'tolerance':101,'reference':'all'})
        err=await take_type(two,'error')
        assert '許容値' in err['message']
        await two.send_json({'type':'fill','point':[.3,.4],'layer':'base',
                             'color':'#00ff00','opacity':1,
                             'tolerance':10,'reference':'url'})
        err=await take_type(two,'error')
        assert '参照モード' in err['message']
        await two.send_json({'type':'fill','point':[.3,.4],'layer':'base',
                             'color':'#00ff00','opacity':1,
                             'tolerance':15,'reference':'layer'})
        err=await take_type(two,'error')
        assert '連続' in err['message']
        await two.send_json({'type':'undo'})
        await take_type(one,'remove')
        await take_type(two,'remove')
        assert len(ROOMS[code]['strokes'])==0
        await two.close()
        await one.close()
    assert style_of({'color':'#ffaa22','width':2,'opacity':.2,'tool':'eraser'})['tool']=='eraser'
    for f in [lambda:clean_point([2,1]),lambda:clean_point(['1',.2]),
              lambda:style_of({'color':'red','width':3})]:
        try:f()
        except ValueError:pass
        else:raise AssertionError('invalid drawing input accepted')
    print('PASS: echa layers, flood fill events, reference validation, cooldown, undo, chat and host controls')

asyncio.run(main())
