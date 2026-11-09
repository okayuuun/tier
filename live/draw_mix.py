"""Three original multiplayer drawing games (artmix, artcollab, reverseart)."""
import secrets, unicodedata
from collections import Counter
from draw_party import strokes
GAME_IDS={'artmix','artcollab','reverseart'}
EVENTS={'mx_draw','mx_caption','mx_vote','mx_force','mx_next','co_topic','co_submit','co_skip','co_next','rv_hint','rv_draw','rv_guess','rv_judge','rv_force','rv_next'}
ART_THEMES=['怒ったぬいぐるみ','魔王の夏休み','猫が社長の会社','世界一不便な発明品','宇宙の給食','最弱のラスボス','冷蔵庫の初恋','空飛ぶコンビニ','怪獣の卒業式','伝説の傘','月面のカラオケ','ロボットの誕生日','恐竜の就職面接','異世界の自動販売機','おかしな新商品','宇宙の温泉','深夜の遊園地','動物たちの会議','忍者のSNS','悲しいプリン','魔法使いの失敗','大きすぎるケーキ','ゲームの秘密ボス','真面目な海賊','犬の文化祭','カフェの店長のサメ','学校に来た宇宙人','しゃべる文房具','自動で逃げる靴','人生で一番気まずい瞬間','王様のペット','怒っている山','雨の日の幽霊','花火を打ち上げる猫','未来の観光地','宇宙船の運転手','ロボットの遠足','勉強ができる魚','地球を守るおにぎり','怪盗の大失敗','動物の結婚式','伝説のゲーム機','宇宙人のスーパーマーケット','100年後のスマホ','アリの王国','意外なヒーロー','最強の掃除機','コーヒーを飲むドラゴン','弱気な勇者','踊る信号機']
COLLAB_THEMES=['空に浮かぶ商店街','宇宙のレストラン','魔法の森','未来の学校','海底のお城','夜の美術館','動物たちの街','ゲームのステージ','ファンタジーの市場','猫の王国','お祭りの夜','大きな秘密基地','魔法の図書館','怪盗のアジト','モンスターの学校','動物の運動会','宇宙の遊園地','魔王の部屋','新しい惑星','雲の上の住宅街','不思議な水族館','世界一大きな公園','空飛ぶ乗り物','伝説の城','100年後のコンビニ','おばけの銭湯','宇宙船の中','秘密の研究所','動物たちのお茶会','夢の中の教室']
MISSIONS=['何かを笑顔にする','どこかに食べ物を描く','空を飛ぶものを足す','何かに帽子をかぶせる','小さな目を描く','ハートを隠す','悲しい顔を追加する','謎のスイッチを足す','何かに羽をつける','三角形を混ぜる','秘密の扉を描く','生き物を追加する','時計を混ぜる','花を描く','湯気を追加する','何かを巨大化させる','星を描く','しっぽを足す','ロボットを描く','小さな看板を足す','音が出そうなものを描く','丸いものを追加する','奇妙な模様を描く','木を描く']
REVERSE_TARGETS=['たこ焼き','パンダ','自動販売機','観覧車','宇宙飛行士','おにぎり','カメレオン','花火','消火器','卓球','プリン','だるま','クジラ','傘','掃除機','忍者','ランドセル','エレベーター','お風呂','パフェ','サンタクロース','ピアノ','コンビニ','カブトムシ','冷蔵庫','オムライス','風車','サメ','怪獣','ハンバーガー','滑り台','カメラ','電車','望遠鏡','チョコレート','タコ','ロボット','シマウマ','カレーライス','自転車','ゲーム機','城','図書館','エビフライ','ヘリコプター','郵便ポスト','スイカ','ラーメン','カエル','メガネ','ペンギン','宝箱','かき氷','パソコン','船','野球','ケーキ','サボテン','カピバラ','飛行機','テント','トランペット','温泉']
def player(r,x):return r['players'][x]['name']
def norm(x):return ''.join(unicodedata.normalize('NFKC',x).casefold().split())
def choose(a,last=None):return secrets.choice([x for x in a if x!=last] or a)
def start(r):
 a=r['active'];g=r['game']
 if len(a)<(3 if g=='artmix' else 2):raise ValueError('人数が足りません：イラスト×セリフは3人以上、そのほかは2人以上です')
 r['drawmix']={'round':0,'roundLimit':min(4,len(a)) if g=='reverseart' else 2,'history':[]}
 new_round(r)
def new_round(r):
 p=r['drawmix'];a=r['active'];g=r['game']
 if g=='artmix':
  p.update(prompts=dict(zip(a,secrets.SystemRandom().sample(ART_THEMES,len(a)))),drawings={},captions={},votes={},combos=[],last=None)
  r['phase']='mx_draw'
 elif g=='artcollab':
  p.update(topic=choose(COLLAB_THEMES,p.get('topic')),canvas=[],turn=0,contributors=[],missions=dict(zip(a,secrets.SystemRandom().sample(MISSIONS,len(a)))),last=None)
  r['phase']='co_turn'
 else:
  p.update(artist=a[p['round']%len(a)],target=choose(REVERSE_TARGETS,p.get('target')),hints={},drawing=None,guess=None,judgements={},last=None)
  r['phase']='rv_hint'
