"""Original party modes: number-clue co-op, word-card proposals, lateral-thinking puzzles.
Gameplay inspirations from ito (Arclight), ClaGla's proposal game, lateral thinking puzzle conventions.
All prompt/card contents are original, not copied from commercial decks.
"""
import json
import secrets
import unicodedata
from pathlib import Path

DATA = json.loads((Path(__file__).parent / 'party_data.json').read_text(encoding='utf-8'))
GAME_IDS = {'ito', 'akaito', 'propose', 'soup', 'unique'}
EVENTS = {
    'ito_clue', 'ito_play', 'ito_next', 'ito_redraw',
    'red_clue', 'red_redraw', 'red_offer', 'red_accept', 'red_reject', 'red_next',
    'uniq_answer', 'uniq_next', 'uniq_redraw',
    'prop_submit', 'prop_show', 'prop_pick', 'prop_next',
    'soup_custom', 'soup_ask', 'soup_solve', 'soup_reply', 'soup_hint', 'soup_resolve', 'soup_next', 'soup_reroll', 'soup_reject'
}


def random_topic(previous=None):
    pool = [x for x in DATA['itoThemes'] if x != previous]
    return secrets.choice(pool)


def new_ito_cards(room, stage):
    active = room['active']
    p = room['party']
    p.update(stage=stage, theme=random_topic(p.get('theme')), cards=dict(zip(active, secrets.SystemRandom().sample(range(1, 101), len(active)))),
             clues={}, played=[], remaining=active[:], discarded=[], roundFailed=False)
    room['phase'] = 'ito_clue'




def new_red_round(room):
    p=room['party']
    active=room['active']
    p.update(theme=random_topic(p.get('theme')),
             cards=dict(zip(active, secrets.SystemRandom().sample(range(1,101),len(active)))),
             clues={}, pending=None, remaining=active[:], pairs=[], last=None)
    room['phase']='red_clue'


def new_unique_round(room):
    p=room['party']
    used=set(p['used'])
    candidates=[x for x in DATA['uniqueThemes'] if x not in used]
    if not candidates:
        p['used']=[]
        candidates=DATA['uniqueThemes'][:]
    p['theme']=secrets.choice(candidates)
    p['used'].append(p['theme'])
    p['answers']={}
    room['phase']='uniq_answer'


def conclude_red(room):
    p=room['party']
    p['last']={'round':p['round']+1,'theme':p['theme'],'pairs':p['pairs'][:],
               'unmatched':[{'pid':x,'name':room['players'][x]['name'],'number':p['cards'][x]} for x in p['remaining']],
               'clues':[{'pid':x,'name':room['players'][x]['name'],'text':v} for x,v in p['clues'].items()],
               'numbers':[{'pid':x,'name':room['players'][x]['name'],'number':p['cards'][x]} for x in room['active']]}
    p['history'].append(p['last'])
    p['pending']=None
    room['phase']='red_reveal'


def unique_key(value):
    # Fullwidth spaces and letters normalize; spaces and capitalization don't cause false differences.
    return ''.join(unicodedata.normalize('NFKC',value).casefold().split())

def new_proposal_round(room, first=False):
    p = room['party']
    active = room['active']
    idx = p['round'] % len(active)
    p['judge'] = active[idx]
    p['hands'] = {pid: secrets.SystemRandom().sample(DATA['proposalWords'], 6) for pid in active if pid != p['judge']}
    p['messages'] = {}
    p['last'] = None
    room['phase'] = 'prop_compose'


def new_soup_round(room):
    p = room['party']
    r = p['riddles'][p['round']]
    p.update(narrator=room['active'][p['round'] % len(room['active'])], puzzleIndex=r, entries=[], visibleHints=0, last=None, customRiddle=None)
    room['phase'] = 'soup_ask'


def start_party(room):
    game = room['game']
    active = room['active']
    if len(active) < 2:
        raise ValueError('2人以上が必要です')
    if game == 'ito':
        if len(active) > 10:
            raise ValueError('このモードは最大10人です')
        room['party'] = {'stage': 1, 'maxStages': 3, 'lives': 3, 'theme': None, 'rounds': []}
        new_ito_cards(room, 1)
    elif game == 'akaito':
        if len(active)>10: raise ValueError('赤いitoモードは2〜10人です')
        room['party']={'round':0,'roundLimit':4,'theme':None,'history':[]}
        new_red_round(room)
    elif game == 'unique':
        room['party']={'round':0,'roundLimit':10,'streak':0,'targetStreak':5,'history':[],'used':[]}
        new_unique_round(room)
    elif game == 'propose':
        room['party'] = {'round': 0, 'judge': None, 'rings': {pid:0 for pid in active}, 'roundLimit': min(18, max(6, len(active)*2)), 'history': []}
        new_proposal_round(room, True)
    elif game == 'soup':
        count = min(8, max(3, len(active)))
        indexes = secrets.SystemRandom().sample(range(len(DATA['soup'])), count)
        room['party'] = {'round': 0, 'roundLimit': count, 'riddles': indexes, 'history': [], 'solvedCount': 0}
        new_soup_round(room)
    else:
        raise ValueError('対応していないゲームです')


