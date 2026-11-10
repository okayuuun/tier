"""Five original realtime card/word games. All cards, scoring and secrets are server-owned.
Inspired by well-known board-game mechanisms; no official assets/decks are copied.
"""
import secrets
import random
import re
import unicodedata

GAME_IDS={'royalletter','cipherrelay','skyfire','scoutline','aiuebattle'}
EVENTS={'rl_play','rl_next','dc_clue','dc_guess','dc_next','dc_skip',
        'hf_hint','hf_play','hf_discard','sc_play','sc_scout','sc_skip','sc_next',
        'ai_theme','ai_write','ai_attack','ai_next'}
LIMITS={'royalletter':(2,6),'cipherrelay':(4,12),'skyfire':(2,5),
        'scoutline':(2,6),'aiuebattle':(2,5)}
RNG=random.SystemRandom()
KEYWORDS=['りんご','とけい','すいぞくかん','りょこう','かさ','ぴあの','きょうりゅう',
 'えいが','ほし','がっこう','ふうせん','こうえん','うちゅう','きつね',
 'すずめ','ひみつ','ほん','ひこうき','けーき','りぼん','あおぞら',
 'みず','こおり','しんぶん','きのこ','とら','かがみ','じてんしゃ',
 'うみ','みらい','おんがく','はなび','こおり','だんご','ぺんぎん',
 'まくら','せんせい','でんしゃ','おかし','かんらんしゃ','はこ','みかん',
 'めがね','てがみ','こーひー','あめ','はさみ','ゆめ','おばけ',
 'ちきゅう','てぶくろ','にんじゃ','おてら','りんごあめ','ふね',
 'すし','しろ','どーなつ','あさ','よる','みち','ひよこ','きゃんぷ']
AI_THEMES=['食べ物','動物','学校にあるもの','旅行で行きたいところ','赤いもの',
           'お祭りで見かけるもの','ゲームに出てきそうなもの','冬といえば','乗り物',
           'スーパーに売っているもの','空を飛ぶもの','スポーツ','お菓子']
KANA='あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんー'
SMALL=str.maketrans('ぁぃぅぇぉゃゅょっゎ','あいうえおやゆよつわ')
LETTERS={1:'ふせん',2:'うわさ',3:'みくらべ',4:'まもり',5:'いれかえ',6:'くずし',7:'つよい',8:'ひめ'}
# All role/card names, rankings, distributions, and values are original for this app.

def validate_count(game,count):
    lo,hi=LIMITS[game]
    if not lo<=count<=hi:raise ValueError(f'このゲームは{lo}〜{hi}人用です')

def ids(room):return room['active']
def player_name(room,pid):return room['players'].get(pid,{}).get('name','参加者')
def room_players(room):
    return [{'id':pid,'name':p['name'],'online':bool(p['ws'] and not p['ws'].closed),
             'score':room['points'].get(pid,0),'avatar':p.get('avatar',''),'emoji':p.get('emoji','🌷')}
            for pid,p in room['players'].items()]
def advance(seq,cur):
    return seq[(seq.index(cur)+1)%len(seq)]

def start(room):
    g=room['game'];validate_count(g,len(ids(room)))
    p={'round':0,'roundLimit':3,'last':None,'history':[]}
    room['boardplus']=p
    if g=='royalletter':royal_new(room)
    elif g=='cipherrelay':
        p.update(roundLimit=6,teams={pid:'red' if i%2==0 else 'blue' for i,pid in enumerate(ids(room))},
            teamScores={'red':0,'blue':0},keys={'red':RNG.sample(KEYWORDS,4),'blue':RNG.sample(KEYWORDS,4)})
        cipher_new(room)
    elif g=='skyfire':
        p.update(roundLimit=1,progress={'紅':0,'蒼':0,'翠':0},lives=3,hints=6,turn=ids(room)[0],
                 turns=0,trash=[],played=[],hands={},deck=[])
        deck=[{'c':c,'n':n} for c in p['progress'] for n,copies in ((1,3),(2,2),(3,2),(4,1))
              for _ in range(copies)]
        RNG.shuffle(deck);p['deck']=deck
        for pid in ids(room):p['hands'][pid]=[deal(p) for _ in range(4)]
        room['phase']='bp_fire'
    elif g=='scoutline':
        p.update(roundLimit=3)
        scout_new(room)
    elif g=='aiuebattle':
        p.update(roundLimit=3,theme=RNG.choice(AI_THEMES))
        ai_new(room)

