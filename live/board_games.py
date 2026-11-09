"""Five independent online party-board-game adaptations.

Original Japanese prompts and independent streamlined rules; no publisher
assets, copyrighted card decks or official branding are included.
All secret information is filtered by snapshot() for the recipient.
"""
import secrets
import unicodedata
from collections import Counter

GAME_IDS = {'oneword', 'spectrum', 'quiet', 'bluff', 'wordagents'}
MIN_PLAYERS = {'oneword': 3, 'spectrum': 3, 'quiet': 2, 'bluff': 2, 'wordagents': 4}
MAX_PLAYERS = {'oneword': 12, 'spectrum': 12, 'quiet': 10, 'bluff': 8, 'wordagents': 12}
EVENTS = {'bg_hint','bg_answer','bg_skip','bg_next','sp_clue','sp_guess','sp_next','sp_force',
          'qt_play','qt_next','bl_place','bl_bid','bl_pass','bl_flip','bl_next',
          'wa_clue','wa_pick','wa_pass'}

WORDS = [
 '風船','図書館','電車','アイス','キャンプ','水族館','自転車','虹','帽子','秘密','宝箱','噴水',
 '宇宙','給食','パズル','傘','恐竜','雪だるま','チケット','魔法','カレー','海賊','公園',
 '望遠鏡','誕生日','みかん','映画館','鍵','ロボット','月','キャンドル','迷路','花火',
 '金魚','灯台','おにぎり','チョコ','忍者','ピアノ','砂漠','飛行機','水筒','商店街',
 '遊園地','ドーナツ','ジャングル','折り紙','風鈴','階段','探偵','きのこ','星座',
 '氷','写真','ゲーム','トンネル','マフラー','植物園','カメラ','時計','地図',
 'カブトムシ','魔女','太陽','バス','郵便','パン','スケート','手紙','花束','船',
 '時計台','キャンディ','トランプ','動物園','ケーキ','タワー','コンサート','馬車',
 'かき氷','夕焼け','雲','りんご','ブランコ','プール','寿司','剣','温泉',
 '雨','バレエ','野球','宇宙船','城','ゲームセンター','掃除','タコ','リモコン',
 '鉛筆','サンドイッチ','山','ペンギン','幽霊','マイク','桜','ドラゴン','川'
]
AXES = [
 ('安い','高い'),('静か','にぎやか'),('こわい','かわいい'),('ひんやり','あたたかい'),
 ('地味','派手'),('子ども向け','大人向け'),('ありふれた','めずらしい'),
 ('家にいたい','外に出たい'),('かんたん','むずかしい'),('まじめ','ふざけている'),
 ('軽い','重い'),('便利','ロマンがある'),('小さい','大きい'),('身近','遠い'),
 ('速い','ゆっくり'),('伝統的','未来的'),('平和','スリル'),('食べにくい','食べやすい'),
 ('安定','冒険'),('日常','特別'),('朝っぽい','夜っぽい'),('夏っぽい','冬っぽい'),
 ('さっぱり','こってり'),('実用的','おしゃれ'),('現実的','夢がある')
]
RNG = secrets.SystemRandom()

def norm(value):
    return ''.join(unicodedata.normalize('NFKC',str(value)).casefold().split())

def name(room, pid):
    return room['players'][pid]['name'] if pid in room['players'] else '参加者'

def active(room):
    return room['active']

def validate_count(game, count):
    if not MIN_PLAYERS[game] <= count <= MAX_PLAYERS[game]:
        raise ValueError(f'このゲームは{MIN_PLAYERS[game]}〜{MAX_PLAYERS[game]}人向けです')

def base(room):
    return dict(round=0,history=[],last=None,roundLimit=5)

