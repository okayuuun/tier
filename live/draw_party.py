"""Drawing party modes: a hidden-target drawing challenge and a picture telephone."""
import math,secrets

GAME_IDS={'artguide','drawrelay'}
EVENTS={'art_target','art_hints','art_submit','art_pick','art_force','art_next','relay_seed','relay_draw','relay_caption','relay_next'}
TOPICS=[('架空のペット','王冠をかぶった猫'),('架空のペット','空を飛ぶペンギン'),('乗り物','寿司の形の車'),('乗り物','二階建て自転車'),('建物','雲の上のコンビニ'),('建物','海底の図書館'),('未来の家電','怒る冷蔵庫'),('未来の家電','歩く洗濯機'),('ファンタジー','眼鏡をかけたドラゴン'),('ファンタジー','雨の日の魔法使い'),('食べ物','宇宙に浮かぶラーメン'),('食べ物','爆発するプリン'),('動物','会議をする柴犬'),('動物','料理中のカピバラ'),('学校','遅刻するロボット'),('学校','授業をする幽霊'),('スポーツ','サッカーをするタコ'),('スポーツ','バレエを踊るゴリラ'),('お仕事','探偵のハムスター'),('お仕事','歯医者の吸血鬼'),('物語','寝坊したお姫様'),('物語','電車通勤する勇者'),('季節','雪だるまの夏休み'),('季節','桜の下の宇宙人'),('発明品','空飛ぶこたつ'),('発明品','自動で逃げる傘'),('日用品','サボる目覚まし時計'),('日用品','嫉妬する鏡'),('テーマパーク','お化けの観覧車'),('テーマパーク','迷子の巨大ぬいぐるみ'),('海','カフェの店長をするサメ'),('海','宇宙服を着たクラゲ'),('恋愛','月でデートするロボット'),('恋愛','花束を持つ恐竜'),('ゲーム','セーブポイントで休む魔王'),('ゲーム','宝箱に住む猫'),('王国','王様になったカエル'),('王国','城を守るおにぎり'),('天気','降ってくるたこ焼き'),('天気','虹を食べる羊'),('大冒険','砂漠を泳ぐ魚'),('大冒険','火山を登るアイス'),('お祭り','屋台を開く河童'),('お祭り','花火を打ち上げるリス'),('映画','逃亡する巨大パン'),('映画','正義の味方の寝坊')]
COLORS={'#4c375e','#ed448f','#397caf','#43a06e','#e89b38','#755dd4','#202020','#ffffff'}
def strokes(v):
    if not isinstance(v,list) or not 1<=len(v)<=90:raise ValueError('1〜90本の線を描いてください')
    out=[];total=0
    for s in v:
        if not isinstance(s,dict) or s.get('c') not in COLORS or type(s.get('w')) not in (int,float) or not 1<=s['w']<=17:raise ValueError('線の設定が不正です')
        points=s.get('p')
        if not isinstance(points,list) or not 1<=len(points)<=90:raise ValueError('線の座標が不正です')
        coords=[]
        for xy in points:
            if not isinstance(xy,list) or len(xy)!=2 or any(type(z) not in (int,float) or not math.isfinite(z) or not 0<=z<=1 for z in xy):raise ValueError('絵の座標が不正です')
            coords.append([round(xy[0],4),round(xy[1],4)])
        total+=len(coords)
        if total>2500:raise ValueError('線が多すぎます')
        out.append({'c':s['c'],'w':int(s['w']),'p':coords})
    return out
def fresh_guide(r):
    p=r['draw'];p['guide']=r['active'][p['round']%len(r['active'])]
    p['topic'],p['target']=secrets.choice([t for t in TOPICS if t!=p.get('previous')]);p['previous']=(p['topic'],p['target'])
    p.update(hints=[],pictures={},last=None);r['phase']='art_hint'
def start(r):
    a=r['active']
    if len(a)<3:raise ValueError('3人以上で遊べます')
    if r['game']=='artguide':
        r['draw']={'round':0,'limit':min(len(a),5),'history':[]};fresh_guide(r)
    else:
        r['draw']={'stage':0,'limit':min(len(a)-1,4),'chains':{pid:[] for pid in a},'pending':{}}
        r['phase']='relay_seed'
def chain_owner(r,pid):
    a=r['active'];return a[(a.index(pid)-r['draw']['stage'])%len(a)]
