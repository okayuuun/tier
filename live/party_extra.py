"""Additional original realtime minigames; scores and secrets are server authoritative."""
import secrets
import unicodedata
from party_extra_data import UNANIMOUS_THEMES, INSIDER_WORDS, RANK_SETS

EXTRA_IDS={'unanimous','insider','secret_rank'}
EXTRA_EVENTS={'un_answer','un_next','un_redraw','un_force','in_question','in_answer','in_guess','in_vote','in_skip','in_force','in_next','sr_order','sr_guess','sr_force','sr_next'}

def norm(v):
    return ''.join(unicodedata.normalize('NFKC',str(v)).casefold().split())

def name(room,pid):
    return room['players'].get(pid,{}).get('name','参加者')

def draw(pool,used):
    picks=[i for i in range(len(pool)) if i not in used]
    if not picks:
        used.clear();picks=list(range(len(pool)))
    i=secrets.choice(picks);used.append(i);return pool[i]

def new_un(room):
    p=room['party']
    p.update(theme=draw(UNANIMOUS_THEMES,p['used']),answers={},last=None)
    room['phase']='un_answer'

def new_in(room):
    p=room['party'];a=room['active']
    category,word=draw(INSIDER_WORDS,p['used'])
    master=a[p['round']%len(a)]
    insider=secrets.choice([i for i in a if i!=master])
    p.update(category=category,word=word,master=master,insider=insider,entries=[],votes={},solvedBy=None,last=None)
    room['phase']='in_ask'

def new_sr(room):
    p=room['party'];d=draw(RANK_SETS,p['used'])
    p.update(deck={'title':d[0],'items':d[1],'criteria':d[2]},criterion=secrets.randbelow(4),
      target=room['active'][p['round']%len(room['active'])],order=None,guesses={},last=None)
    room['phase']='sr_order'

def start_extra(room):
    g=room['game'];a=room['active']
    if g=='unanimous':
        room['party']={'round':0,'roundLimit':8,'successes':0,'goal':5,'history':[],'used':[]};new_un(room)
    elif g=='insider':
        if len(a)<4:raise ValueError('インサイダーは4人以上必要です')
        room['party']={'round':0,'roundLimit':min(6,len(a)),'history':[],'used':[]};new_in(room)
    elif g=='secret_rank':
        if len(a)<3:raise ValueError('秘密ランキングは3人以上必要です')
        room['party']={'round':0,'roundLimit':min(6,len(a)),'history':[],'used':[]};new_sr(room)
    else:raise ValueError('未対応です')

def reveal_un(room):
    p=room['party'];a=p['answers'];all_done=len(a)==len(room['active'])
    success=all_done and len({norm(v) for v in a.values()})==1
    if success:
        p['successes']+=1
        for pid in room['active']:room['points'][pid]+=2
    last={'round':p['round']+1,'theme':p['theme'],'success':success,'successes':p['successes'],
          'rows':[{'pid':pid,'name':name(room,pid),'text':a.get(pid,'未回答')} for pid in room['active']]}
    p['last']=last;p['history'].append(last);room['phase']='un_reveal'

def reveal_in(room):
    p=room['party'];a=room['active'];votes=p['votes'];spy=p['insider']
    counts={pid:list(votes.values()).count(pid) for pid in a if pid!=p['master']}
    n=max(counts.values(),default=0)
    caught=n>0 and counts[spy]==n and list(counts.values()).count(n)==1
    if caught:
        for pid,target in votes.items():
            if target==spy:room['points'][pid]+=2
    else:room['points'][spy]+=3
    if p['solvedBy']:
        room['points'][p['solvedBy']]+=1;room['points'][p['master']]+=1
    last={'round':p['round']+1,'word':p['word'],'category':p['category'],
      'insider':spy,'insiderName':name(room,spy),'master':p['master'],'masterName':name(room,p['master']),
      'caught':caught,'solvedBy':p['solvedBy'],
      'votes':[{'name':name(room,pid),'target':name(room,target)} for pid,target in votes.items()]}
    p['last']=last;p['history'].append(last);room['phase']='in_reveal'