def start(room):
    game=room['game'];validate_count(game,len(active(room)))
    p=base(room)
    if game=='oneword':
        p.update(roundLimit=6,words=RNG.sample(WORDS,6),clues={},guesser=None)
        room['board']=p;one_round(room)
    elif game=='spectrum':
        p.update(roundLimit=5,axes=RNG.sample(AXES,5),clue='',guesses={},guide=None)
        room['board']=p;spectrum_round(room)
    elif game=='quiet':
        p.update(stage=1,roundLimit=3,lives=3,hand={},played=[],misses=[])
        room['board']=p;quiet_stage(room)
    elif game=='bluff':
        p.update(roundLimit=6,plants={},bid=0,bidder=None,passed=[],flipped=[],stars={pid:0 for pid in active(room)},
                 wounds={pid:0 for pid in active(room)})
        room['board']=p;bluff_round(room)
    elif game=='wordagents':
        assignments=['red']*6+['blue']*6+['neutral']*3+['trap']
        RNG.shuffle(assignments)
        teams={pid:('red' if i%2==0 else 'blue') for i,pid in enumerate(active(room))}
        captains={team:next(pid for pid in active(room) if teams[pid]==team) for team in ('red','blue')}
        p.update(roundLimit=1,words=RNG.sample(WORDS,16),owners=assignments,revealed=[],
                 teams=teams,captains=captains,turn='red',step='clue',clue='',number=0,left=0,winner=None)
        room['board']=p;room['phase']='wa_play'
    else:
        raise ValueError('未対応のゲームです')

def one_round(room):
    p=room['board'];p['guesser']=active(room)[p['round']%len(active(room))]
    p['clues']={};p['last']=None;room['phase']='bg_hint'

def spectrum_round(room):
    p=room['board'];p['guide']=active(room)[p['round']%len(active(room))]
    p['target']=secrets.randbelow(101);p['clue']='';p['guesses']={}
    p['last']=None;room['phase']='sp_clue'

def quiet_stage(room):
    p=room['board'];count=p['stage']*len(active(room))
    numbers=RNG.sample(range(1,101),count)
    p['hand']={pid:sorted(numbers[i*p['stage']:(i+1)*p['stage']]) for i,pid in enumerate(active(room))}
    p['played']=[];p['misses']=[];p['last']=None;room['phase']='qt_play'

def bluff_round(room):
    p=room['board'];p.update(plants={},bid=0,bidder=None,passed=[],flipped=[],last=None)
    room['phase']='bl_place'

def reveal(room,result):
    p=room['board'];p['last']=result;p['history'].append(result)

def finish_or_next(room):
    p=room['board'];p['round']+=1
    if p['round']>=p['roundLimit']:
        room['phase']='final'
    elif room['game']=='oneword':one_round(room)
    elif room['game']=='spectrum':spectrum_round(room)
    elif room['game']=='bluff':bluff_round(room)

def resolve_one(room,answer):
    p=room['board'];word=p['words'][p['round']]
    freq=Counter(norm(v) for v in p['clues'].values())
    clues=[{'by':pid,'name':name(room,pid),'text':clue,'duplicate':freq[norm(clue)]>1}
           for pid,clue in p['clues'].items()]
    correct=norm(answer)==norm(word)
    if correct:
        for pid in active(room):room['points'][pid]+=1
    reveal(room,{'word':word,'answer':answer,'correct':correct,'clues':clues,'guesser':p['guesser']})
    room['phase']='bg_reveal'

def resolve_spectrum(room):
    p=room['board'];target=p['target'];scored=[]
    for pid,num in p['guesses'].items():
        error=abs(num-target)
        score=3 if error<=5 else 2 if error<=15 else 1 if error<=25 else 0
        room['points'][pid]+=score
        scored.append({'by':pid,'name':name(room,pid),'guess':num,'distance':error,'points':score})
    reveal(room,{'target':target,'clue':p['clue'],'axis':p['axes'][p['round']], 'guesses':scored})
    room['phase']='sp_reveal'

def quiet_progress(room):
    p=room['board']
    if p['lives']<=0:
        reveal(room,{'stage':p['stage'],'success':False,'played':p['played'][:], 'misses':p['misses'][:]})
        room['phase']='final'
    elif all(not hand for hand in p['hand'].values()):
        for pid in active(room):room['points'][pid]+=1
        reveal(room,{'stage':p['stage'],'success':True,'played':p['played'][:],'misses':p['misses'][:]})
        room['phase']='qt_reveal'