def royal_new(room):
    p=room['boardplus']
    # 18 original numeric cards (rare 8, many low cards).
    deck=[1]*5+[2]*3+[3]*2+[4]*2+[5]*2+[6]*2+[7,8]
    RNG.shuffle(deck)
    p.update(deck=deck,hands={pid:deck.pop() for pid in ids(room)},
             drawn=None,discards=[],gone=[],safe=[],turn=ids(room)[p['round']%len(ids(room))],last=None)
    p['drawn']=deck.pop() if deck else None
    room['phase']='bp_royal'

def royal_alive(room):
    p=room['boardplus'];return [x for x in ids(room) if x not in p['gone']]

def royal_end(room):
    p=room['boardplus'];live=royal_alive(room)
    if not live:live=ids(room)
    high=max(p['hands'][x] for x in live)
    winners=[x for x in live if p['hands'][x]==high]
    for pid in winners:room['points'][pid]+=2
    result={'winners':winners,'winnerNames':[player_name(room,x) for x in winners],
            'hands':{x:p['hands'][x] for x in ids(room)},'discards':p['discards'][:]}
    p['last']=result;p['history'].append(result)
    room['phase']='bp_royal_reveal'

def royal_next_turn(room):
    p=room['boardplus']
    if len(royal_alive(room))<=1 or not p['deck']:
        royal_end(room);return
    current=p['turn'];p['safe']=[]
    remaining=royal_alive(room)
    order=ids(room);start=order.index(current)
    p['turn']=next(x for x in order[start+1:]+order[:start] if x in remaining)
    p['drawn']=p['deck'].pop()
    room['phase']='bp_royal'

def cipher_new(room):
    p=room['boardplus']
    team='red' if p['round']%2==0 else 'blue'
    team_pids=[pid for pid in ids(room) if p['teams'][pid]==team]
    other=[pid for pid in ids(room) if p['teams'][pid]!=team]
    turn_no=p['round']//2
    clue_giver=team_pids[turn_no%len(team_pids)]
    guesser=advance(team_pids,clue_giver)
    # The opposing team's designated interceptor rotates separately.
    interceptor=other[turn_no%len(other)]
    p.update(team=team,clueGiver=clue_giver,guesser=guesser,interceptor=interceptor,
        code=RNG.sample([1,2,3,4],3),clues=[],guesses={},last=None)
    room['phase']='bp_cipher_clue'

def cipher_reveal(room):
    p=room['boardplus'];own=p['team'];op='blue' if own=='red' else 'red'
    same=p['guesses'].get('own')==p['code']
    steal=p['guesses'].get('intercept')==p['code']
    if same:p['teamScores'][own]+=1
    if steal:p['teamScores'][op]+=2
    result={'team':own,'code':p['code'][:],'clues':p['clues'][:],
            'ownGuess':p['guesses'].get('own'),'interceptGuess':p['guesses'].get('intercept'),
            'ownCorrect':same,'interceptCorrect':steal,'teamScores':p['teamScores'].copy()}
    p['last']=result;p['history'].append(result)
    room['phase']='bp_cipher_reveal'

def deal(p):
    if not p['deck']:return None
    card=p['deck'].pop()
    return {'c':card['c'],'n':card['n'],'knownC':False,'knownN':False}