def party_snapshot(room, pid):
    game, p, phase = room['game'], room['party'], room['phase']
    players = [
        {'id':x['id'],'name':x['name'],'online':bool(x['ws'] and not x['ws'].closed),'score':room['points'].get(x['id'],0), 'avatar':x.get('avatar',''), 'emoji':x.get('emoji','🌷')}
        for x in room['players'].values()
    ]
    sp = {'code':room['code'],'owner':room['owner'],'game':game,'phase':phase,'players':players,
          'active':room['active'],'matchNo':room['matchNo'],'endedEarly':room['endedEarly'], 'party':{}}
    out=sp['party']
    if game=='ito':
        out.update(stage=p['stage'],maxStages=p['maxStages'],lives=p['lives'],theme=p['theme'],
                   myNumber=p['cards'].get(pid) if pid in p['remaining'] or any(z['pid']==pid for z in p['played']) else None,
                   clues=[{'pid':x,'name':room['players'][x]['name'],'text':v} for x,v in p['clues'].items()],
                   clueSubmitted=pid in p['clues'],
                   played=p['played'],remaining=p['remaining'],discarded=p['discarded'],
                   rounds=p['rounds'] if phase=='final' else p['rounds'][-1:] if phase=='ito_review' else [],
                   roundFailed=p['roundFailed'])
    elif game=='akaito':
        out.update(round=p['round'],roundLimit=p['roundLimit'],theme=p['theme'],
                   myNumber=p['cards'].get(pid),clueSubmitted=pid in p['clues'],
                   clues=[{'pid':x,'name':room['players'][x]['name'],'text':v} for x,v in p['clues'].items()],
                   remaining=p['remaining'],pending=p['pending'],pairs=p['pairs'],
                   last=p['last'] if phase in ('red_reveal','final') else None,
                   history=p['history'] if phase=='final' else [])
    elif game=='unique':
        out.update(round=p['round'],roundLimit=p['roundLimit'],streak=p['streak'],targetStreak=p['targetStreak'],
                   theme=p['theme'],submitted=pid in p['answers'],submittedCount=len(p['answers']),
                   last=p.get('last') if phase in ('uniq_reveal','final') else None,
                   history=p['history'] if phase=='final' else [])
    elif game=='propose':
        out.update(round=p['round'],roundLimit=p['roundLimit'],judge=p['judge'],rings=p['rings'],
                   hand=p['hands'].get(pid,[]) if phase=='prop_compose' else [],
                   starters=DATA['proposalBaseCards'] if phase=='prop_compose' and pid != p['judge'] else [],
                   submitted=pid in p['messages'],
                   submittedCount=len(p['messages']),
                   entries=([{'pid':x,'name':room['players'].get(x,{}).get('name','参加者'),'text':v} for x,v in p['messages'].items()]
                            if phase in ('prop_judge','prop_reveal','final') else []),
                   last=p['last'] if phase in ('prop_reveal','final') else None,
                   history=p['history'] if phase=='final' else [])
    elif game=='soup':
        r=p.get('customRiddle') or DATA['soup'][p['puzzleIndex']]
        out.update(round=p['round'],roundLimit=p['roundLimit'],narrator=p['narrator'],
                   title=r['title'],situation=r['situation'],difficulty=r['difficulty'],category=r.get('category','なぞ'),bankCount=len(DATA['soup']),
                   hints=r['hints'][:p['visibleHints']],entries=p['entries'][-85:],
                   solution=r['solution'] if phase in ('soup_reveal','final') or pid==p['narrator'] else None,
                   secretHints=r['hints'] if pid==p['narrator'] else None,
                   hostGuide=r.get('guide',[]) if pid==p['narrator'] else [],
                   hostQA=r.get('qa',[]) if pid==p['narrator'] else [],
                   last=p['last'] if phase in ('soup_reveal','final') else None,
                   history=p['history'] if phase=='final' else [], solvedCount=p['solvedCount'])
    return {'type':'state','me':pid,'room':sp}