def reveal_sr(room):
    p=room['party'];d=p['deck'];criterion=p['criterion']
    rows=[{'pid':pid,'name':name(room,pid),'choice':n,'correct':n==criterion} for pid,n in p['guesses'].items()]
    for item in rows:
        if item['correct']:room['points'][item['pid']]+=3
    if any(x['correct'] for x in rows):room['points'][p['target']]+=1
    last={'round':p['round']+1,'title':d['title'],'items':d['items'],'criteria':d['criteria'],
          'criterion':criterion,'order':p['order'],'targetName':name(room,p['target']),'guesses':rows}
    p['last']=last;p['history'].append(last);room['phase']='sr_reveal'

def extra_snapshot(room,pid):
    p=room['party'];g=room['game'];phase=room['phase']
    players=[{'id':x['id'],'name':x['name'],'online':bool(x['ws'] and not x['ws'].closed),
       'score':room['points'].get(x['id'],0),'avatar':x.get('avatar',''),'emoji':x.get('emoji','🌷')}
       for x in room['players'].values()]
    data={'round':p['round'],'roundLimit':p['roundLimit']}
    if g=='unanimous':
        data.update(theme=p['theme'],successes=p['successes'],goal=p['goal'],
           submitted=pid in p['answers'],count=len(p['answers']),
           last=p['last'] if phase in ('un_reveal','final') else None,
           history=p['history'] if phase=='final' else [])
    elif g=='insider':
        role='master' if pid==p['master'] else 'insider' if pid==p['insider'] else 'citizen'
        data.update(category=p['category'],master=p['master'],role=role,
           secretWord=p['word'] if role!='citizen' or phase in ('in_reveal','final') else None,
           entries=[e.copy() for e in p['entries'][-35:]],votesCount=len(p['votes']),
           myVote=p['votes'].get(pid),solved=bool(p['solvedBy']),
           last=p['last'] if phase in ('in_reveal','final') else None,
           history=p['history'] if phase=='final' else [])
    elif g=='secret_rank':
        d=p['deck'];target=pid==p['target']
        data.update(title=d['title'],items=d['items'],criteria=d['criteria'],target=p['target'],
           secretCriterion=p['criterion'] if target or phase in ('sr_reveal','final') else None,
           order=p['order'] if phase!='sr_order' or target else None,
           submitted=p['order'] is not None,guessCount=len(p['guesses']),
           myGuess=p['guesses'].get(pid),
           last=p['last'] if phase in ('sr_reveal','final') else None,
           history=p['history'] if phase=='final' else [])
    return {'type':'state','me':pid,'room':{
      'code':room['code'],'owner':room['owner'],'game':g,'phase':phase,'players':players,
      'active':room['active'],'matchNo':room['matchNo'],'endedEarly':room['endedEarly'],'party':data}}