def fire_advance(room):
    p=room['boardplus'];p['turns']+=1
    if p['lives']<=0 or all(n==4 for n in p['progress'].values()) or p['turns']>=60 or (
        not p['deck'] and not any(p['hands'].values())):
        p['last']={'progress':p['progress'].copy(),'lives':p['lives'],
                   'total':sum(p['progress'].values()),'played':p['played'][-18:]}
        room['phase']='final'
        for pid in ids(room):room['points'][pid]=sum(p['progress'].values())
    else:p['turn']=advance(ids(room),p['turn'])

def scout_new(room):
    p=room['boardplus']
    cards=[n for n in range(1,11) for _ in range(8)]
    RNG.shuffle(cards)
    p.update(hands={pid:[cards.pop() for _ in range(7)] for pid in ids(room)},field=[],
             lastPlayer=None,turn=ids(room)[p['round']%len(ids(room))],turns=0,
             scouted={pid:0 for pid in ids(room)},last=None)
    room['phase']='bp_scout'

def valid_run(cards):
    if not 1<=len(cards)<=4:return False
    if len(cards)==1:return True
    return len(set(cards))==1 or all(abs(cards[i]-cards[i-1])==1 for i in range(1,len(cards))) and (
        all(cards[i]>cards[i-1] for i in range(1,len(cards))) or
        all(cards[i]<cards[i-1] for i in range(1,len(cards))))

def scout_end(room):
    p=room['boardplus'];winner=max(ids(room),key=lambda x:(room['points'][x],-len(p['hands'][x])))
    result={'winner':winner,'winnerName':player_name(room,winner),
            'remaining':{x:len(p['hands'][x]) for x in ids(room)},'field':p['field'][:]}
    p['last']=result;p['history'].append(result);room['phase']='bp_scout_reveal'

def scout_turn(room):
    p=room['boardplus'];p['turns']+=1
    if p['turns']>=45 or any(len(p['hands'][x])==0 for x in ids(room)):
        scout_end(room)
    else:p['turn']=advance(ids(room),p['turn'])

def ai_word(raw):
    # Hiragana only; normalize small kana and dakuten without guessing kanji readings.
    raw=unicodedata.normalize('NFD',raw.translate(SMALL))
    word=''.join(ch for ch in raw if unicodedata.category(ch)!='Mn')
    if not 2<=len(word)<=7 or not all(ch in KANA for ch in word):
        raise ValueError('2〜7文字のひらがなで入力してください（濁点・小文字は自動変換）')
    return word

def ai_new(room):
    p=room['boardplus'];p.update(words={},called=[],revealed={},out=[],attacks=[],
        turn=ids(room)[p['round']%len(ids(room))],last=None,theme=RNG.choice(AI_THEMES))
    room['phase']='bp_ai_write'

def ai_finish(room,winner):
    p=room['boardplus']
    room['points'][winner]+=3
    result={'winner':winner,'winnerName':player_name(room,winner),
            'words':p['words'].copy(),'called':p['called'][:],
            'attacks':p['attacks'][-20:]}
    p['last']=result;p['history'].append(result)
    room['phase']='bp_ai_reveal'