def make_mix(r):
 p=r['drawmix'];a=r['active'];n=len(a);k=secrets.randbelow(n-1)+1
 p['combos']=[{'key':secrets.token_hex(6),'artist':a[i],'writer':a[(i+k)%n],'strokes':p['drawings'][a[i]],'caption':p['captions'][a[(i+k)%n]]} for i in range(n)]
 secrets.SystemRandom().shuffle(p['combos']);r['phase']='mx_vote'
def end_mix(r):
 p=r['drawmix'];counts=Counter(p['votes'].values());mx=max(counts.values(),default=0)
 winners=[c for c in p['combos'] if mx and counts[c['key']]==mx]
 for c in winners:r['points'][c['artist']]+=2;r['points'][c['writer']]+=2
 result={'round':p['round']+1,'entries':[{'key':c['key'],'artistName':player(r,c['artist']),'writerName':player(r,c['writer']),'caption':c['caption'],'strokes':c['strokes'],'votes':counts[c['key']]} for c in p['combos']],'winners':[c['key'] for c in winners]}
 p['last']=result;p['history'].append(result);r['phase']='mx_reveal'
def end_collab(r):
 p=r['drawmix'];rec={'round':p['round']+1,'topic':p['topic'],'strokes':p['canvas'][:],'contributions':[{'name':player(r,x['pid']),'mission':p['missions'][x['pid']],'count':x['count']} for x in p['contributors']]}
 p['last']=rec;p['history'].append(rec);r['phase']='co_reveal'
 for x in r['active']:r['points'][x]+=1
def end_reverse(r,correct):
 p=r['drawmix'];artist=p['artist']
 if correct:
  r['points'][artist]+=3
  for x in p['hints']:r['points'][x]+=1
 rec={'round':p['round']+1,'artistName':player(r,artist),'target':p['target'],'guess':p['guess'],'accepted':bool(correct),'hints':[{'name':player(r,x),'text':v} for x,v in p['hints'].items()],'strokes':p['drawing']}
 p['last']=rec;p['history'].append(rec);r['phase']='rv_reveal'
def snapshot(r,pid):
 p=r['drawmix'];phase=r['phase'];g=r['game'];a=r['active']
 players=[{'id':x,'name':player(r,x),'score':r['points'].get(x,0),'online':bool(v['ws'] and not v['ws'].closed),'avatar':v.get('avatar',''),'emoji':v.get('emoji','🌷')} for x,v in r['players'].items()]
 d={'round':p['round'],'roundLimit':p['roundLimit'],'last':p.get('last') if phase in ('mx_reveal','co_reveal','rv_reveal','final') else None,'history':p['history'] if phase=='final' else []}
 if g=='artmix':
  d.update(myPrompt=p['prompts'].get(pid) if phase=='mx_draw' else None,submitted=pid in p['drawings'] if phase=='mx_draw' else pid in p['captions'],submittedCount=len(p['drawings']) if phase=='mx_draw' else len(p['captions']),needed=len(a),myVote=pid in p['votes'],votesCount=len(p['votes']),combos=[{'key':x['key'],'caption':x['caption'],'strokes':x['strokes'],'mine':pid==x['artist'] or (len(a)>3 and pid==x['writer'])} for x in p['combos']] if phase=='mx_vote' else [])
 elif g=='artcollab':
  turn=a[p['turn']] if phase=='co_turn' and p['turn']<len(a) else None
  d.update(topic=p['topic'],canvas=p['canvas'],turn=turn,turnName=player(r,turn) if turn else '',turnCount=p['turn'],needed=len(a),myMission=p['missions'][pid] if turn==pid else None)
 else:
  artist=p['artist']
  d.update(artist=artist,artistName=player(r,artist),target=p['target'] if pid!=artist or phase in ('rv_reveal','final') else None,hinted=pid in p['hints'],hintsCount=len(p['hints']),needed=len(a)-1,hints=[{'text':v} for v in p['hints'].values()] if phase in ('rv_draw','rv_guess','rv_judge','rv_reveal') else [],drawing=p['drawing'] if phase in ('rv_guess','rv_judge','rv_reveal') else None,guess=p['guess'] if phase in ('rv_judge','rv_reveal') else None,voted=pid in p['judgements'],votedCount=len(p['judgements']))
 return {'type':'state','me':pid,'room':{'code':r['code'],'owner':r['owner'],'game':g,'phase':phase,'players':players,'active':a,'matchNo':r['matchNo'],'endedEarly':r['endedEarly'],'drawmix':d}}
