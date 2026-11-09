"""Collaborative pixel-free sketch room (絵チャ). No external database required.

Room state and its timelapse history live in memory, so a server reboot loses
the board. Incremental stroke events let multiple clients draw concurrently.
"""
import json
import re
import secrets
import time
from aiohttp import web

ROOMS = {}
CODES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
WIDTH, HEIGHT = 3072, 2048
MAX_ROOMS = 36
MAX_USERS = 12
MAX_STROKES = 1600
MAX_POINTS = 320
MAX_MESSAGES = 65
ROOM_TTL = 6 * 3600
STYLE_COLOR = re.compile(r'^#[0-9a-fA-F]{6}$')


def clean_old():
    now = time.time()
    expired = [code for code, room in ROOMS.items()
               if now-room['last']>ROOM_TTL and not room['members']]
    for code in expired:
        del ROOMS[code]


def clean_point(x):
    if not isinstance(x, list) or len(x)!=2 or any(type(n) not in (int,float) or not 0<=n<=1 for n in x):
        raise ValueError('座標の形式が不正です')
    return [round(x[0],5),round(x[1],5)]


def style_of(msg):
    color=msg.get('color','#3d3654')
    width=msg.get('width',7)
    opacity=msg.get('opacity',1)
    tool=msg.get('tool','pen')
    if not isinstance(color,str) or not STYLE_COLOR.fullmatch(color):
        raise ValueError('色が不正です')
    if type(width) not in (float,int) or not 1<=width<=90:
        raise ValueError('ペンの太さが不正です')
    if type(opacity) not in (float,int) or not .05<=opacity<=1:
        raise ValueError('透明度が不正です')
    if tool not in ('pen','eraser'):
        raise ValueError('描画ツールが不正です')
    return {'color':color.lower(),'width':int(width),'opacity':round(opacity,2),'tool':tool}


def public_members(room):
    return [{'id':m['id'],'name':m['name'],'color':m['color'],
             'owner':m['owner']} for m in room['members'].values()]


async def notify(room, payload, exclude=None):
    wire=json.dumps(payload,ensure_ascii=False,separators=(',',':'))
    for ws in list(room['members']):
        if ws is not exclude:
            try:
                await ws.send_str(wire)
            except (ConnectionError, RuntimeError):
                pass


def new_room():
    clean_old()
    if len(ROOMS)>=MAX_ROOMS:
        raise web.HTTPTooManyRequests(text='絵チャの部屋が満員です。時間をおいてください')
    while True:
        code=''.join(secrets.choice(CODES) for _ in range(6))
        if code not in ROOMS:
            break
    token=secrets.token_urlsafe(24)
    ROOMS[code]={'code':code,'ownerKey':token,'members':{},'strokes':[],
                 'drawing':{},'messages':[], 'last':time.time(),'version':0,
                 'created':time.time()}
    return code,token


async def create(request):
    code,key=new_room()
    return web.json_response({'code':code,'ownerKey':key,'width':WIDTH,'height':HEIGHT},
                             headers={'Cache-Control':'no-store'})


