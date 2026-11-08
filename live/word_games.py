"""Word combination games; original decks, inspired by daytime-drama senryu, tanka and title games."""
import json,secrets,collections
from pathlib import Path
DATA=json.loads((Path(__file__).parent/'word_decks.json').read_text(encoding='utf-8'))
GAME_IDS={'senryu','tanka','booktitle'}
EVENTS={'word_submit','word_show','word_pick','word_next','word_vote','word_force'}
def parse_format(value):
    if not isinstance(value,str) or not 2<=len(value)<=6 or set(value)-{'5','7'}:
        raise ValueError('句の型は5と7を2〜6個入力してください')
    return [int(x) for x in value]
def sample(pool,n):return secrets.SystemRandom().sample(pool,min(len(pool),n))
def validate_deck(game, obj):
    if not isinstance(obj,dict):raise ValueError('カードデータは種類別のリストにしてください')
    keys=('bookTop','bookBottom') if game=='booktitle' else ('five','seven')
    new={key:list(DATA[key]) for key in ('five','seven','bookTop','bookBottom')}
    for key in keys:
        values=obj.get(key)
        if not isinstance(values,list) or not 2<=len(values)<=200 or any(not isinstance(x,str) or not 1<=len(x.strip())<=35 for x in values):
            raise ValueError('カードは各種類2〜200語、1語35文字以内で登録してください')
        new[key]=list(dict.fromkeys(x.strip() for x in values))
        if len(new[key])<2:raise ValueError('異なる言葉を2つ以上登録してください')
    return new

def new_round(room):
    p=room['word'];active=room['active'];bank=room.get('wordDeck') or DATA
    p['judge']=active[p['round']%len(active)] if room['game']!='booktitle' else None
    p.update(submitted={},votes={},last=None,hands={})
    if room['game']=='booktitle':
        for pid in active:p['hands'][pid]={'top':sample(bank['bookTop'],7),'bottom':sample(bank['bookBottom'],7)}
    else:
        for pid in active:
            if pid!=p['judge']:
                p['hands'][pid]={'5':sample(bank['five'],max(7,p['format'].count(5)+2)),
                                 '7':sample(bank['seven'],max(3,p['format'].count(7)+2))}
    room['phase']='word_compose'
def start(room):
    active=room['active'];game=room['game']
    if len(active)<(3 if game=='booktitle' else 2):
        raise ValueError('このゲームは'+('3人' if game=='booktitle' else '2人')+'以上必要です')
    fmt=room.get('wordFormat') or ('57577' if game=='tanka' else '575')
    room['word']={'round':0,'roundLimit':len(active),'format':parse_format(fmt),'history':[]}
    new_round(room)
def snapshot(room,pid):
    p=room['word'];phase=room['phase'];game=room['game']
    entries=[]
    if phase in ('word_judge','word_vote','word_reveal','final'):
        entries=[{'id':k,'text':v['text'],'lines':v.get('lines',[]),
                  'name':room['players'][k]['name'] if phase in ('word_reveal','final') else None}
                 for k,v in p['submitted'].items()]
        secrets.SystemRandom().shuffle(entries)
    players=[{'id':k,'name':v['name'],'online':bool(v['ws'] and not v['ws'].closed),
              'score':room['points'].get(k,0),'avatar':v.get('avatar',''),'emoji':v.get('emoji','🌷')}
             for k,v in room['players'].items()]
    w={'round':p['round'],'roundLimit':p['roundLimit'],'format':p['format'],'judge':p['judge'],
       'hand':p['hands'].get(pid,{}),'submitted':pid in p['submitted'],'submittedCount':len(p['submitted']),
       'toSubmit':len(room['active'])-(1 if p['judge'] else 0),'entries':entries,'voteCount':len(p['votes']),
       'myVote':p['votes'].get(pid),'last':p['last'] if phase in ('word_reveal','final') else None,
       'history':p['history'] if phase=='final' else []}
    return {'type':'state','me':pid,'room':{'code':room['code'],'owner':room['owner'],
        'game':game,'phase':phase,'players':players,'active':room['active'],
        'matchNo':room['matchNo'],'endedEarly':room['endedEarly'],'word':w}}