def handle(room,pid,event,obj,is_owner):
    if pid not in ids(room):raise ValueError('参加者のみ操作できます')
    p=room['boardplus'];g=room['game'];phase=room['phase']
    if g=='royalletter':
        if event=='rl_play':
            if phase!='bp_royal' or pid!=p['turn']:raise ValueError('自分の手番です')
            chosen=obj.get('card')
            if type(chosen)!=int or chosen not in [p['hands'][pid],p['drawn']]:
                raise ValueError('手札のカードを選択してください')
            if chosen==1 and target in royal_alive(room) and target!=pid and target not in p['safe']:
                guess=obj.get('guess')
                if type(guess)!=int or not 1<=guess<=8:
                    raise ValueError('予想は1〜8です')
            # Card 8 is removed from the round if voluntarily played.
            hand=[p['hands'][pid],p['drawn']]
            hand.remove(chosen);p['hands'][pid]=hand[0]
            target=obj.get('target')
            if target not in royal_alive(room) or target==pid:target=None
            p['discards'].append({'by':pid,'card':chosen,'target':target})
            if chosen==8:p['gone'].append(pid)
            elif target and target not in p['safe']:
                if chosen==1:
                    guess=obj.get('guess')
                    if type(guess)!=int or not 1<=guess<=8:raise ValueError('予想は1〜8です')
                    if p['hands'][target]==guess:p['gone'].append(target)
                elif chosen==3:
                    a,b=p['hands'][pid],p['hands'][target]
                    if a<b:p['gone'].append(pid)
                    elif a>b:p['gone'].append(target)
                elif chosen==5:
                    p['hands'][pid],p['hands'][target]=p['hands'][target],p['hands'][pid]
                elif chosen==6:
                    p['discards'].append({'by':target,'card':p['hands'][target],'target':None})
                    if p['hands'][target]==8:p['gone'].append(target)
                    else:p['hands'][target]=p['deck'].pop() if p['deck'] else p['hands'][target]
            if chosen==4:p['safe'].append(pid)
            royal_next_turn(room)
        elif event=='rl_next':
            if not is_owner or phase!='bp_royal_reveal':raise ValueError('結果発表後に主催者が進行します')
            p['round']+=1
            if p['round']>=p['roundLimit']:room['phase']='final'
            else:royal_new(room)
        else:raise ValueError('使用できない操作です')
    elif g=='cipherrelay':
        if event=='dc_clue':
            if phase!='bp_cipher_clue' or pid!=p['clueGiver']:raise ValueError('ヒント係だけが送信できます')
            words=obj.get('words')
            if not isinstance(words,list) or len(words)!=3 or any(not isinstance(w,str) or not 1<=len(w.strip())<=25 for w in words):
                raise ValueError('短いヒントを3語入力してください')
            p['clues']=[w.strip() for w in words]
            room['phase']='bp_cipher_guess'
        elif event=='dc_guess':
            if phase!='bp_cipher_guess':raise ValueError('推理できる時間ではありません')
            role='own' if pid==p['guesser'] else 'intercept' if pid==p['interceptor'] else None
            if not role or role in p['guesses']:raise ValueError('今回の推理担当ではありません')
            numbers=obj.get('numbers')
            if not isinstance(numbers,list) or len(numbers)!=3 or any(type(x)!=int or not 1<=x<=4 for x in numbers) or len(set(numbers))!=3:
                raise ValueError('1〜4の異なる数字を3つ指定してください')
            p['guesses'][role]=numbers[:]
            if len(p['guesses'])>=2:cipher_reveal(room)
        elif event=='dc_skip':
            if not is_owner or phase not in ('bp_cipher_clue','bp_cipher_guess'):raise ValueError('主催者だけが進行できます')
            if phase=='bp_cipher_clue':p['clues']=['ヒントなし']*3;room['phase']='bp_cipher_guess'
            else:cipher_reveal(room)
        elif event=='dc_next':
            if not is_owner or phase!='bp_cipher_reveal':raise ValueError('主催者だけが次へ進められます')
            p['round']+=1
            if p['round']>=p['roundLimit']:
                room['phase']='final'
                for player,team in p['teams'].items():room['points'][player]=p['teamScores'][team]
            else:cipher_new(room)
        else:raise ValueError('使用できない操作です')
    elif g=='skyfire':
        if phase!='bp_fire' or pid!=p['turn']:raise ValueError('いまはあなたの手番ではありません')
        if event=='hf_hint':
            target=obj.get('target');axis=obj.get('axis');val=obj.get('value')
            if not p['hints'] or target not in ids(room) or target==pid or axis not in ('c','n'):
                raise ValueError('ヒントを出せません')
            if axis=='c' and val not in p['progress']:raise ValueError('色を選択してください')
            if axis=='n' and (type(val)!=int or not 1<=val<=4):raise ValueError('数字は1〜4です')
            matched=[card for card in p['hands'][target] if card[axis]==val]
            if not matched:raise ValueError('該当するカードがないヒントは出せません')
            for card in matched:card['knownC' if axis=='c' else 'knownN']=True
            p['hints']-=1
            p['played'].append({'by':pid,'event':'hint','target':target,'axis':axis,'value':val})
        elif event in ('hf_play','hf_discard'):
            idx=obj.get('index');hand=p['hands'][pid]
            if type(idx)!=int or not 0<=idx<len(hand):raise ValueError('カードを選択してください')
            card=hand.pop(idx)
            if event=='hf_play':
                if card['n']==p['progress'][card['c']]+1:
                    p['progress'][card['c']]+=1
                else:p['lives']-=1
            else:p['hints']=min(6,p['hints']+1)
            p['played'].append({'by':pid,'event':event,'c':card['c'],'n':card['n']})
            nxt=deal(p)
            if nxt:hand.append(nxt)
        else:raise ValueError('使用できない操作です')
        fire_advance(room)
    elif g=='scoutline':
        if event=='sc_next':
            if not is_owner or phase!='bp_scout_reveal':
                raise ValueError('主催者が結果画面から進められます')
            p['round']+=1
            if p['round']>=p['roundLimit']:room['phase']='final'
            else:scout_new(room)
            return
        if phase!='bp_scout' or pid!=p['turn']:raise ValueError('自分の手番ではありません')
        if event=='sc_play':
            idx=obj.get('start');length=obj.get('length');hand=p['hands'][pid]
            if type(idx)!=int or type(length)!=int or not 0<=idx<len(hand) or not 1<=length<=4 or idx+length>len(hand):
                raise ValueError('連続するカードを選択してください')
            cards=hand[idx:idx+length]
            if not valid_run(cards) or (p['field'] and not (len(cards)>len(p['field']) or
               len(cards)==len(p['field']) and sum(cards)>sum(p['field']))):
                raise ValueError('同じ数字・連番の組を出してください。場より強い組が必要です')
            room['points'][pid]+=len(p['field'])+len(cards)
            del hand[idx:idx+length]
            p['field']=cards;p['lastPlayer']=pid
        elif event=='sc_scout':
            index=obj.get('index');side=obj.get('side');hand=p['hands'][pid]
            if not p['field'] or p['scouted'][pid]>=3 or type(index)!=int or not 0<=index<len(p['field']) or side not in ('left','right'):
                raise ValueError('スカウトできるカードがありません')
            card=p['field'].pop(index)
            if side=='left':hand.insert(0,card)
            else:hand.append(card)
            p['scouted'][pid]+=1
            room['points'][pid]-=1
        elif event=='sc_skip':
            room['points'][pid]-=1
        else:raise ValueError('使用できない操作です')
        scout_turn(room)
    elif g=='aiuebattle':
        if event=='ai_theme':
            if phase!='bp_ai_write' or not is_owner or p['words']:
                raise ValueError('全員が書き始める前に主催者が決められます')
            text=str(obj.get('theme','')).strip()[:40]
            if not text:raise ValueError('お題を入力してください')
            p['theme']=text
        elif event=='ai_write':
            if phase!='bp_ai_write' or pid in p['words']:raise ValueError('もう回答済みです')
            p['words'][pid]=ai_word(str(obj.get('word','')).strip())
            p['revealed'][pid]=[]
            if len(p['words'])==len(ids(room)):room['phase']='bp_ai_attack'
        elif event=='ai_attack':
            if phase!='bp_ai_attack' or pid!=p['turn']:raise ValueError('今はあなたの攻撃番ではありません')
            letter=str(obj.get('letter',''))
            if len(letter)!=1 or letter not in KANA or letter in p['called']:
                raise ValueError('まだ攻撃していないひらがな1文字を選択してください')
            p['called'].append(letter)
            count=0;knocked=[]
            for who,word in p['words'].items():
                for index,ch in enumerate(word):
                    if ch==letter and index not in p['revealed'][who]:
                        p['revealed'][who].append(index);count+=1
                if who not in p['out'] and len(p['revealed'][who])==len(word):
                    p['out'].append(who);knocked.append(who)
            p['attacks'].append({'by':pid,'letter':letter,'count':count,'out':knocked})
            live=[x for x in ids(room) if x not in p['out']]
            if len(live)<=1 or len(p['called'])==len(KANA):
                winner=live[0] if len(live)==1 else pid if not live else max(live,key=lambda x:len(p['words'][x])-len(p['revealed'][x]))
                ai_finish(room,winner)
            elif count==0 or pid in p['out']:
                p['turn']=advance(live,pid) if pid in live else next((x for x in ids(room)[ids(room).index(pid)+1:]+ids(room)[:ids(room).index(pid)] if x in live),live[0])
        elif event=='ai_next':
            if not is_owner or phase!='bp_ai_reveal':raise ValueError('主催者が次へ進めます')
            p['round']+=1
            if p['round']>=p['roundLimit']:room['phase']='final'
            else:ai_new(room)
        else:raise ValueError('使用できない操作です')
    else:raise ValueError('このゲームには対応していません')

