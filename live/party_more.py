"""Additional original realtime party minigames, server-authoritative and privacy-aware."""
import secrets
import unicodedata
import re

GAME_IDS = {'describe', 'drawfake', 'mysterymail'}
EVENTS = {'desc_clue','desc_guess','desc_skip','desc_next', 'draw_stroke','draw_vote','draw_guess','draw_next', 'mail_answer','mail_hint','mail_next'}

WORDS = [
'エレベーター','ワイヤレスイヤホン','パソコン','インターネット','サンドイッチ','ハンバーガー','アイスクリーム','ジェットコースター','シャンプー','チョコレート','リュックサック','スポーツカー','キャンプ','アニメーション','オーケストラ','テレワーク','マイク','タイマー','リモコン','ピザ','スマートフォン','グループチャット','サングラス','ゲームパッド','ディスプレイ','タッチパネル','アラーム','プレゼント','カメラ','ショッピングモール','ドラマ','ロケット','ミュージカル','マラソン','コンサート','レストラン','ホテル','テーブル','メッセージ','メール','ポップコーン','チーズケーキ','パスポート','ドライヤー','ペンライト','テレビ','クッキー','パーティー','カーテン','ロボット','スイーツ','バスケットボール','フィギュア','ストリーミング','バーチャル','カレンダー','マフラー','ウインナー','マシュマロ','ドーナツ','サイクリング','ヘッドホン','オムライス'
]
MODIFIERS=['ふつうに説明','たとえ話だけで','質問の形で説明','一文だけで説明','動作を言葉で説明','料理人になったつもりで説明']
DRAW_WORDS=[('動物','ペンギン'),('生き物','タコ'),('食べ物','たこ焼き'),('食べ物','いちご'),('自然','ひまわり'),('乗り物','自転車'),('建物','学校'),('建物','お城'),('道具','かさ'),('道具','はさみ'),('生き物','カエル'),('食べ物','おにぎり'),('場所','温泉'),('場所','遊園地'),('動物','キリン'),('動物','うさぎ'),('食べ物','ラーメン'),('季節','雪だるま'),('道具','時計'),('乗り物','新幹線'),('自然','虹'),('動物','ねこ'),('道具','歯ブラシ'),('食べ物','スイカ'),('道具','鍵'),('場所','図書館'),('乗り物','飛行機'),('動物','さかな'),('季節','クリスマスツリー'),('道具','メガネ'),('自然','火山'),('食べ物','プリン')]
# Every scenario is original. Codes are supported by evidence shown to all players.
MAIL_CASES=[
 {'name':'消えた招待状','intro':'友達から届いた3通の連絡を調べ、約束の場所を突き止めよう。', 'steps':[
 {'title':'最初の暗号','mail':[('友達','件名：日時のメモ','集合は11月09日。暗証番号は月と日の数字を、月→日の順で4桁にしてね。'),('会場受付','数字について','途中に空白や記号は入れないでください。')], 'prompt':'受付の暗証番号4桁は？','answers':['1109'],'hint':['月は11、日は09。','月を先にして4桁を作る。']},
 {'title':'棚のメモ','mail':[('受付','件名：保管棚','赤い札には「3」、青い札には「8」、黄色い札には「1」が書かれている。'),('友達','件名：順番が大事','信号機を思い出して。左から並ぶ色の順に番号を入力して。')], 'prompt':'保管棚の数字3桁は？','answers':['318'],'hint':['信号機の一般的な並びは赤・黄・青。','赤3→黄1→青8。']},
 {'title':'最後の確認','mail':[('受付','件名：最終確認','入場する部屋は「虹」「橋」「星」の3つ。'),('友達','件名：部屋の名前','空を見上げれば見えるものが正解。昼間の雨上がりに見えるよ。')], 'prompt':'入場する部屋の名前は？','answers':['虹','にじ'],'hint':['雨と太陽が関係する。','七色の弧。']}]},
 {'name':'夜の図書館','intro':'返却された本に挟まれた連絡から、置き忘れた品物の場所を探す。','steps':[
 {'title':'奇妙な目録','mail':[('司書','件名：返却記録','記録: 1番=猫、2番=花、3番=月。見つかったメモには「月・猫・花」とある。'),('司書補助','件名：検索方法','メモに書かれた順番を数字に直すと棚が分かる。')], 'prompt':'棚番号3桁は？','answers':['312'],'hint':['月は3番。','月・猫・花 → 3・1・2。']},
 {'title':'本の目印','mail':[('古いメモ','件名：しおり','東の棚の青い本に「北」、西の棚の緑の本に「南」、南の棚の赤い本に「東」。'),('司書','件名：取り出し方','一番上にある本は西の棚の緑の本だ。そこに書かれた文字を入力して。')], 'prompt':'取り出し用の漢字1字は？','answers':['南'],'hint':['棚の方角と、本に書かれた文字を混同しないで。','西の棚の緑の本は「南」。']},
 {'title':'取り違えた曜日','mail':[('利用者','件名：昨日の忘れ物','私は金曜日に来ました。忘れ物に気づいたのは来館した翌々日です。'),('司書','件名：受け渡し','曜日を漢字1字で教えて。')], 'prompt':'気づいた曜日は？','answers':['日','日曜日'],'hint':['翌々日は2日後。','金→土→日。']}]},
 {'name':'届かなかった配達','intro':'配達員から届いた情報が食い違っている。荷物の行き先を特定しよう。','steps':[
 {'title':'配達順','mail':[('配送担当','件名：3件の届け先','A=公園、B=駅、C=学校。配達順はC、A、Bでした。'),('問い合わせ','件名：番号','配達順を英字3文字で入力してください。')], 'prompt':'配達順の記号は？','answers':['CAB'],'hint':['配達先名ではなく記号。','C→A→B。']},
 {'title':'ビルの階','mail':[('受付','件名：エレベーター','地上4階から2階上がり、1階下がったところで止まりました。'),('配送担当','件名：停止した階','止まった階の数字を教えて。')], 'prompt':'止まった階は何階？','answers':['5','5階'],'hint':['4+2-1。','4階→6階→5階。']},
 {'title':'部屋番号','mail':[('メモ','件名：部屋','右から読むと「205」になる番号の部屋へ。'),('担当','件名：確認','今度は左から読んで入力して。')], 'prompt':'部屋番号は？','answers':['502'],'hint':['3桁を逆順に。','205を右から読んだ形に戻す。']}]},
 {'name':'壊れた時計','intro':'時刻の数字が消えた端末から、最後の操作を復元する。','steps':[
 {'title':'残された時刻','mail':[('端末','件名：記録','開始は14:20。作業は35分続きました。'),('利用者','件名：終了','終了時刻を4桁で入力して。')], 'prompt':'終了時刻は？','answers':['1455'],'hint':['分に35を足す。','20+35=55分。']},
 {'title':'数字の規則','mail':[('端末','件名：規則','2、4、8、16、？'),('管理者','件名：復旧','続く数字を入力すると次の画面へ進める。')], 'prompt':'次の数は？','answers':['32'],'hint':['毎回2倍。','16×2。']},
 {'title':'止まった曜日','mail':[('記録','件名：昨日','昨日は水曜日でした。'),('端末','件名：再起動','明後日の曜日を漢字で入力して。')], 'prompt':'明後日は何曜日？','answers':['土','土曜日'],'hint':['今日は木曜日。','明日は金曜日、その次は土曜日。']}]},
 {'name':'舞台裏の伝言','intro':'舞台監督が残したメモから、公演の最終確認を解く。','steps':[
 {'title':'照明の番号','mail':[('照明係','件名：色','白=4、赤=7、青=2、緑=9。点灯順は緑→青→赤。'),('監督','件名：入力','点灯順の数字3桁を入力。')], 'prompt':'照明コードは？','answers':['927'],'hint':['緑は9、青は2。','緑9→青2→赤7。']},
 {'title':'幕が上がる','mail':[('舞台係','件名：開幕','開演予定は18:10。10分早め、さらに5分遅らせることになった。'),('監督','件名：確定','確定時刻を4桁の数字に。')], 'prompt':'確定した開演時刻は？','answers':['1805'],'hint':['先に10分引き、後で5分足す。','18:10→18:00→18:05。']},
 {'title':'主役の席','mail':[('座席表','件名：客席','A列は前、B列は中央、C列は後ろ。主役の席は中央列の3番。'),('監督','件名：席番号','列の英字と数字をつなげて入力。')], 'prompt':'席番号は？','answers':['B3'],'hint':['中央はB列。','Bと3をつなぐ。']}]}
]


