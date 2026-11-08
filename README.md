# なかみくらべ。

友達の選択を予想して遊ぶ4種類のゲーム。

## ① リンク版（サーバー不要）

リポジトリ直下の `index.html` がリンク版です。

GitHub の **Settings → Pages → Build and deployment** から **Deploy from a branch**、ブランチを `main`、フォルダを `/(root)` にして保存すると、公開先は通常 `https://okayuuun.github.io/tier/` です。公開が完了するまではアクセスできません。

主役が秘密の答えを作り、予想用リンクを友達に送信 → 友達が回答 → 結果リンクを主役に返送 → 主役が採点します。秘密の復元リンクは友達に送らないでください。

## ② リアルタイム版（サーバーが必要）

コード: `live/server.py` / `live/public/index.html` / `live/requirements.txt`。

Render にログインし **New → Web Service** でこの GitHub リポジトリを接続してください。

- Runtime: Python 3
- Build Command: `pip install -r live/requirements.txt`
- Start Command: `python live/server.py`
- Health Check Path: `/health`

またはリポジトリ直下の `render.yaml` を利用して Blueprint を作成できます。Render で発行される `https://....onrender.com/` がリアルタイム版のURLです。GitHub Pagesだけではリアルタイム版は動きません。

2〜12人でルームを作成し、全員の秘密回答を登録後、主役を交代しながら他の人が予想して採点します。ゲームはTier予想、重い？判定、究極の二択、理解度クイズ。サーバー再起動時はルームとスコアが消えます。個人情報や秘密は入力しないでください。

## Windowsでローカル起動

```powershell
py -m pip install -r live/requirements.txt
py live/server.py
```

`http://localhost:8080/` にアクセスしてください。

## 注意

このプロジェクトは試作品です。ユーザー認証や永続DBはありません。Render無料版はスリープや再起動でルームの状態が失われる場合があります。


## 追加ゲーム（2026-11-08）

**ことばの数値リレー**（2〜10人）：各自の秘密の数字1〜100をお題に沿う例えで伝え、みんなで小さい順に出す3ステージの協力ゲーム。独自お題55件。

**ひと言プロポーズ**（2〜12人）：配られた単語カード6枚と基本カード6枚を組み合わせ、審査役に即興告白。最も気に入った告白へ指輪を渡し、審査役を交代。独自単語277件。

**ひらめきのスープ**（2〜12人）：出題者が真相を秘密にし、回答者は「はい／いいえ／関係ありません」で答えられる質問から謎を解く。独自問題28問。出題者交代・ヒントあり。

上記3ゲームは既存作品の遊びの仕組みに着想を得た非公式のオリジナルミニゲームです。商用カード・問題集の文章は転載していません。

GitHubの最新コードをRenderで反映するには **Manual Deploy → Deploy latest commit** を押してください。サーバー上のルーム情報は再起動で初期化されます。