def finish_bluff(room,success):
    p=room['board'];bidder=p['bidder']
    if success:p['stars'][bidder]+=1;room['points'][bidder]+=2
    else:p['wounds'][bidder]+=1
    reveal(room,{'success':success,'bid':p['bid'],'bidder':bidder,
                 'cards':[{'by':pid,'name':name(room,pid),'card':card} for pid,card in p['plants'].items()],
                 'flipped':p['flipped'][:],
                 'stars':p['stars'].copy(),'wounds':p['wounds'].copy()})
    room['phase']='bl_reveal'

def maybe_bid_done(room):
    p=room['board']
    if p['bid'] and len(p['passed'])>=len(active(room))-1:
        room['phase']='bl_flip'

def next_team(p):
    p['turn']='blue' if p['turn']=='red' else 'red'
    p['step']='clue';p['clue']='';p['number']=0;p['left']=0

def game_winner(p):
    for team in ('red','blue'):
        if all(i in p['revealed'] for i,owner in enumerate(p['owners']) if owner==team):
            return team
    return None

def handle(room,pid,event,obj,is_owner):
    game=room['game'];p=room['board'];phase=room['phase']
    if pid not in active(room):raise ValueError('参加中の人だけ操作できます')
    if game=='oneword':
        if event=='bg_hint':
            if phase!='bg_hint' or pid==p['guesser'] or pid in p['clues']:
                raise ValueError('ヒントはまだ出せません')
            clue=str(obj.get('text','')).strip()[:35]
            if not clue or len(clue.split())>1 or norm(clue)==norm(p['words'][p['round']]):
                raise ValueError('答えそのものや空のヒントは使えません。短い単語を入力してください')
            p['clues'][pid]=clue
            if len(p['clues'])==len(active(room))-1:room['phase']='bg_guess'
        elif event=='bg_answer':
            if phase!='bg_guess' or pid!=p['guesser']:raise ValueError('今回の回答者だけが答えます')
            resolve_one(room,str(obj.get('text','')).strip()[:60])
        elif event=='bg_skip':
            if not is_owner or phase not in ('bg_hint','bg_guess'):raise ValueError('主催者だけが進められます')
            if phase=='bg_hint':room['phase']='bg_guess'
            else:resolve_one(room,'')
        elif event=='bg_next':
            if not is_owner or phase!='bg_reveal':raise ValueError('主催者だけが次へ進めます')
            finish_or_next(room)
        else:raise ValueError('このゲームでは使えない操作です')
    elif game=='spectrum':
        if event=='sp_clue':
            if phase!='sp_clue' or pid!=p['guide']:raise ValueError('今回のヒント役だけが送れます')
            clue=str(obj.get('text','')).strip()[:70]
            if not clue:raise ValueError('ヒントを入力してください')
            p['clue']=clue;room['phase']='sp_guess'
        elif event=='sp_guess':
            if phase!='sp_guess' or pid==p['guide'] or pid in p['guesses']:
                raise ValueError('今は回答できません')
            n=obj.get('number')
            if type(n)!=int or not 0<=n<=100:raise ValueError('数字は0〜100で指定してください')
            p['guesses'][pid]=n
            if len(p['guesses'])==len(active(room))-1:resolve_spectrum(room)
        elif event=='sp_force':
            if not is_owner or phase not in ('sp_clue','sp_guess'):raise ValueError('主催者が進めてください')
            if phase=='sp_clue':p['clue']='ヒントなし';room['phase']='sp_guess'
            else:resolve_spectrum(room)
        elif event=='sp_next':
            if not is_owner or phase!='sp_reveal':raise ValueError('主催者が次へ進めます')
            finish_or_next(room)
        else:raise ValueError('このゲームでは使えない操作です')
    elif game=='quiet':
        if event=='qt_play':
            if phase!='qt_play':raise ValueError('カードは今出せません')
            n=obj.get('number')
            if type(n)!=int or n not in p['hand'][pid]:raise ValueError('自分のカードだけを出してください')
            all_numbers=[v for hand in p['hand'].values() for v in hand]
            missed=sorted(k for k in all_numbers if k<n)
            for actor,hand in p['hand'].items():
                p['hand'][actor]=[v for v in hand if v==n or v>n]
            p['hand'][pid].remove(n)
            if missed:p['lives']-=1;p['misses'].append({'number':n,'skipped':missed})
            p['played'].append({'number':n,'by':pid,'name':name(room,pid),'skipped':missed})
            quiet_progress(room)
        elif event=='qt_next':
            if not is_owner or phase!='qt_reveal':raise ValueError('主催者が次へ進めます')
            p['stage']+=1
            if p['stage']>p['roundLimit']:room['phase']='final'
            else:quiet_stage(room)
        else:raise ValueError('このゲームでは使えない操作です')
    elif game=='bluff':
        if event=='bl_place':
            if phase!='bl_place' or pid in p['plants']:raise ValueError('今はカードを出せません')
            card=obj.get('card')
            if card not in ('safe','danger'):raise ValueError('カードは花かドクロから選択してください')
            p['plants'][pid]=card
            if len(p['plants'])==len(active(room)):room['phase']='bl_bid'
        elif event=='bl_bid':
            if phase!='bl_bid' or pid in p['passed']:raise ValueError('今は入札できません')
            n=obj.get('number')
            if type(n)!=int or not p['bid']<n<=len(active(room)):
                raise ValueError('現在の入札より大きく、参加人数以下の数字を入力してください')
            p['bid']=n;p['bidder']=pid
            p['passed']=[player for player in p['passed'] if player!=pid]
            if n==len(active(room)):room['phase']='bl_flip'
            else:maybe_bid_done(room)
        elif event=='bl_pass':
            if phase!='bl_bid' or not p['bid'] or pid==p['bidder'] or pid in p['passed']:
                raise ValueError('入札が出てから、最高入札者以外がパスできます')
            p['passed'].append(pid);maybe_bid_done(room)
        elif event=='bl_flip':
            if phase!='bl_flip' or pid!=p['bidder']:raise ValueError('最高入札者がめくってください')
            target=obj.get('target')
            if target not in p['plants'] or target in p['flipped']:raise ValueError('まだめくっていない人を選んでください')
            p['flipped'].append(target)
            if p['plants'][target]=='danger':finish_bluff(room,False)
            elif len(p['flipped'])>=p['bid']:finish_bluff(room,True)
        elif event=='bl_next':
            if not is_owner or phase!='bl_reveal':raise ValueError('主催者が次へ進めます')
            if max(p['stars'].values())>=2:room['phase']='final'
            else:finish_or_next(room)
        else:raise ValueError('このゲームでは使えない操作です')
    elif game=='wordagents':
        if event=='wa_clue':
            if phase!='wa_play' or p['step']!='clue' or p['captains'][p['turn']]!=pid:
                raise ValueError('今のチームのヒント係だけが出せます')
            word=str(obj.get('text','')).strip()[:30]
            count=obj.get('number')
            if not word or any(char.isspace() for char in word) or norm(word) in {norm(w) for w in p['words']}:
                raise ValueError('盤面の単語とは異なる1語のヒントを入力してください')
            if type(count)!=int or not 1<=count<=3:raise ValueError('ヒントの個数は1〜3です')
            p['clue']=word;p['number']=count;p['left']=count;p['step']='guess'
        elif event=='wa_pick':
            if phase!='wa_play' or p['step']!='guess' or p['teams'][pid]!=p['turn'] or pid==p['captains'][p['turn']]:
                raise ValueError('今のチームの回答役だけが選べます')
            idx=obj.get('index')
            if type(idx)!=int or not 0<=idx<len(p['words']) or idx in p['revealed']:
                raise ValueError('未公開のワードを選んでください')
            p['revealed'].append(idx)
            owner=p['owners'][idx]
            if owner=='trap':
                p['winner']='blue' if p['turn']=='red' else 'red'
                for actor,team in p['teams'].items():
                    if team==p['winner']:room['points'][actor]+=5
                room['phase']='final'
            else:
                won=game_winner(p)
                if won:
                    p['winner']=won
                    for actor,team in p['teams'].items():
                        if team==won:room['points'][actor]+=5
                    room['phase']='final'
                elif owner!=p['turn']:
                    next_team(p)
                else:
                    p['left']-=1
                    if p['left']<=0:next_team(p)
        elif event=='wa_pass':
            if phase!='wa_play' or p['step']!='guess' or p['teams'][pid]!=p['turn']:
                raise ValueError('今は手番を終了できません')
            next_team(p)
        else:raise ValueError('このゲームでは使えない操作です')

