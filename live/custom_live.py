"""Real-time play for locally authored Atelier game sets.
Answers/solutions stay on the server until a round is revealed.
No database; room data is discarded on restart.
"""
import json
import re
from copy import deepcopy

KIND_LIMITS = {'tier': 15, 'quiz': 30, 'either': 30, 'value': 30, 'soup': 20}
OPTION_COUNT = {'quiz': 4, 'either': 2, 'value': 3}
EVENTS = {'studio_import', 'studio_guess', 'studio_next', 'studio_ask', 'studio_reply',
          'studio_hint', 'studio_solve', 'studio_resolve'}
IMAGE_PATTERN = re.compile(r'^(?:data:image/(?:webp|jpeg|png);base64,[A-Za-z0-9+/=]+|https://[^\s<>"\']{1,1000})$')


def clean_image(value):
    if value in ('', None):
        return ''
    if not isinstance(value, str) or len(value) > 90000 or not IMAGE_PATTERN.fullmatch(value):
        raise ValueError('画像は8万文字以下のJPEG・PNG・WebPか、https画像URLを指定してください')
    return value


def nonempty(value, limit, hint):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError(hint)
    return value.strip()


def validate_game(payload):
    """Whitelist fields and validate the entire upload, including image budgets."""
    if not isinstance(payload, dict) or payload.get('game') not in KIND_LIMITS:
        raise ValueError('アトリエのゲーム形式が違います')
    if len(json.dumps(payload, ensure_ascii=False).encode('utf-8')) > 650000:
        raise ValueError('画像を減らしてください。リアルタイム用は650KBまでです')
    kind = payload['game']
    title = nonempty(payload.get('title'), 100, 'セットのタイトルが不正です')
    config = payload.get('config')
    truth = payload.get('truth')
    if not isinstance(config, dict):
        raise ValueError('問題セットが不正です')
    if kind == 'tier':
        raw = config.get('rounds')
        if not isinstance(raw, list) or not 1 <= len(raw) <= KIND_LIMITS[kind] or not isinstance(truth, list) or len(raw) != len(truth):
            raise ValueError('Tier表の問題数や正解が不正です')
        rounds = []
        fixed_truth = []
        for pos, r in enumerate(raw):
            if not isinstance(r, dict) or not isinstance(r.get('items'), list) or len(r['items']) != 5:
                raise ValueError('Tier表には候補が5つ必要です')
            items = [nonempty(x, 80, 'Tier候補を確認してください') for x in r['items']]
            if len(set(items)) != 5:
                raise ValueError('Tier候補が重複しています')
            imgs = r.get('itemImages') or ['', '', '', '', '']
            if not isinstance(imgs, list) or len(imgs) != 5:
                raise ValueError('候補画像の数が違います')
            ans = truth[pos]
            if not isinstance(ans, list) or len(ans) != 5 or any(type(v) is not int for v in ans) or set(ans) != set(range(5)):
                raise ValueError('Tierの正解が不正です')
            rounds.append({'title': nonempty(r.get('title'), 100, 'Tier表のお題がありません'),
                           'items': items, 'image': clean_image(r.get('image')),
                           'itemImages': [clean_image(x) for x in imgs]})
            fixed_truth.append(ans[:])
    elif kind == 'soup':
        raw = config.get('puzzles')
        if not isinstance(raw, list) or not 1 <= len(raw) <= KIND_LIMITS[kind]:
            raise ValueError('ウミガメのスープの問題数が不正です')
        rounds, fixed_truth = [], []
        for p in raw:
            if not isinstance(p, dict):
                raise ValueError('問題データが不正です')
            situation = nonempty(p.get('situation'), 1500, '問題文を確認してください')
            solution = nonempty(p.get('solution'), 3000, '真相を確認してください')
            hints = p.get('hints') or []
            if not isinstance(hints, list) or len(hints) > 3 or any(not isinstance(h, str) or len(h) > 300 for h in hints):
                raise ValueError('ヒントは3つまでです')
            rounds.append({'situation': situation, 'image': clean_image(p.get('image'))})
            fixed_truth.append({'solution': solution, 'hints': hints})
    else:
        raw = config.get('qs')
        if not isinstance(raw, list) or not 1 <= len(raw) <= KIND_LIMITS[kind] or not isinstance(truth, list) or len(raw) != len(truth):
            raise ValueError('クイズの問題数や正解が不正です')
        rounds, fixed_truth = [], []
        for pos, q in enumerate(raw):
            if not isinstance(q, dict) or not isinstance(q.get('options'), list) or len(q['options']) != OPTION_COUNT[kind]:
                raise ValueError('選択肢の数が違います')
            opts = [nonempty(x, 160, '選択肢を入力してください') for x in q['options']]
            if len(set(opts)) != len(opts):
                raise ValueError('選択肢が重複しています')
            imgs = q.get('optionImages') or [''] * len(opts)
            if not isinstance(imgs, list) or len(imgs) != len(opts):
                raise ValueError('選択肢画像の数が違います')
            ans = truth[pos]
            if type(ans) is not int or not 0 <= ans < len(opts):
                raise ValueError('正解が選択肢の範囲外です')
            rounds.append({'q': nonempty(q.get('q'), 300, '質問文がありません'),
                           'options': opts, 'image': clean_image(q.get('image')),
                           'optionImages': [clean_image(x) for x in imgs]})
            fixed_truth.append(ans)
    return {'game': kind, 'title': title, 'rounds': rounds, 'truth': fixed_truth}