def snapshot(r,pid):
    p=r['draw'];phase=r['phase'];d={}
    if r['game']=='artguide':
        public=phase in ('art_reveal','final')
        d={'round':p['round'],'roundLimit':p['limit'],'guide':p['guide'],'topic':p['topic'],'hints':p['hints'],'target':p['target'] if public or pid==p['guide'] else None,'submitted':pid in p['pictures'],'submittedCount':len(p['pictures']),'needed':len(r['active'])-1,'pictures':[{'id':x,'name':r['players'][x]['name'],'strokes':v} for x,v in p['pictures'].items()] if phase in ('art_pick','art_reveal','final') else [],'last':p['last'] if public else None,'history':p['history'] if phase=='final' else []}
    else:
        chain=p['chains'][chain_owner(r,pid)]
        d={'stage':p['stage'],'stepLimit':p['limit'],'submitted':pid in p['pending'],'submittedCount':len(p['pending']),'needed':len(r['active']),'prompt':chain[-1] if p['stage']>0 and chain else None,'chains':[{'owner':owner,'ownerName':r['players'][owner]['name'],'steps':[dict(x,name=r['players'][x['by']]['name']) for x in steps]} for owner,steps in p['chains'].items()] if phase in ('relay_reveal','final') else []}
    players=[{'id':x,'name':v['name'],'score':r['points'].get(x,0),'online':bool(v['ws'] and not v['ws'].closed),'avatar':v.get('avatar',''),'emoji':v.get('emoji','🌷')} for x,v in r['players'].items()]
    return {'type':'state','me':pid,'room':{'code':r['code'],'owner':r['owner'],'game':r['game'],'phase':phase,'players':players,'active':r['active'],'matchNo':r['matchNo'],'endedEarly':r['endedEarly'],'draw':d}}
def handle(r,pid,typ,obj,host):
    p=r['draw'];phase=r['phase'];a=r['active']
    if pid not in a:raise ValueError('ゲームの参加者ではありません')
    if r['game']=='artguide':
        guide=pid==p['guide']
        if typ=='art_target':
            if not guide or phase!='art_hint':raise ValueError('出題者だけが変更できます')
            t=obj.get('topic');s=obj.get('target')
            if not isinstance(t,str) or not 2<=len(t.strip())<=36 or not isinstance(s,str) or not 2<=len(s.strip())<=60:raise ValueError('テーマと秘密のお題を入力してください')
            p['topic'],p['target']=t.strip(),s.strip()
        elif typ=='art_hints':
            if not guide or phase!='art_hint':raise ValueError('出題者だけがヒントを送れます')
            h=obj.get('hints')
            if not isinstance(h,list) or not 2<=len(h)<=3 or any(not isinstance(x,str) or not 2<=len(x.strip())<=48 for x in h) or any(p['target'] in x for x in h):raise ValueError('秘密の答えを直接言わずに、2〜3個のヒントを入力してください')
            p['hints']=[x.strip() for x in h];r['phase']='art_draw'
        elif typ=='art_submit':
            if guide or phase!='art_draw' or pid in p['pictures']:raise ValueError('今は絵を提出できません')
            p['pictures'][pid]=strokes(obj.get('strokes'))
            if len(p['pictures'])==len(a)-1:r['phase']='art_pick'
        elif typ=='art_force':
            if not host or phase!='art_draw' or not p['pictures']:raise ValueError('提出された絵が必要です')
            r['phase']='art_pick'
        elif typ=='art_pick':
            if not guide or phase!='art_pick':raise ValueError('出題者だけが選べます')
            winner=obj.get('winner')
            if winner not in p['pictures']:raise ValueError('提出された絵を選んでください')
            r['points'][winner]+=2;r['points'][pid]+=1
            result={'round':p['round']+1,'guideName':r['players'][pid]['name'],'topic':p['topic'],'target':p['target'],'hints':p['hints'][:],'winner':winner,'winnerName':r['players'][winner]['name'],'pictures':[{'id':x,'name':r['players'][x]['name'],'strokes':v} for x,v in p['pictures'].items()]}
            p['last']=result;p['history'].append(result);r['phase']='art_reveal'
        elif typ=='art_next':
            if not host or phase!='art_reveal':raise ValueError('主催者だけが進行できます')
            if p['round']+1>=p['limit']:r['phase']='final'
            else:p['round']+=1;fresh_guide(r)
        else:raise ValueError('この操作は利用できません')
    else:
        if phase=='relay_reveal':
            if not host or typ!='relay_next':raise ValueError('主催者だけが進行できます')
            r['phase']='final';return
        if pid in p['pending']:raise ValueError('すでに提出済みです')
        if phase=='relay_seed' and typ=='relay_seed' or phase=='relay_caption' and typ=='relay_caption':
            s=obj.get('text')
            if not isinstance(s,str) or not 2<=len(s.strip())<=70:raise ValueError('文章を2〜70文字で入力してください')
            item={'kind':'text','by':pid,'text':s.strip()}
        elif phase=='relay_draw' and typ=='relay_draw':
            item={'kind':'drawing','by':pid,'strokes':strokes(obj.get('strokes'))}
        else:raise ValueError('今はこの操作を利用できません')
        p['pending'][pid]=item
        if len(p['pending'])==len(a):
            for actor,x in p['pending'].items():p['chains'][chain_owner(r,actor)].append(x)
            p['pending']={}
            if p['stage']>=p['limit']:r['phase']='relay_reveal'
            else:
                p['stage']+=1
                r['phase']='relay_draw' if p['stage']%2 else 'relay_caption'