def handle_party_event(room,pid,typ,obj,is_owner):
    p, phase = room['party'], room['phase']
    active = room['active']
    if pid not in active:
        raise ValueError('このゲームには参加していません')
    if room['game']=='ito':
        if typ=='ito_redraw':
            if not is_owner or phase!='ito_clue' or p['clues']:
                raise ValueError('全員がヒントを書く前に、主催者が変更できます')
            p['theme']=random_topic(p['theme'])
        elif typ=='ito_clue':
            if phase!='ito_clue': raise ValueError('今はヒントを送れません')
            clue=str(obj.get('text','')).strip()[:100]
            if not clue or any(c.isdigit() for c in clue):
                raise ValueError('ヒントは1〜100などの数字を書かず、言葉で表現してください')
            p['clues'][pid]=clue
            if all(x in p['clues'] for x in active):
                room['phase']='ito_play'
        elif typ=='ito_play':
            if phase!='ito_play' or pid not in p['remaining']:
                raise ValueError('このカードは出せません')
            number=p['cards'][pid]
            missing=[x for x in p['remaining'] if p['cards'][x]<number and x!=pid]
            for x in missing:
                p['discarded'].append({'pid':x,'name':room['players'][x]['name'],'number':p['cards'][x]})
                p['remaining'].remove(x)
            if missing:
                p['lives']=max(0,p['lives']-len(missing))
                p['roundFailed']=True
            p['remaining'].remove(pid)
            p['played'].append({'pid':pid,'name':room['players'][pid]['name'],'number':number,'mistakes':len(missing)})
            if p['lives']==0 or not p['remaining']:
                p['rounds'].append({'stage':p['stage'],'theme':p['theme'],'played':p['played'][:],
                                    'discarded':p['discarded'][:],'lives':p['lives'],'success':p['lives']>0})
                room['phase']='ito_review'
        elif typ=='ito_next':
            if not is_owner or phase!='ito_review':raise ValueError('進行できるのは主催者です')
            if p['lives']==0 or p['stage']>=p['maxStages']:
                room['phase']='final'
            else:
                if len(active)>2:
                    p['lives']=min(3,p['lives']+1)
                new_ito_cards(room,p['stage']+1)
        else: raise ValueError('操作を認識できません')
    elif room['game']=='akaito':
        if typ=='red_redraw':
            if not is_owner or phase!='red_clue' or p['clues']:
                raise ValueError('ヒント提出前に主催者だけがお題を変更できます')
            p['theme']=random_topic(p['theme'])
        elif typ=='red_clue':
            if phase!='red_clue': raise ValueError('今はヒントを送れません')
            clue=str(obj.get('text','')).strip()[:100]
            if not clue or any(c.isdigit() for c in clue):
                raise ValueError('数字を直接書かずに例えてください')
            p['clues'][pid]=clue
            if len(p['clues'])==len(active):room['phase']='red_pair'
        elif typ=='red_offer':
            target=obj.get('target')
            if phase!='red_pair' or pid not in p['remaining'] or target not in p['remaining'] or pid==target or p['pending']:
                raise ValueError('ほかの人が交渉中、またはペアを作れない状態です')
            p['pending']={'from':pid,'to':target}
        elif typ=='red_reject':
            if phase!='red_pair' or not p['pending'] or p['pending']['to']!=pid:
                raise ValueError('あなた宛てのペア申請はありません')
            p['pending']=None
        elif typ=='red_accept':
            if phase!='red_pair' or not p['pending'] or p['pending']['to']!=pid:
                raise ValueError('あなた宛ての申請がありません')
            left=p['pending']['from'];right=pid
            if left not in p['remaining'] or right not in p['remaining']:raise ValueError('すでにペアが決まっています')
            total=p['cards'][left]+p['cards'][right]
            # 100点以下は100に近いほど高い。100ぴったりに特別ボーナス。
            points=(6 if total==100 else min(5,max(1,total//20))) if total<=100 else 0
            for x in (left,right):
                p['remaining'].remove(x)
                room['points'][x]+=points
            p['pairs'].append({'left':left,'right':right,'leftName':room['players'][left]['name'],
                'rightName':room['players'][right]['name'],'a':p['cards'][left],'b':p['cards'][right],
                'total':total,'points':points,'over':total>100})
            p['pending']=None
            if len(p['remaining'])<=1:conclude_red(room)
        elif typ=='red_next':
            if not is_owner or phase!='red_reveal':raise ValueError('主催者が次のラウンドへ進めます')
            if p['round']+1>=p['roundLimit']:room['phase']='final'
            else:
                p['round']+=1
                new_red_round(room)
        else:raise ValueError('操作を認識できません')
    elif room['game']=='unique':
        if typ=='uniq_redraw':
            if not is_owner or phase!='uniq_answer' or p['answers']:
                raise ValueError('回答提出前に主催者だけが変更できます')
            new_unique_round(room)
        elif typ=='uniq_answer':
            if phase!='uniq_answer' or pid in p['answers']:
                raise ValueError('今は回答できません')
            v=str(obj.get('text','')).strip()[:45]
            if not 1<=len(v)<=45:raise ValueError('45文字以内で回答してください')
            p['answers'][pid]=v
            if len(p['answers'])==len(active):
                counts={}
                for text in p['answers'].values():
                    k=unique_key(text)
                    counts[k]=counts.get(k,0)+1
                success=all(n==1 for n in counts.values())
                p['streak']=p['streak']+1 if success else 0
                result={'round':p['round']+1,'theme':p['theme'],'success':success,'streak':p['streak'],
                        'answers':[{'pid':x,'name':room['players'][x]['name'],
                          'text':txt,'duplicate':counts[unique_key(txt)]>1} for x,txt in p['answers'].items()]}
                p['last']=result
                p['history'].append(result)
                room['phase']='uniq_reveal'
        elif typ=='uniq_next':
            if not is_owner or phase!='uniq_reveal':raise ValueError('主催者だけが次へ進めます')
            if p['streak']>=p['targetStreak'] or p['round']+1>=p['roundLimit']:
                room['phase']='final'
            else:
                p['round']+=1
                new_unique_round(room)
        else: raise ValueError('操作を認識できません')
    elif room['game']=='propose':
        judge=p['judge']
        if typ=='prop_submit':
            if phase!='prop_compose' or pid==judge or pid in p['messages']:
                raise ValueError('今はプロポーズを提出できません')
            tokens=obj.get('tokens', obj.get('indexes'))
            if not isinstance(tokens,list) or not 1<=len(tokens)<=12:
                raise ValueError('1〜12枚のカードを並べてください')
            base=DATA['proposalBaseCards']
            hand=p['hands'][pid]
            used=set()
            phrases=[]
            for token in tokens:
                if isinstance(token,int) and not isinstance(token,bool):
                    idx,face,rotation=token,0,0
                elif isinstance(token,dict):
                    idx,face,rotation=token.get('index'),token.get('face',0),token.get('rotation',0)
                else:
                    raise ValueError('カードのデータが不正です')
                if any(type(v) is not int for v in (idx,face,rotation)) or not 0<=idx<12 or idx in used:
                    raise ValueError('同じカードは2回使えません')
                used.add(idx)
                if idx<6:
                    card=base[idx]['faces']
                    if not 0<=face<len(card) or not 0<=rotation<len(card[face]):
                        raise ValueError('カードの向き・面が不正です')
                    phrases.append(card[face][rotation])
                else:
                    if face or rotation:
                        raise ValueError('単語カードは向きを変えられません')
                    phrases.append(hand[idx-6])
            p['messages'][pid]=' '.join(phrases) + '。'
            if len(p['messages'])>=len(active)-1:
                room['phase']='prop_judge'
        elif typ=='prop_show':
            if phase!='prop_compose' or pid!=judge or not p['messages']:
                raise ValueError('全員が書き終わるか、1件以上の提出を待ってください')
            room['phase']='prop_judge'
        elif typ=='prop_pick':
            if phase!='prop_judge' or pid!=judge:raise ValueError('今回の審査役だけが選べます')
            chosen=obj.get('winner')
            if chosen not in p['messages']:raise ValueError('提出された告白から選んでください')
            p['rings'][chosen]+=1
            room['points'][chosen]=p['rings'][chosen]
            p['last']={'round':p['round']+1,'judge':judge,'winner':chosen,'winnerName':room['players'][chosen]['name'],
                       'entries':[{'pid':x,'name':room['players'][x]['name'],'text':v} for x,v in p['messages'].items()]}
            p['history'].append(p['last'])
            room['phase']='prop_reveal'
        elif typ=='prop_next':
            if phase!='prop_reveal' or not is_owner:raise ValueError('次のラウンドは主催者が進めます')
            if max(p['rings'].values())>=3 or p['round']+1 >= p['roundLimit']:
                room['phase']='final'
            else:
                p['round']+=1
                new_proposal_round(room)
        else:raise ValueError('操作を認識できません')
    elif room['game']=='soup':
        narrator=p['narrator']
        if typ=='soup_custom':
            if pid != narrator or phase != 'soup_ask' or p['entries'] or p['visibleHints']:
                raise ValueError('質問前に現在の出題者だけが変更できます')
            raw=obj.get('puzzle')
            if not isinstance(raw,dict): raise ValueError('出題データを確認してください')
            def st(key,maximum):
                v=raw.get(key)
                if not isinstance(v,str) or len(v.strip())<2 or len(v)>maximum: raise ValueError('入力した問題の文字数を確認してください')
                return v.strip()
            title=st('title',90);situation=st('situation',500);solution=st('solution',1500)
            hints=raw.get('hints',[])
            if not isinstance(hints,list) or len(hints)>3 or any(not isinstance(h,str) or len(h)>140 for h in hints):
                raise ValueError('ヒントは140文字以内で3つまでにしてください')
            p['customRiddle']={'title':title,'situation':situation,'solution':solution,
               'hints':[h.strip() for h in hints if h.strip()],'difficulty':3,'category':'自作問題',
               'guide':['独自の問題です。事前に真相と想定される質問を確認してください。'],'qa':[]}
            p['entries']=[];p['visibleHints']=0
        elif typ=='soup_reroll':
            if pid!=narrator or phase!='soup_ask' or p['entries'] or p['visibleHints']:
                raise ValueError('質問が始まる前に、今回の出題者だけが変更できます')
            used=set(p['riddles'][:p['round']])
            previous=p['puzzleIndex']
            candidates=[i for i in range(len(DATA['soup'])) if i not in used and i!=previous]
            difficulty=obj.get('difficulty')
            if type(difficulty) is int and difficulty in (2,3,4,5):
                filtered=[i for i in candidates if DATA['soup'][i]['difficulty']>=difficulty]
                if filtered: candidates=filtered
            if candidates:
                new_id=secrets.choice(candidates)
                p['riddles'][p['round']]=new_id
                new_soup_round(room)
        elif typ in ('soup_ask','soup_solve'):
            if phase!='soup_ask' or pid==narrator:raise ValueError('出題者以外のプレイヤーが質問できます')
            v=str(obj.get('text','')).strip()[:180]
            if len(v)<2 or len(p['entries'])>=90:raise ValueError('質問の文字数や件数を確認してください')
            p['entries'].append({'id':len(p['entries']),'pid':pid,'name':room['players'][pid]['name'],
                                 'kind':'solve' if typ=='soup_solve' else 'ask','text':v,'verdict':None})
        elif typ=='soup_reply':
            if phase!='soup_ask' or pid!=narrator:raise ValueError('出題者だけが回答できます')
            i=obj.get('id')
            verdict=obj.get('verdict')
            if type(i) is not int or i<0 or i>=len(p['entries']) or p['entries'][i]['kind']!='ask' or verdict not in ('yes','no','irrelevant'):
                raise ValueError('質問への回答を選んでください')
            p['entries'][i]['verdict']=verdict
        elif typ=='soup_reject':
            if phase!='soup_ask' or pid!=narrator:
                raise ValueError('出題者だけが判定できます')
            i=obj.get('id')
            if type(i) is not int or not 0<=i<len(p['entries']) or p['entries'][i]['kind']!='solve':
                raise ValueError('正しい推理を選んでください')
            p['entries'][i]['verdict']='wrong'
        elif typ=='soup_hint':
            if phase!='soup_ask' or pid!=narrator:raise ValueError('ヒントを出せるのは出題者です')
            r=p.get('customRiddle') or DATA['soup'][p['puzzleIndex']]
            p['visibleHints']=min(len(r['hints']),p['visibleHints']+1)
        elif typ=='soup_resolve':
            if phase!='soup_ask' or pid!=narrator:raise ValueError('出題者が真相を公開できます')
            winner=obj.get('winner')
            if winner is not None:
                if type(winner) is not int or winner<0 or winner>=len(p['entries']) or p['entries'][winner]['kind']!='solve':
                    raise ValueError('発表された推理から選んでください')
                solution_player=p['entries'][winner]['pid']
                room['points'][solution_player]+=3
                p['solvedCount']+=1
            else:
                solution_player=None
            q=p.get('customRiddle') or DATA['soup'][p['puzzleIndex']]
            p['last']={'round':p['round']+1,'narrator':narrator,'winner':solution_player,
                       'title':q['title'],'situation':q['situation'],'solution':q['solution'],
                       'entries':[e.copy() for e in p['entries']]}
            p['history'].append(p['last'])
            room['phase']='soup_reveal'
        elif typ=='soup_next':
            if phase!='soup_reveal' or not is_owner:raise ValueError('主催者が次の問題へ進めます')
            if p['round']+1>=p['roundLimit']:
                room['phase']='final'
            else:
                p['round']+=1
                new_soup_round(room)
        else:raise ValueError('操作を認識できません')