def public_meta(data):
    return {'game': data['game'], 'title': data['title'], 'count': len(data['rounds']),
            'hasImages': any(x.get('image') or any(x.get(k) for k in ('itemImages', 'optionImages')) for x in data['rounds'])}


def start(room):
    c = room['custom']
    room['studioIndex'] = 0
    room['studioAnswers'] = {}
    room['studioLog'] = []
    room['studioHints'] = 0
    room['studioHistory'] = []
    room['phase'] = 'studio_soup' if c['game'] == 'soup' else 'studio_guess'


def snapshot(room, pid):
    c = room['custom']
    index = room.get('studioIndex', 0)
    current = c['rounds'][index] if index < len(c['rounds']) else None
    phase = room['phase']
    revealed = phase in ('studio_reveal', 'final')
    info = {'title': c['title'], 'game': c['game'], 'count': len(c['rounds']),
            'index': index, 'item': current, 'answered': len(room['studioAnswers']),
            'hasAnswered': pid in room['studioAnswers'],
            'history': room['studioHistory'] if phase == 'final' else None,
            'last': room['studioHistory'][-1] if phase in ('studio_reveal', 'final') and room['studioHistory'] else None}
    if c['game'] == 'soup':
        info['logs'] = deepcopy(room['studioLog'])
        info['hints'] = c['truth'][index]['hints'][:room['studioHints']] if current and index < len(c['truth']) else []
        if current and (pid == room['owner'] or revealed):
            info['solution'] = c['truth'][index]['solution']
            info['privateHints'] = c['truth'][index]['hints'] if pid == room['owner'] else None
    elif revealed and current:
        info['truth'] = deepcopy(c['truth'][index])
    # Never include other rounds' answers until final, nor include any truth before reveal.
    return info


def validate_guess(c, index, guess):
    if c['game'] == 'tier':
        if not isinstance(guess, list) or len(guess) != 5 or any(type(x) is not int for x in guess) or set(guess) != set(range(5)):
            raise ValueError('5つの候補をS〜Dに並べてください')
    else:
        if type(guess) is not int or not 0 <= guess < len(c['rounds'][index]['options']):
            raise ValueError('選択肢を1つ選んでください')


