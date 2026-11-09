"""End-to-end WebSocket smoke test for new multi-device board games."""
import asyncio
from aiohttp.test_utils import TestClient, TestServer
import server

async def state(ws,phase=None):
    for _ in range(60):
        item=await asyncio.wait_for(ws.receive_json(),5)
        if item.get('type')=='error':
            raise AssertionError(item)
        if item.get('type')=='state' and (phase is None or item['room']['phase']==phase):
            return item
    raise AssertionError(f'State for phase {phase} did not arrive')

async def main():
    server.ROOMS.clear()
    async with TestClient(TestServer(server.app)) as client:
        clients=[];ids=[]
        for i in range(4):
            ws=await client.ws_connect('/ws')
            clients.append(ws)
            event={'type':'create'} if i==0 else {'type':'join','code':code}
            await ws.send_json({**event,'name':f'player{i}','sid':'board_test_socket_player_'+str(i)*15})
            snap=await state(ws)
            if i==0:code=snap['room']['code']
            ids.append(snap['me'])
        host=clients[0]
        await host.send_json({'type':'configure','game':'oneword'})
        await host.send_json({'type':'start'})
        states=[await state(ws,'bg_hint') for ws in clients]
        assert all(s['room']['game']=='oneword' for s in states)
        assert states[0]['room']['board']['word'] is None
        word=states[1]['room']['board']['word']
        assert word and word==states[2]['room']['board']['word']
        for j in (1,2,3):
            await clients[j].send_json({'type':'bg_hint','text':f'ヒント{j}'})
        states=[await state(ws,'bg_guess') for ws in clients]
        assert states[0]['room']['board']['word'] is None
        assert len(states[0]['room']['board']['clues'])==3
        await host.send_json({'type':'bg_answer','text':word})
        states=[await state(ws,'bg_reveal') for ws in clients]
        assert all(s['room']['board']['last']['correct'] for s in states)
        assert states[1]['room']['players'][1]['score']==1
        await host.send_json({'type':'end'})
        for ws in clients: await state(ws,'final')
        await host.send_json({'type':'restart'})
        for ws in clients: await state(ws,'lobby')
        await host.send_json({'type':'configure','game':'wordagents'})
        await host.send_json({'type':'start'})
        states=[await state(ws,'wa_play') for ws in clients]
        assert states[0]['room']['board']['owners'] is not None
        assert states[1]['room']['board']['owners'] is not None
        assert states[2]['room']['board']['owners'] is None
        assert states[3]['room']['board']['owners'] is None
        captain=states[0]['room']['board']['captains']['red']
        assert captain==ids[0]
        words=states[0]['room']['board']['words']
        clue='ほかの言葉'
        assert clue not in words
        await clients[0].send_json({'type':'wa_clue','text':clue,'number':1})
        for ws in clients: await state(ws,'wa_play')
        for ws in clients:await ws.close()
    print('PASS: 4 real WebSockets, clue secrecy, scoring, restart, two-team captain privacy')

asyncio.run(main())
