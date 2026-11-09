"""Original multiplayer drawing games: product inventions and character commissions."""
import secrets
from collections import Counter
from draw_party import strokes

GAME_IDS = {"invent", "chardesign"}
EVENTS = {"inv_brief","inv_publish","inv_submit","inv_vote","inv_force","inv_next",
          "char_brief","char_publish","char_submit","char_pick","char_force","char_next"}
NEEDS = [
 "寝坊した朝を救いたい","ゲームのロード時間が長い","雨で荷物が濡れる","片方の靴下が消える",
 "猫に仕事を邪魔される","飲み物がすぐぬるくなる","勉強に集中できない","お菓子をすぐ食べてしまう",
 "出かける前に忘れ物をする","ホラーゲームが怖すぎる","部屋がすぐ散らかる","長い行列に並びたくない",
 "カラオケで次の曲が決まらない","映画を見ながら寝落ちする","写真で全員目を閉じる",
 "洗濯物をたたむのが面倒","配信中に飲み物をこぼす","イヤホンが絡まる",
 "友達との集合時間が決まらない","人前で話すと緊張する","部屋の温度が人によって違う",
 "買い物をすると袋が増える","毎回昼ごはんに悩む","夏のイベントが暑すぎる",
 "友達とゲームの好みが合わない","推しグッズを飾る場所がない","宿題にやる気が出ない",
 "自転車で坂を登りたくない","夜更かしが止まらない","机で眠ると首が痛い"]
TWISTS = ["ポケットに入る","猫でも使える","未来の技術っぽい","見た目だけは高級",
 "無駄に光る","音がかわいい","変身できる","少し不便なところがある",
 "100円ショップにありそう","学校でも使える","完全に手動","宇宙でも使える",
 "恥ずかしい見た目","二人で協力すると便利","食べ物に似ている","ゲームのアイテムみたい",
 "折りたためる","100年後のデザイン","感情があるように見える","とにかく丸い",
 "水に浮く","部屋に置くと会話が始まる","お年寄りにもやさしい"]
CHAR_ROLES = ["魔法学校の新入生","ラスボスの秘書","パン屋の店長","深海の郵便配達員",
 "宇宙船の整備士","モンスター専門の医者","未来都市のアイドル","古い図書館の番人",
 "砂漠の旅商人","秘密結社の見習い","王国の料理人","夜の喫茶店の店員",
 "雪国の発明家","ゲームのチュートリアル係","森を守る騎士","化石発掘チームのリーダー",
 "魔物に人気の美容師","記憶を集める探偵","時間旅行する学生","時計塔の修理屋",
 "動物の言葉がわかる警備員","おばけのお祭りの案内人","ドラゴンの保育士",
 "世界を旅する郵便屋","不思議な遊園地の園長"]
CHAR_TRAITS = ["片目を隠している","丸いシルエット","左右非対称の服","大きな帽子",
 "機械の腕","長いマフラー","メガネが特徴","動物が相棒","小さな羽根",
 "二色しか使わない","丸い鞄","王冠は禁止","大きな靴","目元に星形の印",
 "持ち物で職業が分かる","左右で髪色が違う","実は怖がり","笑顔が印象的",
 "巨大な鍵","袖が長い","かわいいけれど強そう","こわそうだけどやさしい",
 "小物を三つ持つ","背中に秘密がある","武器は禁止","水色がテーマカラー",
 "植物の模様がある","季節感がある","足元が個性的"]
RNG = secrets.SystemRandom()

def _text(v,label,minimum=1,maximum=100):
    if not isinstance(v,str) or not minimum <= len(v.strip()) <= maximum:
        raise ValueError(f"{label}は{minimum}〜{maximum}文字で入力してください")
    return v.strip()

def _name(r,pid):
    return r["players"][pid]["name"]

def _round(r):
    p=r["design"];a=r["active"];g=r["game"]
    p.update(submissions={}, votes={}, order=[], last=None)
    p["judge"]=a[p["round"]%len(a)] if g=="chardesign" else None
    if g=="invent":
        p["brief"]={"need":RNG.choice(NEEDS),"twist":RNG.choice(TWISTS)}
        r["phase"]="inv_brief"
    else:
        c1,c2=RNG.sample(CHAR_TRAITS,2)
        p["brief"]={"role":RNG.choice(CHAR_ROLES),"condition1":c1,"condition2":c2}
        r["phase"]="char_brief"

def start(r):
    if len(r["active"])<2:raise ValueError("2人以上で参加してください")
    r["design"]={"round":0,"roundLimit":min(4,len(r["active"])) if r["game"]=="chardesign" else 3,"history":[]}
    _round(r)

def _shuffle(p):
    p["order"]=list(p["submissions"]);RNG.shuffle(p["order"])

def _complete_invent(r):
    p=r["design"];counts=Counter(p["votes"].values())
    for pid,count in counts.items():r["points"][pid]+=2*count
    rows=[dict(id=pid,name=_name(r,pid),votes=counts.get(pid,0),**s)
          for pid,s in p["submissions"].items()]
    high=max(counts.values(),default=0)
    p["last"]={"round":p["round"]+1,"brief":dict(p["brief"]),"entries":rows,
               "winners":[x["id"] for x in rows if high and x["votes"]==high]}
    p["history"].append(p["last"]);r["phase"]="inv_reveal"