def handle(r,pid,t,obj,host):
 a=r['active'];p=r['drawmix'];g=r['game'];phase=r['phase']
 if pid not in a:raise ValueError('参加者のみ操作できます')
 if t=='mx_draw':
  if g!='artmix' or phase!='mx_draw' or pid in p['drawings']:raise ValueError('今は絵を提出できません')
  p['drawings'][pid]=strokes(obj.get('strokes'))
  if len(p['drawings'])==len(a):r['phase']='mx_caption'
 elif t=='mx_caption':
  if g!='artmix' or phase!='mx_caption' or pid in p['captions']:raise ValueError('今はセリフを提出できません')
  s=obj.get('text')
  if not isinstance(s,str) or not 2<=len(s.strip())<=70:raise ValueError('セリフは2〜70文字です')
  p['captions'][pid]=s.strip()
  if len(p['captions'])==len(a):make_mix(r)
 elif t=='mx_vote':
  if g!='artmix' or phase!='mx_vote' or pid in p['votes']:raise ValueError('今は投票できません')
  c=next((x for x in p['combos'] if x['key']==obj.get('key')),None)
  if not c or pid==c['artist'] or (len(a)>3 and pid==c['writer']):raise ValueError('自分の作品には投票できません')
  p['votes'][pid]=c['key']
  if len(p['votes'])==len(a):end_mix(r)
 elif t=='mx_force':
  if g!='artmix' or not host or phase!='mx_vote' or not p['votes']:raise ValueError('まだ集計できません')
  end_mix(r)
 elif t=='mx_next':
  if g!='artmix' or not host or phase!='mx_reveal':raise ValueError('主催者だけが進めます')
  if p['round']+1==p['roundLimit']:r['phase']='final'
  else:p['round']+=1;new_round(r)
 elif t=='co_topic':
  if g!='artcollab' or not host or phase!='co_turn' or p['turn'] or p['canvas']:raise ValueError('開始前にのみお題を変更できます')
  s=obj.get('topic')
  if not isinstance(s,str) or not 2<=len(s.strip())<=65:raise ValueError('お題は2〜65文字です')
  p['topic']=s.strip()
 elif t=='co_submit':
  if g!='artcollab' or phase!='co_turn' or a[p['turn']]!=pid:raise ValueError('あなたの手番ではありません')
  lines=strokes(obj.get('strokes'))
  if len(lines)>12:raise ValueError('1手番12本までです')
  p['canvas'].extend(lines);p['contributors'].append({'pid':pid,'count':len(lines)})
  p['turn']+=1
  if p['turn']>=len(a):end_collab(r)
 elif t=='co_skip':
  if g!='artcollab' or not host or phase!='co_turn':raise ValueError('主催者だけが手番をスキップできます')
  p['turn']+=1
  if p['turn']>=len(a):end_collab(r)
 elif t=='co_next':
  if g!='artcollab' or not host or phase!='co_reveal':raise ValueError('主催者だけが進めます')
  if p['round']+1==p['roundLimit']:r['phase']='final'
  else:p['round']+=1;new_round(r)
 elif t=='rv_hint':
  if g!='reverseart' or phase!='rv_hint' or pid==p['artist'] or pid in p['hints']:raise ValueError('今はヒントを送れません')
  s=obj.get('text')
  if not isinstance(s,str) or not 2<=len(s.strip())<=65 or norm(p['target']) in norm(s):raise ValueError('答えを直接言わず、2〜65文字でヒントを書いてください')
  p['hints'][pid]=s.strip()
  if len(p['hints'])==len(a)-1:r['phase']='rv_draw'
 elif t=='rv_draw':
  if g!='reverseart' or phase!='rv_draw' or pid!=p['artist']:raise ValueError('今は描けません')
  p['drawing']=strokes(obj.get('strokes'));r['phase']='rv_guess'
 elif t=='rv_guess':
  if g!='reverseart' or phase!='rv_guess' or pid!=p['artist']:raise ValueError('今は回答できません')
  s=obj.get('text')
  if not isinstance(s,str) or not 1<=len(s.strip())<=65:raise ValueError('1〜65文字の回答が必要です')
  p['guess']=s.strip()
  if norm(p['guess'])==norm(p['target']):end_reverse(r,True)
  else:r['phase']='rv_judge'
 elif t=='rv_judge':
  if g!='reverseart' or phase!='rv_judge' or pid==p['artist'] or pid in p['judgements']:raise ValueError('今は判定できません')
  if type(obj.get('accept')) is not bool:raise ValueError('はい/いいえで判定してください')
  p['judgements'][pid]=obj['accept']
  if len(p['judgements'])==len(a)-1:end_reverse(r,sum(p['judgements'].values())>len(p['judgements'])/2)
 elif t=='rv_force':
  if g!='reverseart' or phase!='rv_judge' or not host or not p['judgements']:raise ValueError('まだ判定できません')
  end_reverse(r,sum(p['judgements'].values())>len(p['judgements'])/2)
 elif t=='rv_next':
  if g!='reverseart' or phase!='rv_reveal' or not host:raise ValueError('主催者だけが進めます')
  if p['round']+1==p['roundLimit']:r['phase']='final'
  else:p['round']+=1;new_round(r)
 else:raise ValueError('利用できない操作です')