def snapshot(room,pid):
    g=room['game'];p=room['boardplus'];phase=room['phase']
    final=phase=='final'
    data={'round':p['round'],'roundLimit':p['roundLimit'],
          'last':p.get('last'), 'history':p['history'] if final else []}
    if g=='royalletter':
        hand=p['hands'];self_turn=pid==p['turn']
        data.update(turn=p['turn'],hand=hand.get(pid),drawn=p['drawn'] if self_turn else None,
            deckCount=len(p['deck']), gone=p['gone'][:],safe=p['safe'][:],
            discards=p['discards'][:], handCounts={x:1 for x in ids(room)},
            hands=hand.copy() if final or phase=='bp_royal_reveal' else None)
    elif g=='cipherrelay':
        my_team=p['teams'][pid]
        data.update(team=my_team,teams=p['teams'],teamScores=p['teamScores'],
            words=p['keys'][my_team],side=p['team'],clueGiver=p['clueGiver'],
            guesser=p['guesser'],interceptor=p['interceptor'],
            code=p['code'][:] if pid==p['clueGiver'] or phase in ('bp_cipher_reveal','final') else None,
            clues=p['clues'][:],submitted={'own':'own' in p['guesses'],'intercept':'intercept' in p['guesses']},
            guessMine=p['guesses'].get('own' if pid==p['guesser'] else 'intercept' if pid==p['interceptor'] else ''),
            last=p['last'])
    elif g=='skyfire':
        visible={}
        for other,hand in p['hands'].items():
            visible[other]=[
                {'c':c['c'] if other!=pid or c['knownC'] else None,
                 'n':c['n'] if other!=pid or c['knownN'] else None,
                 'hintColor':c['knownC'],'hintNumber':c['knownN']}
                for c in hand]
        data.update(turn=p['turn'],progress=p['progress'],lives=p['lives'],hints=p['hints'],
            deckCount=len(p['deck']),hands=visible,played=p['played'][-16:],turns=p['turns'],
            last=p['last'])
    elif g=='scoutline':
        data.update(turn=p['turn'],myHand=p['hands'][pid][:],
            handCounts={x:len(v) for x,v in p['hands'].items()},field=p['field'][:],
            scouted=p['scouted'],turns=p['turns'],last=p['last'])
    elif g=='aiuebattle':
        data.update(theme=p['theme'],turn=p['turn'],mine=p['words'].get(pid),
            submitted=list(p['words']),called=p['called'][:],out=p['out'][:],
            attacks=p['attacks'][-12:],boards={
                who: {'length':len(word),'letters':[ch if i in p['revealed'][who] or final or phase=='bp_ai_reveal' or who==pid else None
                      for i,ch in enumerate(word)]}
                for who,word in p['words'].items()},last=p['last'])
    return {'type':'state','me':pid,'room':{'code':room['code'],'owner':room['owner'],
        'game':g,'phase':phase,'players':room_players(room),'active':ids(room),
        'matchNo':room['matchNo'],'endedEarly':room['endedEarly'],'boardplus':data}}