def _complete_char(r,winner):
    p=r["design"];r["points"][winner]+=3
    p["last"]={"round":p["round"]+1,"brief":dict(p["brief"]),"clientName":_name(r,p["judge"]),
               "winner":winner,"winnerName":_name(r,winner),
               "entries":[dict(id=k,name=_name(r,k),**v) for k,v in p["submissions"].items()]}
    p["history"].append(p["last"]);r["phase"]="char_reveal"

def snapshot(r,pid):
    p=r["design"];phase=r["phase"];a=r["active"]
    result={"round":p["round"],"roundLimit":p["roundLimit"],"brief":dict(p["brief"]),
            "judge":p["judge"],"judgeName":_name(r,p["judge"]) if p["judge"] else "",
            "submitted":pid in p["submissions"],"submittedCount":len(p["submissions"]),
            "needed":len(a)-(1 if p["judge"] else 0),
            "voted":pid in p["votes"],"voteCount":len(p["votes"]),
            "entries":[dict(id=k,mine=k==pid,**p["submissions"][k]) for k in p["order"]]
              if phase in ("inv_vote","char_pick") else [],
            "last":p["last"] if phase in ("inv_reveal","char_reveal","final") else None,
            "history":p["history"] if phase=="final" else []}
    players=[{"id":k,"name":_name(r,k),"score":r["points"].get(k,0),
              "online":bool(v["ws"] and not v["ws"].closed),
              "avatar":v.get("avatar",""),"emoji":v.get("emoji","🌷")}
             for k,v in r["players"].items()]
    return {"type":"state","me":pid,"room":{
        "code":r["code"],"owner":r["owner"],"game":r["game"],"phase":phase,
        "players":players,"active":a,"matchNo":r["matchNo"],
        "endedEarly":r.get("endedEarly",False),"design":result}}

def handle(r,pid,t,obj,host):
    p=r["design"];phase=r["phase"];a=r["active"];g=r["game"]
    if pid not in a:raise ValueError("参加者ではありません")
    if g=="invent":
        if t=="inv_brief":
            if not host or phase!="inv_brief":raise ValueError("主催者だけがお題を変更できます")
            p["brief"]={"need":_text(obj.get("need"),"悩み",2,85),
                        "twist":_text(obj.get("twist"),"条件",2,85)}
        elif t=="inv_publish":
            if not host or phase!="inv_brief":raise ValueError("主催者だけが開始できます")
            r["phase"]="inv_create"
        elif t=="inv_submit":
            if phase!="inv_create" or pid in p["submissions"]:raise ValueError("今は提出できません")
            p["submissions"][pid]={
                "product":_text(obj.get("product"),"商品名",2,45),
                "catchphrase":_text(obj.get("catchphrase"),"キャッチコピー",2,85),
                "pitch":_text(obj.get("pitch"),"説明",5,240),
                "strokes":strokes(obj.get("strokes"))}
            if len(p["submissions"])==len(a):_shuffle(p);r["phase"]="inv_vote"
        elif t=="inv_vote":
            if phase!="inv_vote" or pid in p["votes"]:raise ValueError("今は投票できません")
            target=obj.get("target")
            if target not in p["submissions"] or target==pid:raise ValueError("自分の作品には投票できません")
            p["votes"][pid]=target
            if len(p["votes"])==len(a):_complete_invent(r)
        elif t=="inv_force":
            if not host:raise ValueError("主催者だけが進行できます")
            if phase=="inv_create" and len(p["submissions"])>=2:_shuffle(p);r["phase"]="inv_vote"
            elif phase=="inv_vote" and p["votes"]:_complete_invent(r)
            else:raise ValueError("2作品または1票以上が必要です")
        elif t=="inv_next":
            if not host or phase!="inv_reveal":raise ValueError("主催者だけが進行できます")
            if p["round"]+1>=p["roundLimit"]:r["phase"]="final"
            else:p["round"]+=1;_round(r)
        else:raise ValueError("この操作は利用できません")
    elif g=="chardesign":
        client=pid==p["judge"]
        if t=="char_brief":
            if phase!="char_brief" or not client:raise ValueError("依頼人だけが変更できます")
            p["brief"]={key:_text(obj.get(key),key,2,85) for key in ("role","condition1","condition2")}
        elif t=="char_publish":
            if phase!="char_brief" or not client:raise ValueError("依頼人だけが開始できます")
            r["phase"]="char_create"
        elif t=="char_submit":
            if phase!="char_create" or client or pid in p["submissions"]:raise ValueError("今は提出できません")
            p["submissions"][pid]={
                "character":_text(obj.get("character"),"キャラクター名",2,45),
                "concept":_text(obj.get("concept"),"デザイン意図",5,220),
                "strokes":strokes(obj.get("strokes"))}
            if len(p["submissions"])==len(a)-1:_shuffle(p);r["phase"]="char_pick"
        elif t=="char_pick":
            if phase!="char_pick" or not client:raise ValueError("依頼人だけが採用できます")
            if obj.get("target") not in p["submissions"]:raise ValueError("作品がありません")
            _complete_char(r,obj["target"])
        elif t=="char_force":
            if not host or phase!="char_create" or not p["submissions"]:raise ValueError("主催者が進行できます")
            _shuffle(p);r["phase"]="char_pick"
        elif t=="char_next":
            if not host or phase!="char_reveal":raise ValueError("主催者だけが進行できます")
            if p["round"]+1>=p["roundLimit"]:r["phase"]="final"
            else:p["round"]+=1;_round(r)
        else:raise ValueError("この操作は利用できません")
    else:raise ValueError("未知のゲームです")
