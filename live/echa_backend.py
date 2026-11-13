"""Collaborative pixel-free sketch room (絵チャ). No external database required.

Room state and its timelapse history live in memory, so a server reboot loses
the board. Incremental stroke events let multiple clients draw concurrently.
"""
import asyncio
import json
import logging
import re
import secrets
import time
from aiohttp import web
from room_store import store as ROOM_STORE, ART_TTL, ART_RETENTION_HOURS

LOGGER = logging.getLogger("nakami.echa")
ROOMS = {}
RESTORE_LOCK = asyncio.Lock()  # Keep simultaneous late joins from overwriting one another.
CODES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
WIDTH, HEIGHT = 3072, 2048
MAX_ROOMS = 36
MAX_USERS = 12
MAX_LAYERS = 8
MAX_POINTS = 320
MAX_MESSAGES = 65
FILL_COOLDOWN = 0.65  # seconds, per participant
ROOM_TTL = ART_TTL if ROOM_STORE.enabled else 6 * 3600


def audit_art(request, room, name, action, detail=""):
    """Only benign metadata: no messages, strokes, login tokens, IPs or private art."""
    admin = request.app.get("master_admin")
    if admin is None:
        return
    try:
        admin.log_action({"code": room["code"], "game": "echa"},
                         name, action, detail)
    except Exception:
        LOGGER.exception("Non-critical art-chat audit failure")


STYLE_COLOR = re.compile(r'^#[0-9a-fA-F]{6}$')


def new_layer(ident, name):
    return {'id': ident, 'name': name, 'visible': True, 'opacity': 1.0}


def change_layer(room, member, data):
    """Update shared layers. Deletion is owner-only and prunes deleted ink."""
    layers = room['layers']
    op = data.get('op')
    if op == 'add':
        if len(layers) >= MAX_LAYERS:
            raise ValueError(f'レイヤーは{MAX_LAYERS}枚までです')
        room['layerSeq'] += 1
        layer = new_layer('layer_' + str(room['layerSeq']),
                          'レイヤー ' + str(room['layerSeq']))
        layers.append(layer)
        return {'selected': layer['id']}
    ident = data.get('id')
    index = next((i for i, layer in enumerate(layers) if layer['id'] == ident), None)
    if index is None:
        raise ValueError('レイヤーが見つかりません')
    layer = layers[index]
    if op == 'rename':
        name = data.get('name')
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 40:
            raise ValueError('レイヤー名は1〜40文字です')
        layer['name'] = name.strip()
    elif op == 'visible':
        value = data.get('value')
        if type(value) is not bool:
            raise ValueError('表示設定が不正です')
        layer['visible'] = value
    elif op == 'opacity':
        value = data.get('value')
        if type(value) not in (int,float) or not 0 <= value <= 1:
            raise ValueError('レイヤーの不透明度は0〜100%です')
        layer['opacity'] = round(value, 2)
    elif op == 'move':
        direction = data.get('direction')
        if type(direction) is not int or direction not in (-1,1):
            raise ValueError('移動方向が不正です')
        other = index + direction
        if not 0 <= other < len(layers):
            raise ValueError('これ以上レイヤーを移動できません')
        layers[index], layers[other] = layers[other], layers[index]
    elif op == 'remove':
        if not member['owner']:
            raise ValueError('レイヤーの削除は部屋作成者だけです')
        if len(layers) == 1:
            raise ValueError('最後のレイヤーは削除できません')
        layers.pop(index)
        room['strokes'] = [s for s in room['strokes'] if s.get('layer','base') != ident]
        room['drawing'] = {pid:s for pid,s in room['drawing'].items()
                           if s.get('layer','base') != ident}
        return {'deleted':ident}
    else:
        raise ValueError('レイヤー操作が不正です')
    return {}


