"""Independent multiplayer drawing modes, with original prompts."""
import secrets,unicodedata
from collections import Counter
from draw_party import strokes
GAME_IDS={'artcontest','artforbid','drawbluff'}
EVENTS={'paint_topic','paint_submit','paint_vote','paint_force','paint_next','db_draw','db_caption','db_vote','db_force','db_next'}
CONTEST=['架空のゲームのラスボス','未来のコンビニの新商品','動物が経営する喫茶店','存在しないゲームのパッケージ','使い方が分からない家電','世界一弱そうな武器','宇宙にある小さな和菓子屋','猫の社長がいる会社','学校に来た変わった先生','とても豪華なプリン','かわいすぎる怪獣','やる気のないヒーロー','海底に建つ図書館','新しいボードゲームのキャラクター','未来の電車','魔法の自動販売機','ロボットの休日','寿司の形をした車','人間になりたかったおにぎり','優しすぎるドラゴン','とても不便な発明品','新しい祝日をキャラクターにする','悪役の休日','世界で一番小さいお城','ラスボスのペット']
FORBID=[('猫','耳','しっぽ'),('自転車','車輪','ハンドル'),('花','花びら','茎'),('ドラゴン','翼','炎'),('城','塔','旗'),('ラーメン','麺','どんぶり'),('太陽','丸い輪郭','光線'),('車','タイヤ','窓'),('魚','ひれ','しっぽ'),('ロボット','四角い頭','アンテナ'),('傘','傘の布','柄'),('時計','数字','針'),('ケーキ','ろうそく','クリーム'),('人の顔','目','口'),('犬','耳','鼻'),('魔法使い','帽子','杖'),('スマホ','画面','カメラ'),('電車','線路','車輪'),('鉛筆','芯','消しゴム'),('飛行機','翼','窓'),('鳥','くちばし','羽'),('王冠','とがった先端','宝石'),('カエル','目','長い舌'),('雪だるま','頭の丸','にんじん'),('木','葉','幹')]
BLUFF=['カレーをこぼした宇宙飛行士','寝坊して謝るドラゴン','巨大なプリンに登る探検家','会議で居眠りする魔王','おにぎりの中にある秘密基地','空を泳ぐ金魚','深夜に筋トレする豆腐','落ち込んだ自動販売機','しっぽを忘れた恐竜','逆さまの遊園地','スーパーで買い物をする幽霊','電子レンジに乗る勇者','雪だるまの卒業式','ライブで歌うサボテン','落とし物を探す王様','猫に面接される人間','踊りながら謝罪するペンギン','冷蔵庫の中で会議する野菜','恋愛相談をする火山','反省文を書く吸血鬼','空き缶を崇拝する宇宙人','財布をなくした海賊','雲の上の銭湯','耳が長すぎる忍者','居酒屋で働くユニコーン','メガネを探すメガネ','パジャマで戦う騎士','隠れてゲームをする神様','相合傘をするロボットとタコ','地球を持ち上げるハムスター']
def norm(v):return ''.join(unicodedata.normalize('NFKC',v).casefold().split())
def pick(items,previous=None):return secrets.choice([x for x in items if x!=previous] or items)
def new_paint(r):
 p=r['drawextra'];p.update(topic=pick(FORBID if r['game']=='artforbid' else CONTEST,p.get('topic')),drawings={},votes={},reports={},last=None)
 r['phase']='px_draw'
def new_bluff(r):
 p=r['drawextra'];a=r['active'];p.update(prompts=dict(zip(a,secrets.SystemRandom().sample(BLUFF,len(a)))),drawings={},captions={},votes={},options=[],cursor=0,last=None)
 r['phase']='db_draw'
def start(r):
 a=r['active'];g=r['game']
 if len(a)<(3 if g=='drawbluff' else 2):raise ValueError('参加人数が足りません')
 if g=='drawbluff' and len(a)>10:raise ValueError('絵のタイトル当ては最大10人です')
 r['drawextra']={'round':0,'roundLimit':3,'history':[]}
 if g=='drawbluff':new_bluff(r)
 else:new_paint(r)
