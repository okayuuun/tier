"""Multiplayer WebSocket test for secret cards and kana attacks."""
import asyncio
from aiohttp.test_utils import TestClient,TestServer
import server

async def read_state(ws,phase=None):
    for _ in range(100):
        msg=await asyncio.wait_for(ws.receive_json(),6)
        if msg.get('type')=='error':raise AssertionError(msg)
        if msg.get('type')=='state' and (phase is None or msg['room']['phase']==phase):
            return msg
    raise AssertionError('Expected game state: '+str(phase))

async def main():
    server.ROOMS.clear()
    async with TestClient(TestServer(server.app)) as client:
        ws=[];ids=[]
        for i in range(4):
            w=await client.ws_connect('/ws')
            ws.append(w)
            msg={'type':'create' if i==0 else 'join',
                 'name':'player'+str(i),'sid':'plus_sockets_player_'+str(i)*18}
            if i>0:msg['code']=code
            await w.send_json(msg)
            result=await read_state(w,'lobby')
            if i==0:code=result['room']['code']
            ids.append(result['me'])
        await ws[0].send_json({'type':'configure','game':'aiuebattle'})
        # This game accepts 2-5 people.
        await ws[0].send_json({'type':'start'})
        states=[await read_state(w,'bp_ai_write') for w in ws]
        assert all(s['room']['game']=='aiuebattle' for s in states)
        for i,word in enumerate(('かさ','さかな','ねこ','みかん')):
            await ws[i].send_json({'type':'ai_write','word':word})
        states=[await read_state(w,'bp_ai_attack') for w in ws]
        assert states[0]['room']['boardplus']['mine']=='かさ'
        assert states[1]['room']['boardplus']['mine']=='さかな'
        assert states[1]['room']['boardplus']['boards'][ids[0]]['letters']==[None,None]
        await ws[0].send_json({'type':'ai_attack','letter':'か'})
        states=[await read_state(w,'bp_ai_attack') for w in ws]
        assert states[1]['room']['boardplus']['boards'][ids[0]]['letters']==['か',None]
        assert states[2]['room']['boardplus']['boards'][ids[1]]['letters']==[None,'か',None]
        await ws[0].send_json({'type':'end'})
        for w in ws:await read_state(w,'final')
        await ws[0].send_json({'type':'restart'})
        for w in ws:await read_state(w,'lobby')
        await ws[0].send_json({'type':'configure','game':'skyfire'})
        await ws[0].send_json({'type':'start'})
        states=[await read_state(w,'bp_fire') for w in ws]
        a=states[0]['room']['boardplus']['hands']
        assert all(c['c'] is None and c['n'] is None for c in a[ids[0]])
        assert all(c['c'] is not None and c['n'] is not None for c in a[ids[1]])
        b=states[1]['room']['boardplus']['hands']
        assert all(c['c'] is None for c in b[ids[1]])
        color=a[ids[1]][0]['c']
        await ws[0].send_json({'type':'hf_hint','target':ids[1],'axis':'c','value':color})
        states=[await read_state(w,'bp_fire') for w in ws]
        assert states[1]['room']['boardplus']['hands'][ids[1]][0]['c']==color
        assert states[1]['room']['boardplus']['turn']==ids[1]
        for w in ws:await w.close()
    print('PASS: four real clients, aiue attacks and secrecy, Hanabi-style hidden hand and hints')

asyncio.run(main())