def key(value):
    return ''.join(unicodedata.normalize('NFKC', str(value)).casefold().split())


def new_desc(room):
    p=room['more'];players=room['active'];used=p['used'];pool=[w for w in WORDS if w not in used] or WORDS[:]
    word=secrets.choice(pool);used.append(word)
    p.update(word=word,modifier=secrets.choice(MODIFIERS),explainer=players[p['round']%len(players)],clue='',guesses=[],last=None)
    room['phase']='desc_clue'


def new_draw(room):
    p=room['more'];players=room['active'];host=players[p['round']%len(players)];paint=[x for x in players if x!=host]
    category,word=secrets.choice(DRAW_WORDS)
    p.update(host=host,faker=secrets.choice(paint),category=category,word=word,order=paint*2,cursor=0,strokes=[],votes={},last=None)
    room['phase']='draw_stroke'


def new_mail(room):
    p=room['more'];p.update(case=MAIL_CASES[p['round']%len(MAIL_CASES)],step=0,hintCount=0,attempts=[],last=None)
    room['phase']='mail_stage'


def start(room):
    players=room['active'];g=room['game'];
    if g=='describe':
        if len(players)<3:raise ValueError('言葉の説明ゲームは3人以上で遊べます')
        room['more']={'round':0,'roundLimit':6,'used':[],'history':[]};new_desc(room)
    elif g=='drawfake':
        if len(players)<5:raise ValueError('お絵描き正体隠匿は5人以上で遊べます')
        room['more']={'round':0,'roundLimit':3,'history':[]};new_draw(room)
    elif g=='mysterymail':
        if len(players)<2:raise ValueError('謎解きメールは2人以上で遊べます')
        room['more']={'round':0,'roundLimit':3,'history':[]};new_mail(room)
    else:raise ValueError('ゲームを認識できません')