def clean_old():
    now = time.time()
    expired = [code for code, room in ROOMS.items()
               if now-room['last']>ROOM_TTL and not room['members']]
    for code in expired:
        del ROOMS[code]
        ROOM_STORE.delete("art", code)


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
    """Preserve event order while sending to peers concurrently and with bounds."""
    # Brush points arrive many times per second. Scheduling a compressed
    # full-room PostgreSQL snapshot for every point blocks large canvases.
    # Persist completed changes instead; the in-progress stroke remains live
    # via WebSocket and an explicit cloud-save still captures the full room.
    if payload.get('type') not in ('begin', 'points', 'cancel'):
        ROOM_STORE.mark("art", room)
    wire=json.dumps(payload,ensure_ascii=False,separators=(',',':'))
    async with room.setdefault('notifyLock', asyncio.Lock()):
        sockets=[ws for ws in list(room['members']) if ws is not exclude and not ws.closed]
        async def send_one(socket):
            try:
                await asyncio.wait_for(socket.send_str(wire), 4)
                return True
            except (asyncio.TimeoutError, ConnectionError, RuntimeError, OSError):
                LOGGER.warning("Disconnecting unreachable art-chat recipient")
                return False
        if sockets:
            results=await asyncio.gather(*(send_one(socket) for socket in sockets))
            for socket,ok in zip(sockets,results):
                if not ok and not socket.closed:
                    # Fire-and-forget close: never delay everyone else's strokes.
                    asyncio.create_task(socket.close(code=1011,message=b'slow recipient'))


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
                 'layers':[new_layer('base','レイヤー 1')], 'layerSeq':1,
                 'fillLast':{}, 'identities':{},
                 'created':time.time()}
    ROOM_STORE.mark("art", ROOMS[code])
    return code,token


async def create(request):
    code,key=new_room()
    audit_art(request, ROOMS[code], "作成者（入室前）", "echa_create")
    return web.json_response({'code':code,'ownerKey':key,'width':WIDTH,'height':HEIGHT},
                             headers={'Cache-Control':'no-store'})


