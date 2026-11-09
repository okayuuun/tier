"""誰のエピソード？ — anonymous stories, private guesses and synchronized reveal.

Only an author's own submission is identified before reveal. No authorship,
guesses, or scoring are broadcast while votes are still being collected.
"""
import secrets

GAME_IDS = {'episode'}
EVENTS = {'ep_topic', 'ep_submit', 'ep_guess', 'ep_force', 'ep_next'}
TOPICS = [
    '人生でいちばん焦った瞬間',
    '今だから笑える失敗談',
    '子どものころ勘違いしていたこと',
    'いまだに覚えている不思議な出来事',
    'ちょっとだけ自慢したい経験',
    '誰にも理解されなかったこだわり',
    '旅行やお出かけでのハプニング',
    '最近お腹を抱えて笑った出来事',
    '先生や上司に言い間違えたこと',
    '気まずい空気になった瞬間',
    'いまでも謎が残っている出来事',
    'ゲームやSNSで起きた珍事件',
    '自分だけが知っている裏話',
    '思わぬところで助けられた話',
    '頑張ったのに空回りしたこと',
    '予想外のプレゼントの思い出',
    '家族や友達との忘れられない会話',
    '今思えば妙だった自分ルール',
    'つい口から出た謎のひと言',
    '本気で驚いたサプライズ'
]


def start(room):
    if len(room['active']) < 3:
        raise ValueError('「誰のエピソード？」は3人以上で遊べます')
    room['episode'] = {'round': 0, 'roundLimit': 3, 'topic': '', 'usedTopics': [],
                       'submissions': {}, 'entries': [], 'guesses': {},
                       'history': [], 'last': None}
    room['phase'] = 'ep_topic'


def begin_guesses(room):
    p = room['episode']
    authors = list(p['submissions'])
    if len(authors) < 3:
        raise ValueError('3人以上の投稿が必要です')
    secrets.SystemRandom().shuffle(authors)
    p['entries'] = [{'id': f'story_{i+1}', 'author': pid, 'text': p['submissions'][pid]}
                    for i, pid in enumerate(authors)]
    p['guesses'] = {}
    room['phase'] = 'ep_guess'


def reveal(room):
    p = room['episode']
    authors = set(p['submissions'])
    if room['phase'] != 'ep_guess':
        raise ValueError('今は答え合わせできません')
    winners = {}
    for guesser, by_story in p['guesses'].items():
        correct = sum(by_story.get(e['id']) == e['author'] for e in p['entries']
                      if e['author'] != guesser)
        room['points'][guesser] += correct * 2
        winners[guesser] = correct
        for e in p['entries']:
            if e['author'] != guesser and by_story.get(e['id']) != e['author']:
                room['points'][e['author']] += 1  # Successful misdirection
    last = {
        'round': p['round'] + 1, 'topic': p['topic'],
        'entries': [{'id': e['id'], 'text': e['text'], 'author': e['author'],
                     'name': room['players'][e['author']]['name']} for e in p['entries']],
        'guesses': [{'id': pid, 'name': room['players'][pid]['name'], 'answers': dict(g),
                     'correct': winners[pid]} for pid, g in p['guesses'].items()],
        'scores': [{'id': pid, 'name': room['players'][pid]['name'],
                    'score': room['points'].get(pid, 0)} for pid in room['active']],
    }
    p['last'] = last
    p['history'].append(last)
    room['phase'] = 'ep_reveal'