def check_phrase(phrase,pool,used):
    if not isinstance(phrase,dict) or not isinstance(phrase.get('text'),str):
        raise ValueError('句が正しくありません')
    text=phrase['text'].strip()
    if not 1<=len(text)<=35:raise ValueError('1句は1〜35文字で入力してください')
    if not phrase.get('free'):
        if text not in pool or used[text]>=pool.count(text):raise ValueError('手札にない言葉です')
        used[text]+=1
    return text
def finish_book(room):
    p=room['word'];votes=collections.Counter(p['votes'].values());mx=max(votes.values(),default=0)
    winners=[pid for pid in p['submitted'] if mx and votes[pid]==mx]
    for pid in winners:room['points'][pid]+=2
    p['last']={'round':p['round']+1,'type':'booktitle','winners':winners,
               'entries':[{'id':pid,'name':room['players'][pid]['name'],'text':v['text'],'votes':votes[pid]}
                          for pid,v in p['submitted'].items()]}
    p['history'].append(p['last']);room['phase']='word_reveal'
def handle(room,pid,typ,obj,is_owner):
    p=room['word'];phase=room['phase'];active=room['active'];judge=p['judge']
    if pid not in active:raise ValueError('参加できません')
    if typ=='word_submit':
        if phase!='word_compose' or pid in p['submitted'] or pid==judge:raise ValueError('今は提出できません')
        hand=p['hands'][pid]
        if room['game']=='booktitle':
            a=check_phrase(obj.get('top'),hand['top'],collections.Counter())
            b=check_phrase(obj.get('bottom'),hand['bottom'],collections.Counter())
            data={'lines':[a,b],'text':a+b}
        else:
            arr=obj.get('lines')
            if not isinstance(arr,list) or len(arr)!=len(p['format']):raise ValueError('型に合う句数にしてください')
            used={5:collections.Counter(),7:collections.Counter()}
            lines=[check_phrase(x,hand[str(n)],used[n]) for x,n in zip(arr,p['format'])]
            data={'lines':lines,'text':'\n'.join(lines)}
        p['submitted'][pid]=data
        if len(p['submitted'])>=len(active)-(1 if judge else 0):
            room['phase']='word_judge' if judge else 'word_vote'
    elif typ=='word_show':
        if phase!='word_compose' or pid!=judge or not p['submitted']:raise ValueError('親だけが発表できます')
        room['phase']='word_judge'
    elif typ=='word_pick':
        if phase!='word_judge' or pid!=judge:raise ValueError('親だけが選べます')
        chosen=obj.get('target')
        if chosen not in p['submitted']:raise ValueError('作品を選んでください')
        room['points'][chosen]+=1
        p['last']={'round':p['round']+1,'type':'senryu','judge':judge,'winner':chosen,
                   'entries':[{'id':k,'name':room['players'][k]['name'],'text':v['text']}
                              for k,v in p['submitted'].items()]}
        p['history'].append(p['last']);room['phase']='word_reveal'
    elif typ=='word_vote':
        if phase!='word_vote' or pid in p['votes']:raise ValueError('投票できません')
        target=obj.get('target')
        if target==pid or target not in p['submitted']:raise ValueError('自分の作品には投票できません')
        p['votes'][pid]=target
        if len(p['votes'])>=len(active):finish_book(room)
    elif typ=='word_force':
        if not is_owner:raise ValueError('主催者だけが進行できます')
        if phase=='word_compose' and p['submitted']:
            room['phase']='word_judge' if judge else 'word_vote'
        elif phase=='word_vote' and p['votes']:finish_book(room)
        else:raise ValueError('まだ進められません')
    elif typ=='word_next':
        if not is_owner or phase!='word_reveal':raise ValueError('主催者だけが次へ進めます')
        if p['round']+1>=p['roundLimit']:room['phase']='final'
        else:p['round']+=1;new_round(room)
    else:raise ValueError('不明な操作です')