async def route_ws(request):
    # Art-chat can rasterize large fills on mobile devices; leave time
    # for their browser to answer protocol pings while app pings arrive.
    ws=web.WebSocketResponse(heartbeat=60,max_msg_size=250000)
    await ws.prepare(request)
    room=None
    player_id=None
    name=''
    last_manual_save_check=0.0
    try:
        async for msg in ws:
            if msg.type!=web.WSMsgType.TEXT:
                continue
            action=None
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
                    if not room and ROOM_STORE.enabled:
                        # Startup loads only a bounded number of rooms. Before
                        # declaring an old art link lost, look up its snapshot
                        # directly from Neon; it may still be safely recoverable.
                        async with RESTORE_LOCK:
                            room=ROOMS.get(code)
                            if not room:
                                try:
                                    room=await ROOM_STORE.load_art_by_code(code)
                                except Exception as exc:
                                    LOGGER.exception("Art room lookup failed")
                                    raise ValueError(
                                        '保存先の確認中にエラーが発生しました。時間をおいて再接続してください'
                                    ) from exc
                                if room:
                                    ROOMS[code]=room
                    if not room:
                        raise ValueError(
                            '部屋が見つかりません。保存期限切れ、または再起動によって'
                            'データが失われた可能性があります'
                        )
                    name=str(data.get('name','')).strip()[:24]
                    if not name:
                        raise ValueError('ニックネームを入力してください')
                    key=data.get('ownerKey','')
                    has_owner_key=isinstance(key,str) and secrets.compare_digest(key,room['ownerKey'])
                    candidate=data.get('resumeToken')
                    if not isinstance(candidate,str) or len(candidate)>100:
                        candidate=''
                    identity=room['identities'].get(candidate)
                    is_reconnect = bool(identity)
                    if identity:
                        player_id=identity['id']
                        # A reconnect never consumes an extra seat or loses the
                        # ability to undo earlier strokes. Disconnect an old tab
                        # with the same credential without revoking its identity.
                        for previous, member in list(room['members'].items()):
                            if member['id']==player_id and previous is not ws:
                                room['members'].pop(previous,None)
                                if player_id in room['drawing']:
                                    unfinished=room['drawing'].pop(player_id)
                                    room['strokes'].append(unfinished)
                                    room['version']+=1
                                    await notify(room,{'type':'end','stroke':unfinished,'version':room['version']})
                                await previous.close(code=1000,message=b'replaced')
                        identity['name']=name
                        identity['owner']=identity['owner'] or has_owner_key
                        resume_token=candidate
                    else:
                        if len(room['members'])>=MAX_USERS:
                            raise ValueError('部屋は12人までです')
                        if len(room['identities'])>=60:
                            raise ValueError('参加履歴がいっぱいです。新しい部屋を作成してください')
                        player_id=secrets.token_urlsafe(9)
                        identity={'id':player_id,'name':name,
                                  'color':'#'+secrets.token_hex(3),'owner':has_owner_key}
                        resume_token=secrets.token_urlsafe(24)
                        room['identities'][resume_token]=identity
                    room['members'][ws]=identity
                    room['last']=time.time()
                    await ws.send_json({'type':'snapshot','code':code,'me':player_id,
                        'resumeToken':resume_token,'owner':identity['owner'],
                        'width':WIDTH,'height':HEIGHT,
                        'members':public_members(room),'strokes':room['strokes'],
                        'layers':room['layers'], 'maxLayers':MAX_LAYERS,
                        'drawing':list(room['drawing'].values()),'messages':room['messages'],
                        'version':room['version'],
                        'restoredAt':room.get('_restoredAt'),
                        'retentionHours':ART_RETENTION_HOURS if ROOM_STORE.enabled else 6,
                        'persistence':ROOM_STORE.status})
                    await notify(room,{'type':'members','members':public_members(room)})
                    # Record a join only after the participant received the room.
                    # A reconnect isn't a new person; do not log the resume token.
                    audit_art(request, room, name,
                              "echa_rejoin" if is_reconnect else "echa_join")
                    continue
                room['last']=time.time()
                member=room['members'][ws]
                if action=='ping':
                    if room['last']-room.get('_heartbeatSavedAt',0)>600:
                        room['_heartbeatSavedAt']=room['last']
                        ROOM_STORE.mark("art", room)
                    await ws.send_json({'type':'pong','at':time.time()})
                elif action=='save_now':
                    if not ROOM_STORE.enabled:
                        await ws.send_json({'type':'save_status','ok':False,
                            'message':'クラウド保存が無効です。大切な絵はPNG保存してください。'})
                        continue
                    current=time.monotonic()
                    if current-last_manual_save_check<10:
                        await ws.send_json({'type':'save_status','ok':False,
                            'message':'連続した保存確認は10秒ほど間を空けてください。'})
                        continue
                    last_manual_save_check=current
                    saved_at=await ROOM_STORE.save_and_confirm('art',room)
                    if saved_at is None:
                        await ws.send_json({'type':'save_status','ok':False,
                            'message':'保存完了を確認できませんでした。PNG保存もご利用ください。'})
                    else:
                        await ws.send_json({'type':'save_status','ok':True,
                            'at':saved_at,'message':'クラウドへの保存が完了しました。'})
                elif action=='begin':
                    if player_id in room['drawing']:
                        raise ValueError('すでに描画中です')
                    point=clean_point(data.get('point'))
                    props=style_of(data)
                    layer_id=data.get('layer','base')
                    layer=next((x for x in room['layers'] if x['id']==layer_id),None)
                    if not layer or not layer['visible']:
                        raise ValueError('表示中のレイヤーを選択してください')
                    # Echo a per-client stroke sequence on completion so a
                    # late acknowledgement cannot clear the NEXT live stroke.
                    seq=data.get('clientSerial')
                    if type(seq) is not int or not 1<=seq<=2_147_483_647:
                        seq=None
                    room['drawing'][player_id]={'id':secrets.token_urlsafe(9),
                        'layer':layer_id, 'clientSerial':seq,
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
                elif action=='cancel':
                    # A second touch means pinch/zoom, not an unfinished brush mark.
                    cancelled=room['drawing'].pop(player_id,None)
                    if cancelled is not None:
                        await notify(room,{'type':'cancel','by':player_id,
                                           'clientSerial':cancelled.get('clientSerial')})
                elif action=='end':
                    stroke=room['drawing'].pop(player_id,None)
                    if stroke:
                        # A completed stroke is the atomic unit of history.
                        room['strokes'].append(stroke)
                        room['version']+=1
                        await notify(room,{'type':'end','stroke':stroke,'version':room['version']})
                elif action=='fill':
                    # Bucket fills are atomic history entries, like completed
                    # pen strokes. Every viewer replays the same bounded seed
                    # and tolerance, so undo, PNG and timelapse stay in sync.
                    if player_id in room['drawing']:
                        raise ValueError('線を描き終えてから塗りつぶしてください')
                    point=clean_point(data.get('point'))
                    props=style_of({**data,'tool':'pen','width':1})
                    tolerance=data.get('tolerance',15)
                    reference=data.get('reference','all')
                    layer_id=data.get('layer','base')
                    if type(tolerance) is not int or not 0<=tolerance<=100:
                        raise ValueError('許容値は0〜100の整数で指定してください')
                    if reference not in ('all','layer'):
                        raise ValueError('参照モードが不正です')
                    layer=next((x for x in room['layers'] if x['id']==layer_id),None)
                    if not layer or not layer['visible']:
                        raise ValueError('表示中のレイヤーを選択してください')
                    now=time.time()
                    if now-room['fillLast'].get(player_id,0)<FILL_COOLDOWN:
                        raise ValueError('連続した塗りつぶしは少し間を空けてください')
                    room['fillLast'][player_id]=now
                    item={'id':secrets.token_urlsafe(9),'by':player_id,'name':name,
                          'layer':layer_id,'tool':'fill','point':point,
                          'reference':reference,'tolerance':tolerance,
                          'color':props['color'],'opacity':props['opacity'],
                          'ts':now}
                    room['strokes'].append(item)
                    room['version']+=1
                    await notify(room,{'type':'end','stroke':item,'version':room['version']})
                    audit_art(request, room, name, "echa_fill")
                elif action=='layer_op':
                    change=change_layer(room,member,data)
                    room['version']+=1
                    payload={'type':'layers','layers':room['layers'],
                             'version':room['version'],**change}
                    if 'deleted' in change:
                        payload['strokes']=room['strokes']
                        payload['drawing']=list(room['drawing'].values())
                    await notify(room,payload)
                    audit_art(request, room, name, "echa_layer", str(data.get("op",""))[:16])
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
                    audit_art(request, room, name, "echa_clear")
                elif action=='chat':
                    value=data.get('text')
                    if not isinstance(value,str) or not 1<=len(value.strip())<=280:
                        raise ValueError('チャットは1〜280文字です')
                    item={'id':secrets.token_urlsafe(6),'name':name,'by':player_id,
                          'text':value.strip(),'ts':time.time()}
                    room['messages'].append(item)
                    room['messages']=room['messages'][-MAX_MESSAGES:]
                    await notify(room,{'type':'chat','item':item})
                    audit_art(request, room, name, "echa_chat")
                elif action=='sync':
                    await ws.send_json({'type':'sync','strokes':room['strokes'],
                                        'drawing':list(room['drawing'].values()),
                                        'layers':room['layers'],'version':room['version']})
                else:
                    raise ValueError('不明な操作です')
            except (ValueError,TypeError,KeyError,json.JSONDecodeError) as exc:
                if room and ws not in room['members']:
                    room=None
                if not ws.closed:
                    await ws.send_json({'type':'error','message':str(exc)[:130],
                                        'action':str(action)[:24] if isinstance(action,str) else ''})
            except Exception:
                LOGGER.exception("Unexpected art-chat event failure")
                if room and ws not in room['members']:
                    room=None
                if not ws.closed:
                    await ws.send_json({'type':'error','code':'internal',
                                        'message':'描画データの処理エラーです。再接続をお試しください'})
    except (ConnectionError, OSError):
        LOGGER.info("Art-chat connection interrupted")
    except Exception:
        LOGGER.exception("Unexpected art-chat socket failure")
    finally:
        if room and ws in room['members']:
            del room['members'][ws]
            audit_art(request, room, name, "echa_disconnect")
            if player_id in room['drawing']:
                # Preserve a disconnected user's completed portion of the stroke.
                stroke=room['drawing'].pop(player_id)
                room['strokes'].append(stroke)
                room['version']+=1
                await notify(room,{'type':'end','stroke':stroke,'version':room['version']})
            room['last']=time.time()
            await notify(room,{'type':'members','members':public_members(room)})
    return ws


async def shutdown_art_sockets(app):
    sockets={ws for room in ROOMS.values() for ws in room['members'] if not ws.closed}
    async def close_one(socket):
        try:
            await asyncio.wait_for(socket.send_json({'type':'server_restart'}), 2)
            await asyncio.wait_for(socket.close(code=1012, message=b'service restart'), 3)
        except (asyncio.TimeoutError, RuntimeError, ConnectionError, OSError):
            pass
    if sockets:
        await asyncio.gather(*(close_one(socket) for socket in sockets))


def register(app):
    app.add_routes([web.post('/api/echa/create',create),
                    web.get('/api/echa/ws',route_ws)])
    app.on_shutdown.append(shutdown_art_sockets)