def snapshot(room, pid):
    p, phase = room['episode'], room['phase']
    participating = pid in room['active']
    author = pid in p['submissions']
    my_entry = next((e['id'] for e in p['entries'] if e['author'] == pid), None)
    exposed = phase in ('ep_reveal', 'final')
    entries = ([{'id': e['id'], 'text': e['text'], 'mine': e['author'] == pid}
                for e in p['entries']] if phase == 'ep_guess' else [])
    names = [{'id': aid, 'name': room['players'][aid]['name']} for aid in p['submissions']]
    public_p = {
        'round': p['round'], 'roundLimit': p['roundLimit'],
        'topic': p['topic'], 'sampleTopics': TOPICS if phase == 'ep_topic' else [],
        'submitted': author,
        'submittedCount': len(p['submissions']),
        'needed': len(room['active']),
        'guessed': pid in p['guesses'],
        'guessedCount': len(p['guesses']),
        'guessNeeded': len(p['submissions']),
        'myEntry': my_entry if phase == 'ep_guess' else None,
        'entries': entries,
        'candidates': names if phase == 'ep_guess' else [],
        'last': p['last'] if exposed else None,
        'history': p['history'] if phase == 'final' else [],
        'participating': participating,
    }
    return {'type': 'state', 'me': pid,
            'room': {'code': room['code'], 'owner': room['owner'],
                     'game': room['game'], 'phase': phase,
                     'players': [{'id': x['id'], 'name': x['name'],
                                  'score': room['points'].get(x['id'], 0),
                                  'online': bool(x['ws'] and not x['ws'].closed),
                                  'avatar': x.get('avatar', ''),
                                  'emoji': x.get('emoji', '🌷')} for x in room['players'].values()],
                     'active': room['active'], 'matchNo': room['matchNo'],
                     'endedEarly': room['endedEarly'], 'episode': public_p}}


def handle(room, pid, typ, obj, is_owner):
    p, phase = room['episode'], room['phase']
    if pid not in room['active']:
        raise ValueError('この対戦に参加していません')
    if typ == 'ep_topic':
        if phase != 'ep_topic' or not is_owner:
            raise ValueError('主催者だけがお題を決められます')
        topic = obj.get('text')
        if not isinstance(topic, str) or not 3 <= len(topic.strip()) <= 110:
            raise ValueError('お題は3〜110文字で入力してください')
        p['topic'] = topic.strip()
        p['submissions'] = {}
        p['entries'] = []
        p['guesses'] = {}
        p['usedTopics'].append(p['topic'])
        room['phase'] = 'ep_write'
    elif typ == 'ep_submit':
        if phase != 'ep_write' or pid in p['submissions']:
            raise ValueError('今は投稿できません')
        story = obj.get('text')
        if not isinstance(story, str) or not 8 <= len(story.strip()) <= 320:
            raise ValueError('エピソードは8〜320文字で入力してください')
        p['submissions'][pid] = story.strip()
        if all(a in p['submissions'] for a in room['active']):
            begin_guesses(room)
    elif typ == 'ep_guess':
        if phase != 'ep_guess' or pid not in p['submissions'] or pid in p['guesses']:
            raise ValueError('今は予想できません')
        answers = obj.get('answers')
        expected = {e['id'] for e in p['entries'] if e['author'] != pid}
        candidates = set(p['submissions']) - {pid}
        if not isinstance(answers, dict) or set(answers) != expected:
            raise ValueError('自分以外のエピソードをすべて予想してください')
        if set(answers.values()) != candidates or len(answers) != len(candidates):
            raise ValueError('書いた人を重複なく1人ずつ選んでください')
        p['guesses'][pid] = {str(k): v for k, v in answers.items()}
        if len(p['guesses']) == len(p['submissions']):
            reveal(room)
    elif typ == 'ep_force':
        if not is_owner:
            raise ValueError('主催者だけが進行できます')
        if phase == 'ep_write':
            begin_guesses(room)  # At least three authors required
        elif phase == 'ep_guess':
            reveal(room)
        else:
            raise ValueError('この場面では進められません')
    elif typ == 'ep_next':
        if not is_owner or phase != 'ep_reveal':
            raise ValueError('主催者だけが次のお題へ進められます')
        p['round'] += 1
        if p['round'] >= p['roundLimit']:
            room['phase'] = 'final'
        else:
            p['topic'] = ''
            p['submissions'] = {}
            p['entries'] = []
            p['guesses'] = {}
            p['last'] = None
            room['phase'] = 'ep_topic'
    else:
        raise ValueError('このゲームでは使えない操作です')