def present(r):
 p=r['drawextra'];p.update(author=r['active'][p['cursor']],captions={},votes={},options=[],last=None);r['phase']='db_caption'
def options(r):
 p=r['drawextra'];truth=p['prompts'][p['author']];vals=[{'key':secrets.token_hex(6),'text':truth,'owner':None}];used={norm(truth)}
 for who,s in p['captions'].items():
  if norm(s) in used:continue
  used.add(norm(s));vals.append({'key':secrets.token_hex(6),'text':s,'owner':who})
 secrets.SystemRandom().shuffle(vals);p['options']=vals;r['phase']='db_vote'
def finish_bluff(r):
 p=r['drawextra'];truth=p['prompts'][p['author']];chosen=[]
 for who,k in p['votes'].items():
  v=next((v for v in p['options'] if v['key']==k),None)
  if not v:continue
  if v['owner'] is None:r['points'][who]+=3;r['points'][p['author']]+=1
  else:r['points'][v['owner']]+=1
  chosen.append({'name':r['players'][who]['name'],'choice':v['text']})
 rec={'round':p['cursor']+1,'authorName':r['players'][p['author']]['name'],'prompt':truth,'strokes':p['drawings'][p['author']],'guesses':chosen,'decoys':[{'name':r['players'][k]['name'],'text':v} for k,v in p['captions'].items()]}
 p['last']=rec;p['history'].append(rec);r['phase']='db_reveal'
def finish_paint(r):
 p=r['drawextra'];votes=Counter(p['votes'].values());bad=set();flags={}
 for artist in p['drawings']:
  hits=sum(artist in v for v in p['reports'].values())
  eligible=sum(k!=artist for k in p['votes'])
  flags[artist]=hits
  if r['game']=='artforbid' and eligible and hits>eligible/2:bad.add(artist)
 valid=[k for k in p['drawings'] if k not in bad];maxvote=max((votes[k] for k in valid),default=0)
 winners=[k for k in valid if maxvote and votes[k]==maxvote]
 for k in winners:r['points'][k]+=3
 rec={'round':p['round']+1,'topic':list(p['topic']) if isinstance(p['topic'],tuple) else p['topic'],'winners':winners,'entries':[{'id':k,'name':r['players'][k]['name'],'strokes':v,'votes':votes[k],'reports':flags[k],'disqualified':k in bad} for k,v in p['drawings'].items()]}
 p['last']=rec;p['history'].append(rec);r['phase']='px_reveal'
def snapshot(r,pid):
 p=r['drawextra'];phase=r['phase'];a=r['active'];g=r['game']
 players=[{'id':k,'name':v['name'],'score':r['points'].get(k,0),'online':bool(v['ws'] and not v['ws'].closed),'avatar':v.get('avatar',''),'emoji':v.get('emoji','🌷')} for k,v in r['players'].items()]
 out={'round':p['round'],'roundLimit':p['roundLimit'],'last':p.get('last') if phase in ('px_reveal','db_reveal','final') else None,'history':p['history'] if phase=='final' else []}
 if g=='drawbluff':
  author=a[p['cursor']] if phase not in ('db_draw','final') else None
  out.update(cursor=p['cursor'],roundLimit=len(a),myPrompt=p['prompts'].get(pid) if phase=='db_draw' or author==pid else None,drawingSubmitted=pid in p['drawings'],drawingCount=len(p['drawings']),needed=len(a),author=author,authorName=r['players'][author]['name'] if author else None,drawing=p['drawings'].get(author) if author and phase in ('db_caption','db_vote','db_reveal') else None,myCaption=pid in p['captions'],captionsCount=len(p['captions']),myVote=pid in p['votes'],votesCount=len(p['votes']),options=[{'key':v['key'],'text':v['text'],'mine':v['owner']==pid} for v in p['options']] if phase=='db_vote' else [])
 else:
  topic=p['topic']
  out.update(topic=topic[0] if isinstance(topic,tuple) else topic,target=topic[0] if isinstance(topic,tuple) else topic,banned=list(topic[1:]) if isinstance(topic,tuple) else [],submitted=pid in p['drawings'],submittedCount=len(p['drawings']),needed=len(a),myVote=pid in p['votes'],voteCount=len(p['votes']),pictures=[{'id':k,'name':r['players'][k]['name'] if phase=='px_reveal' else None,'strokes':v} for k,v in p['drawings'].items()] if phase in ('px_vote','px_reveal') else [])
 return {'type':'state','me':pid,'room':{'code':r['code'],'owner':r['owner'],'game':g,'phase':phase,'players':players,'active':a,'matchNo':r['matchNo'],'endedEarly':r['endedEarly'],'drawextra':out}}