def snapshot(room,pid):
    g=room['game'];p=room['more'];phase=room['phase'];active=room['active']
    players=[{'id':x['id'],'name':x['name'],'score':room['points'].get(x['id'],0),'online':bool(x['ws'] and not x['ws'].closed),'avatar':x.get('avatar',''),'emoji':x.get('emoji','🌷')} for x in room['players'].values()]
    out={'round':p['round'],'roundLimit':p['roundLimit']}
    if g=='describe':
        out.update(explainer=p['explainer'],modifier=p['modifier'],clue=p['clue'],attempts=p['guesses'][-36:],attemptCount=sum(x['pid']==pid for x in p['guesses']),word=p['word'] if pid==p['explainer'] or phase in ('desc_reveal','final') else None,last=p['last'] if phase in ('desc_reveal','final') else None,history=p['history'] if phase=='final' else [])
    if g=='drawfake':
        isfake=pid==p['faker'];host=pid==p['host']
        out.update(category=p['category'],myRole='host' if host else 'faker' if isfake else 'artist',word=p['word'] if not isfake or phase in ('draw_reveal','final') else None,host=p['host'],turn=p['order'][p['cursor']] if phase=='draw_stroke' else None,turnNo=p['cursor']+1,totalTurns=len(p['order']),strokes=p['strokes'],myVote=p['votes'].get(pid),votedCount=len(p['votes']),canGuess=isfake and phase=='draw_guess',last=p['last'] if phase in ('draw_reveal','final') else None,history=p['history'] if phase=='final' else [])
    if g=='mysterymail':
        case=p['case'];stage=case['steps'][p['step']]
        out.update(caseTitle=case['name'],intro=case['intro'],step=p['step'],stepCount=len(case['steps']),stepTitle=stage['title'],messages=[{'sender':a,'subject':b,'text':c} for a,b,c in stage['mail']],question=stage['prompt'],hints=stage['hint'][:p['hintCount']],attempts=p['attempts'][-24:],last=p['last'] if phase in ('mail_reveal','final') else None,history=p['history'] if phase=='final' else [])
    return {'type':'state','me':pid,'room':{'code':room['code'],'owner':room['owner'],'game':g,'phase':phase,'players':players,'active':active,'matchNo':room['matchNo'],'endedEarly':room['endedEarly'],'more':out}}


def finish_draw(room,guess=''):
    p=room['more'];fake=p['faker'];votes=p['votes'];counts={id:0 for id in room['active']}
    for id in votes.values():counts[id]+=1
    caught=bool(votes) and counts[fake]>0 and counts[fake]==max(counts.values()) and list(counts.values()).count(counts[fake])==1
    guessed=key(guess)==key(p['word']) if guess else False
    if not caught or guessed:room['points'][fake]+=3
    else:
        for pid,v in votes.items():
            if v==fake:room['points'][pid]+=2
    record={'round':p['round']+1,'category':p['category'],'word':p['word'],'faker':fake,'fakeName':room['players'][fake]['name'],'caught':caught,'guessed':guessed,'strokes':p['strokes'][:],'votes':[{'pid':k,'target':v} for k,v in votes.items()]}
    p['last']=record;p['history'].append(record);room['phase']='draw_reveal'