async def route_ws(request):
    ws=web.WebSocketResponse(heartbeat=25,max_msg_size=250000)
    await ws.prepare(request)
    room=None
    player_id=secrets.token_urlsafe(9)
    name=''
    try:
        async for msg in ws:
            if msg.type!=web.WSMsgType.TEXT:
                continue
            try:
                if len(msg.data)>95000:
                    raise ValueError('データが大きすぎます')
                data=json.loads(msg.data)
                if not isinstance(data,dict):
                    raise ValueError('送信形式が不正です')
                action=data.get('type')
                if not room:
                    if action!='join':
                        raise ValueError('先に部屋に入ってください')
                    code=str(data.get('code','')).upper().strip()
                    room=ROOMS.get(code)
                    if not room:
                        raise ValueError('部屋が見つかりません。再起動で消えた可能性があります')
                    if len(room['members'])>=MAX_USERS:
                        raise ValueError('部屋は12人までです')
                    name=str(data.get('name','')).strip()[:24]
                    if not name:
                        raise ValueError('ニックネームを入力してください')
                    key=data.get('ownerKey','')
                    is_owner=isinstance(key,str) and secrets.compare_digest(key,room['ownerKey'])
                    room['members'][ws]={'id':player_id,'name':name,'color':'#'+secrets.token_hex(3),'owner':is_owner}
                    room['last']=time.time()
                    await ws.send_json({'type':'snapshot','code':code,'me':player_id,
                        'owner':is_owner,'width':WIDTH,'height':HEIGHT,
                        'members':public_members(room),'strokes':room['strokes'],
                        'drawing':list(room['drawing'].values()),'messages':room['messages'],
                        'version':room['version']})
                    await notify(room,{'type':'members','members':public_members(room)})
                    continue
                room['last']=time.time()
                member=room['members'][ws]
                if action=='begin':
                    if player_id in room['drawing']:
                        raise ValueError('すでに描画中です')
                    if len(room['strokes'])>=MAX_STROKES:
                        raise ValueError('線が上限に達しました。管理者がキャンバスを整理してください')
                    point=clean_point(data.get('point'))
                    props=style_of(data)
                    room['drawing'][player_id]={'id':secrets.token_urlsafe(9),
                        'by':player_id,'name':name,'points':[point],'ts':time.time(),**props}
                    await notify(room,{'type':'begin','stroke':room['drawing'][player_id]},exclude=ws)
                elif action=='points':
                    stroke=room['drawing'].get(player_id)
                    if not stroke:
                        raise ValueError('描画が開始されていません')
                    points=data.get('points')
                    if not isinstance(points,list) or not 1<=len(points)<=24:
                        raise ValueError('座標の数が不正です')
                    remaining=MAX_POINTS-len(stroke['points'])
                    if remaining<=0:
                        continue
                    cleaned=[clean_point(x) for x in points[:remaining]]
                    stroke['points'].extend(cleaned)
                    await notify(room,{'type':'points','by':player_id,'points':cleaned},exclude=ws)
                elif action=='end':
                    stroke=room['drawing'].pop(player_id,None)
                    if stroke:
                        # A completed stroke is the atomic unit of history.
                        room['strokes'].append(stroke)
                        room['version']+=1
                        await notify(room,{'type':'end','stroke':stroke,'version':room['version']})
                elif action=='undo':
                    found=next((i for i in range(len(room['strokes'])-1,-1,-1)
                                if room['strokes'][i]['by']==player_id),None)
                    if found is not None:
                        removed=room['strokes'].pop(found)
                        room['version']+=1
                        await notify(room,{'type':'remove','id':removed['id'],
                                           'version':room['version']})
                elif action=='clear':
                    if not member['owner']:
                        raise ValueError('全消去できるのは部屋の作成者だけです')
                    room['strokes'].clear()
                    room['drawing'].clear()
                    room['version']+=1
                    await notify(room,{'type':'clear','version':room['version']})
                elif action=='chat':
                    value=data.get('text')
                    if not isinstance(value,str) or not 1<=len(value.strip())<=280:
                        raise ValueError('チャットは1〜280文字です')
                    item={'id':secrets.token_urlsafe(6),'name':name,'by':player_id,
                          'text':value.strip(),'ts':time.time()}
                    room['messages'].append(item)
                    room['messages']=room['messages'][-MAX_MESSAGES:]
                    await notify(room,{'type':'chat','item':item})
                elif action=='sync':
                    await ws.send_json({'type':'sync','strokes':room['strokes'],
                                        'drawing':list(room['drawing'].values()),
                                        'version':room['version']})
                else:
                    raise ValueError('不明な操作です')
            except (ValueError,TypeError,KeyError,json.JSONDecodeError) as exc:
                await ws.send_json({'type':'error','message':str(exc)[:130]})
    finally:
        if room and ws in room['members']:
            del room['members'][ws]
            if player_id in room['drawing']:
                # Preserve a disconnected user's completed portion of the stroke.
                stroke=room['drawing'].pop(player_id)
                room['strokes'].append(stroke)
                room['version']+=1
                await notify(room,{'type':'end','stroke':stroke,'version':room['version']})
            room['last']=time.time()
            await notify(room,{'type':'members','members':public_members(room)})
    return ws


def register(app):
    app.add_routes([web.post('/api/echa/create',create),
                    web.get('/api/echa/ws',route_ws)])