def handle(r,pid,typ,obj,owner):
 p=r['drawextra'];phase=r['phase'];a=r['active'];g=r['game']
 if pid not in a:raise ValueError('参加できません')
 if g in ('artcontest','artforbid'):
  if typ=='paint_topic':
   t=obj.get('topic')
   if g!='artcontest' or not owner or phase!='px_draw' or p['drawings'] or not isinstance(t,str) or not 2<=len(t.strip())<=75:raise ValueError('変更できません')
   p['topic']=t.strip()
  elif typ=='paint_submit':
   if phase!='px_draw' or pid in p['drawings']:raise ValueError('提出できません')
   p['drawings'][pid]=strokes(obj.get('strokes'))
   if len(p['drawings'])==len(a):r['phase']='px_vote'
  elif typ=='paint_vote':
   target=obj.get('target');reports=obj.get('violations',[])
   if phase!='px_vote' or pid in p['votes'] or target==pid or target not in p['drawings']:raise ValueError('投票できません')
   if not isinstance(reports,list) or len(set(map(str,reports)))!=len(reports) or any(x==pid or x not in p['drawings'] for x in reports):raise ValueError('NGチェックが不正です')
   p['votes'][pid]=target;p['reports'][pid]=reports if g=='artforbid' else []
   if len(p['votes'])==len(a):finish_paint(r)
  elif typ=='paint_force':
   if not owner:raise ValueError('主催者のみです')
   if phase=='px_draw' and len(p['drawings'])>=2:r['phase']='px_vote'
   elif phase=='px_vote' and p['votes']:finish_paint(r)
   else:raise ValueError('まだ集計できません')
  elif typ=='paint_next':
   if not owner or phase!='px_reveal':raise ValueError('主催者のみです')
   if p['round']+1>=p['roundLimit']:r['phase']='final'
   else:p['round']+=1;new_paint(r)
  else:raise ValueError('操作を認識できません')
 else:
  if typ=='db_draw':
   if phase!='db_draw' or pid in p['drawings']:raise ValueError('提出できません')
   p['drawings'][pid]=strokes(obj.get('strokes'))
   if len(p['drawings'])==len(a):present(r)
  elif typ=='db_caption':
   txt=obj.get('text')
   if phase!='db_caption' or pid==p['author'] or pid in p['captions'] or not isinstance(txt,str) or not 2<=len(txt.strip())<=80:raise ValueError('偽タイトルを提出できません')
   p['captions'][pid]=txt.strip()
   if len(p['captions'])==len(a)-1:options(r)
  elif typ=='db_vote':
   k=obj.get('key')
   if phase!='db_vote' or pid==p['author'] or pid in p['votes'] or not isinstance(k,str) or not any(v['key']==k and v['owner']!=pid for v in p['options']):raise ValueError('投票できません')
   p['votes'][pid]=k
   if len(p['votes'])==len(a)-1:finish_bluff(r)
  elif typ=='db_force':
   if not owner:raise ValueError('主催者のみです')
   if phase=='db_caption' and p['captions']:options(r)
   elif phase=='db_vote' and p['votes']:finish_bluff(r)
   else:raise ValueError('まだ集計できません')
  elif typ=='db_next':
   if not owner or phase!='db_reveal':raise ValueError('主催者のみです')
   if p['cursor']+1>=len(a):r['phase']='final'
   else:p['cursor']+=1;present(r)
  else:raise ValueError('操作を認識できません')