def handle(room,pid,typ,obj,is_owner):
    p=room['more'];phase=room['phase'];g=room['game'];players=room['active']
    if pid not in players:raise ValueError('このゲームには参加していません')
    if g=='describe':
        if typ=='desc_clue':
            if phase!='desc_clue' or pid!=p['explainer']:raise ValueError('今回の説明担当者だけが説明できます')
            clue=str(obj.get('text','')).strip()
            if not 2<=len(clue)<=150 or re.search('[\u30a1-\u30fa\u30fc\u30fd\u30fe]',clue) or key(p['word']) in key(clue):raise ValueError('カタカナを使わず、正解を含めない150字以内の説明にしてください')
            p['clue']=clue;room['phase']='desc_guess'
        elif typ=='desc_guess':
            if phase!='desc_guess' or pid==p['explainer']:raise ValueError('今は回答できません')
            if sum(x['pid']==pid for x in p['guesses'])>=5:raise ValueError('このラウンドの回答は5回までです')
            ans=str(obj.get('text','')).strip()[:80]
            if not ans:raise ValueError('回答を入力してください')
            good=key(ans)==key(p['word']);p['guesses'].append({'pid':pid,'name':room['players'][pid]['name'],'text':ans,'correct':good})
            if good:
                room['points'][pid]+=2;room['points'][p['explainer']]+=1
                p['last']={'word':p['word'],'winner':pid,'winnerName':room['players'][pid]['name'],'clue':p['clue'],'attempts':p['guesses'][:]}
                p['history'].append(p['last']);room['phase']='desc_reveal'
        elif typ=='desc_skip':
            if not is_owner or phase not in ('desc_guess','desc_clue'):raise ValueError('主催者が問題を公開できます')
            p['last']={'word':p['word'],'winner':None,'winnerName':None,'clue':p['clue'],'attempts':p['guesses'][:]};p['history'].append(p['last']);room['phase']='desc_reveal'
        elif typ=='desc_next':
            if not is_owner or phase!='desc_reveal':raise ValueError('主催者が次へ進めます')
            if p['round']+1>=p['roundLimit']:room['phase']='final'
            else:p['round']+=1;new_desc(room)
        else:raise ValueError('無効な操作です')
    elif g=='drawfake':
        if typ=='draw_stroke':
            if phase!='draw_stroke' or p['order'][p['cursor']]!=pid:raise ValueError('今はあなたの描画番ではありません')
            points=obj.get('points')
            if not isinstance(points,list) or not 2<=len(points)<=150:raise ValueError('線を描いて送信してください')
            clean=[]
            for xy in points:
                if not isinstance(xy,list) or len(xy)!=2 or any(type(n)!=int or n<0 or n>1000 for n in xy):raise ValueError('描画データの範囲が不正です')
                clean.append(xy)
            p['strokes'].append({'pid':pid,'name':room['players'][pid]['name'],'points':clean})
            p['cursor']+=1
            if p['cursor']>=len(p['order']):room['phase']='draw_vote'
        elif typ=='draw_vote':
            target=obj.get('target')
            if phase!='draw_vote' or pid==p['host'] or pid in p['votes'] or target not in p['order'] or target==pid:
                raise ValueError('自分以外の絵を描いた人に投票してください')
            p['votes'][pid]=target
            if len(p['votes'])==len(players)-1:
                counts={id:list(p['votes'].values()).count(id) for id in players}
                fake=p['faker'];caught=counts[fake]>0 and counts[fake]==max(counts.values()) and list(counts.values()).count(counts[fake])==1
                if caught:room['phase']='draw_guess'
                else:finish_draw(room)
        elif typ=='draw_guess':
            if phase!='draw_guess' or pid!=p['faker']:raise ValueError('エセ役だけが答えられます')
            finish_draw(room,str(obj.get('text','')).strip()[:60])
        elif typ=='draw_next':
            if not is_owner or phase!='draw_reveal':raise ValueError('主催者が次へ進めます')
            if p['round']+1>=p['roundLimit']:room['phase']='final'
            else:p['round']+=1;new_draw(room)
        else:raise ValueError('無効な操作です')
    elif g=='mysterymail':
        if typ=='mail_answer':
            if phase!='mail_stage':raise ValueError('今は回答できません')
            answer=str(obj.get('text','')).strip()[:70]
            if not answer:raise ValueError('回答を入力してください')
            stage=p['case']['steps'][p['step']];correct=key(answer) in {key(x) for x in stage['answers']}
            p['attempts'].append({'pid':pid,'name':room['players'][pid]['name'],'text':answer,'correct':correct})
            if correct:
                room['points'][pid]+=3
                p['last']={'step':p['step'],'answer':stage['answers'][0],'winner':room['players'][pid]['name'],'title':stage['title']}
                if p['step']+1>=len(p['case']['steps']):
                    p['history'].append({'title':p['case']['name'],'steps':len(p['case']['steps']),'solved':True})
                    room['phase']='mail_reveal'
                else:
                    p['step']+=1;p['hintCount']=0;p['attempts']=[]
        elif typ=='mail_hint':
            if not is_owner or phase!='mail_stage':raise ValueError('主催者がヒントを出せます')
            p['hintCount']=min(p['hintCount']+1,len(p['case']['steps'][p['step']]['hint']))
        elif typ=='mail_next':
            if not is_owner or phase!='mail_reveal':raise ValueError('主催者が次へ進めます')
            if p['round']+1>=p['roundLimit']:room['phase']='final'
            else:p['round']+=1;new_mail(room)
        else:raise ValueError('無効な操作です')