def reveal(room, winner=None):
    c = room['custom']
    idx = room['studioIndex']
    truth = c['truth'][idx]
    result = []
    if c['game'] == 'soup':
        for pid, p in room['players'].items():
            if pid == winner:
                room['points'][pid] += 3
        rec = {'index': idx, 'item': c['rounds'][idx], 'truth': truth['solution'],
               'logs': deepcopy(room['studioLog']),
               'winner': room['players'].get(winner, {}).get('name') if winner else None}
    else:
        for pid, guess in room['studioAnswers'].items():
            points = sum(x == y for x,y in zip(truth, guess)) if c['game'] == 'tier' else int(guess == truth)
            room['points'][pid] += points
            result.append({'id': pid, 'name': room['players'][pid]['name'], 'guess': guess, 'points': points})
        rec = {'index': idx, 'item': c['rounds'][idx], 'truth': deepcopy(truth), 'rows': result}
    room['studioHistory'].append(rec)
    room['phase'] = 'studio_reveal'


def handle(room, pid, t, obj, is_owner):
    phase = room['phase']
    if t == 'studio_import':
        if not is_owner or phase != 'lobby':
            raise ValueError('ルーム作成者が待機画面で読み込んでください')
        c = validate_game(obj.get('challenge'))
        room['custom'] = c
        room['game'] = c['game']
        room['points'] = {key: 0 for key in room['players']}
        return
    c = room.get('custom')
    if not c or phase == 'lobby':
        raise ValueError('自作ゲームが開始されていません')
    if t == 'studio_guess':
        if phase != 'studio_guess' or pid == room['owner'] or pid not in room['active'] or pid in room['studioAnswers']:
            raise ValueError('今は回答できません')
        guess = obj.get('guess')
        validate_guess(c, room['studioIndex'], guess)
        room['studioAnswers'][pid] = guess
        if all(key in room['studioAnswers'] for key in room['active'] if key != room['owner']):
            reveal(room)
    elif t == 'studio_ask':
        if phase != 'studio_soup' or pid == room['owner'] or pid not in room['active']:
            raise ValueError('今は質問できません')
        msg = nonempty(obj.get('text'), 250, '質問を入力してください')
        if len(room['studioLog']) >= 90:
            raise ValueError('この問題では質問が上限です')
        room['studioLog'].append({'id': len(room['studioLog']), 'name': room['players'][pid]['name'],
                                  'pid': pid, 'text': msg, 'kind': 'solve' if obj.get('solve') else 'ask', 'verdict': None})
    elif t == 'studio_reply':
        if phase != 'studio_soup' or not is_owner:
            raise ValueError('出題者だけが判定できます')
        entry = next((x for x in room['studioLog'] if x['id'] == obj.get('id')), None)
        if not entry or entry['verdict'] is not None:
            raise ValueError('質問が見つからないか回答済みです')
        verdict = obj.get('verdict')
        if verdict not in ('yes', 'no', 'irrelevant', 'wrong'):
            raise ValueError('回答を確認してください')
        entry['verdict'] = verdict
    elif t == 'studio_hint':
        if phase != 'studio_soup' or not is_owner:
            raise ValueError('出題者だけがヒントを出せます')
        room['studioHints'] = min(len(c['truth'][room['studioIndex']]['hints']), room['studioHints'] + 1)
    elif t == 'studio_resolve':
        if phase != 'studio_soup' or not is_owner:
            raise ValueError('出題者だけが真相を公開できます')
        winner = obj.get('winner')
        if winner is not None and (winner not in room['active'] or winner == room['owner']):
            raise ValueError('正解者を確認してください')
        reveal(room, winner)
    elif t == 'studio_next':
        if phase != 'studio_reveal' or not is_owner:
            raise ValueError('ルーム作成者だけが次へ進めます')
        room['studioIndex'] += 1
        room['studioAnswers'] = {}
        room['studioLog'] = []
        room['studioHints'] = 0
        if room['studioIndex'] >= len(c['rounds']):
            room['phase'] = 'final'
        else:
            room['phase'] = 'studio_soup' if c['game'] == 'soup' else 'studio_guess'
    else:
        raise ValueError('この操作は使えません')
