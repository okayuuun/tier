"""Original party modes: number-clue co-op, word-card proposals, lateral-thinking puzzles.
Gameplay inspirations from ito (Arclight), ClaGla's proposal game, lateral thinking puzzle conventions.
All prompt/card contents are original, not copied from commercial decks.
"""
import json
import secrets
from pathlib import Path

DATA = json.loads((Path(__file__).parent / 'party_data.json').read_text(encoding='utf-8'))
GAME_IDS = {'ito', 'propose', 'soup'}
EVENTS = {
    'ito_clue', 'ito_play', 'ito_next', 'ito_redraw',
    'prop_submit', 'prop_show', 'prop_pick', 'prop_next',
    'soup_ask', 'soup_solve', 'soup_reply', 'soup_hint', 'soup_resolve', 'soup_next'
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
    p.update(narrator=room['active'][p['round'] % len(room['active'])], puzzleIndex=r, entries=[], visibleHints=0, last=None)
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
        {'id':x['id'],'name':x['name'],'online':bool(x['ws'] and not x['ws'].closed),'score':room['points'].get(x['id'],0)}
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
    elif game=='propose':
        out.update(round=p['round'],roundLimit=p['roundLimit'],judge=p['judge'],rings=p['rings'],
                   hand=p['hands'].get(pid,[]) if phase=='prop_compose' else [],
                   starters=DATA['proposalStarters'] if phase=='prop_compose' and pid != p['judge'] else [],
                   submitted=pid in p['messages'],
                   submittedCount=len(p['messages']),
                   entries=([{'pid':x,'name':room['players'].get(x,{}).get('name','参加者'),'text':v} for x,v in p['messages'].items()]
                            if phase in ('prop_judge','prop_reveal','final') else []),
                   last=p['last'] if phase in ('prop_reveal','final') else None,
                   history=p['history'] if phase=='final' else [])
    elif game=='soup':
        r=DATA['soup'][p['puzzleIndex']]
        out.update(round=p['round'],roundLimit=p['roundLimit'],narrator=p['narrator'],
                   title=r['title'],situation=r['situation'],difficulty=r['difficulty'],
                   hints=r['hints'][:p['visibleHints']],entries=p['entries'][-85:],
                   solution=r['solution'] if phase in ('soup_reveal','final') or pid==p['narrator'] else None,
                   secretHints=r['hints'] if pid==p['narrator'] else None,
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
    elif room['game']=='propose':
        judge=p['judge']
        if typ=='prop_submit':
            if phase!='prop_compose' or pid==judge or pid in p['messages']:
                raise ValueError('今はプロポーズを提出できません')
            indexes=obj.get('indexes')
            if not isinstance(indexes,list) or not 1<=len(indexes)<=12 or not all(type(i)==int and 0<=i<12 for i in indexes) or len(set(indexes))!=len(indexes):
                raise ValueError('配られた単語を最大12枚まで並べてください')
            hand=DATA['proposalStarters'] + p['hands'][pid]
            p['messages'][pid]=''.join(hand[i] if i>=6 or hand[i] in ('だから','ずっと','お願い') else hand[i] for i in indexes)
            # Delimit terms to keep Japanese word-card phrases readable.
            p['messages'][pid]=' '.join(hand[i] for i in indexes) + '。'
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
        if typ in ('soup_ask','soup_solve'):
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
        elif typ=='soup_hint':
            if phase!='soup_ask' or pid!=narrator:raise ValueError('ヒントを出せるのは出題者です')
            p['visibleHints']=min(2,p['visibleHints']+1)
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
            q=DATA['soup'][p['puzzleIndex']]
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