def handle_extra(room,pid,event,obj,is_owner):
    p=room['party'];phase=room['phase'];a=room['active'];game=room['game']
    if pid not in a:raise ValueError('現在のゲームに参加していません')
    if game=='unanimous':
        if event=='un_answer':
            if phase!='un_answer' or pid in p['answers']:raise ValueError('今は回答できません')
            v=str(obj.get('text','')).strip()[:60]
            if not v:raise ValueError('回答してください')
            p['answers'][pid]=v
            if len(p['answers'])==len(a):reveal_un(room)
        elif event=='un_redraw':
            if not is_owner or phase!='un_answer' or p['answers']:raise ValueError('まだ回答がない場合のみ変更できます')
            new_un(room)
        elif event=='un_force':
            if not is_owner or phase!='un_answer' or len(p['answers'])<2:raise ValueError('2人以上の回答が必要です')
            reveal_un(room)
        elif event=='un_next':
            if not is_owner or phase!='un_reveal':raise ValueError('主催者だけが進めます')
            if p['successes']>=p['goal'] or p['round']+1>=p['roundLimit']:room['phase']='final'
            else:p['round']+=1;new_un(room)
        else:raise ValueError('無効な操作です')
    elif game=='insider':
        if event=='in_question':
            if phase!='in_ask' or pid==p['master'] or len(p['entries'])>=35:raise ValueError('今は質問できません')
            v=str(obj.get('text','')).strip()[:120]
            if len(v)<2:raise ValueError('質問を入力してください')
            p['entries'].append({'kind':'ask','id':len(p['entries']),'pid':pid,'name':name(room,pid),'text':v,'reply':None})
        elif event=='in_answer':
            i=obj.get('id');v=obj.get('reply')
            if phase!='in_ask' or pid!=p['master'] or type(i) is not int or not 0<=i<len(p['entries']) or v not in ('yes','no','neutral') or p['entries'][i]['kind']!='ask':
                raise ValueError('親だけが回答できます')
            p['entries'][i]['reply']=v
        elif event=='in_guess':
            if phase!='in_ask' or pid==p['master'] or len(p['entries'])>=35:raise ValueError('今は推理できません')
            v=str(obj.get('text','')).strip()[:70]
            if not v:raise ValueError('答えを入力してください')
            correct=norm(v)==norm(p['word'])
            p['entries'].append({'kind':'guess','id':len(p['entries']),'pid':pid,'name':name(room,pid),'text':v,'reply':'correct' if correct else 'wrong'})
            if correct:p['solvedBy']=pid;room['phase']='in_vote'
        elif event=='in_skip':
            if phase!='in_ask' or not is_owner:raise ValueError('主催者だけが進めます')
            room['phase']='in_vote'
        elif event=='in_vote':
            target=obj.get('target')
            if phase!='in_vote' or pid==p['master'] or pid in p['votes'] or target not in a or target==pid or target==p['master']:
                raise ValueError('親と自分以外へ投票してください')
            p['votes'][pid]=target
            if len(p['votes'])==len(a)-1:reveal_in(room)
        elif event=='in_force':
            if not is_owner or phase!='in_vote' or not p['votes']:raise ValueError('主催者は1票以上で締め切れます')
            reveal_in(room)
        elif event=='in_next':
            if phase!='in_reveal' or not is_owner:raise ValueError('主催者だけが進めます')
            if p['round']+1>=p['roundLimit']:room['phase']='final'
            else:p['round']+=1;new_in(room)
        else:raise ValueError('無効な操作です')
    elif game=='secret_rank':
        if event=='sr_order':
            order=obj.get('order')
            if phase!='sr_order' or pid!=p['target'] or type(order) is not list or len(order)!=5 or any(type(i) is not int for i in order) or set(order)!=set(range(5)):
                raise ValueError('主役が5項目を並べ替えてください')
            p['order']=order[:];room['phase']='sr_guess'
        elif event=='sr_guess':
            choice=obj.get('choice')
            if phase!='sr_guess' or pid==p['target'] or pid in p['guesses'] or type(choice) is not int or choice not in range(4):
                raise ValueError('主役以外が秘密の基準を予想してください')
            p['guesses'][pid]=choice
            if len(p['guesses'])==len(a)-1:reveal_sr(room)
        elif event=='sr_force':
            if not is_owner or phase!='sr_guess' or not p['guesses']:raise ValueError('1件以上の回答が必要です')
            reveal_sr(room)
        elif event=='sr_next':
            if not is_owner or phase!='sr_reveal':raise ValueError('主催者だけが進めます')
            if p['round']+1>=p['roundLimit']:room['phase']='final'
            else:p['round']+=1;new_sr(room)
        else:raise ValueError('無効な操作です')
    else:raise ValueError('無効なゲームです')