def snapshot(room,pid):
    g=room['game'];p=room['board'];phase=room['phase']
    audience=phase=='final'
    data={'round':p['round'],'roundLimit':p['roundLimit'],'history':p['history'] if audience else [],
          'last':p['last']}
    if g=='oneword':
        hint_stage=phase=='bg_hint'
        guesser=pid==p['guesser']
        freq=Counter(norm(x) for x in p['clues'].values())
        hints=[{'by':i,'name':name(room,i),
                'text':v if not hint_stage or i==pid or audience else None,
                'duplicate':freq[norm(v)]>1 if not hint_stage or audience else False}
               for i,v in p['clues'].items()]
        data.update(guesser=p['guesser'],word=p['words'][min(p['round'],len(p['words'])-1)] if not guesser or audience else None,
                    clues=hints,count=len(p['clues']),mine=pid in p['clues'])
        if phase=='bg_guess' and not audience:
            data['clues']=[x for x in hints if not x['duplicate']]
    elif g=='spectrum':
        data.update(guide=p['guide'],axis=p['axes'][min(p['round'],len(p['axes'])-1)],clue=p['clue'],
                    target=p['target'] if pid==p['guide'] or phase in ('sp_reveal','final') else None,
                    guessCount=len(p['guesses']),guessed=pid in p['guesses'],
                    myGuess=p['guesses'].get(pid))
    elif g=='quiet':
        data.update(stage=p['stage'],lives=p['lives'],myHand=p['hand'].get(pid,[]) if not audience else [],
                    played=p['played'],misses=p['misses'],
                    remaining=sum(len(x) for x in p['hand'].values()))
    elif g=='bluff':
        data.update(stars=p['stars'],wounds=p['wounds'],bid=p['bid'],bidder=p['bidder'],
                    passed=p['passed'],planted=list(p['plants']),myCard=p['plants'].get(pid),
                    flipped=[{'by':v,'name':name(room,v),'card':p['plants'][v]} for v in p['flipped']],
                    placedCount=len(p['plants']))
    elif g=='wordagents':
        iscaptain=pid in p['captains'].values()
        data.update(words=p['words'],owners=p['owners'] if iscaptain or audience else None,
                    visibleOwners={str(i):p['owners'][i] for i in p['revealed']},
                    revealed=p['revealed'],teams=p['teams'],captains=p['captains'],
                    turn=p['turn'],step=p['step'],clue=p['clue'],number=p['number'],
                    left=p['left'],winner=p['winner'],
                    counts={team:sum(i not in p['revealed'] and owner==team
                                     for i,owner in enumerate(p['owners'])) for team in ('red','blue')})
    players=[{'id':who,'name':entry['name'],
              'online':bool(entry['ws'] and not entry['ws'].closed),
              'score':room['points'].get(who,0),'avatar':entry.get('avatar',''),
              'emoji':entry.get('emoji','🌷')} for who,entry in room['players'].items()]
    return {'type':'state','me':pid,'room':{
        'code':room['code'],'owner':room['owner'],'game':g,'phase':phase,
        'players':players,'active':active(room),'matchNo':room['matchNo'],
        'endedEarly':room['endedEarly'],'board':data}}
