"""
旧セールストラッカー → Supabase 全データ移行スクリプト
新ツールは月曜始まり / 旧ツールは土曜始まり
"""

import json
import os
import requests
from datetime import date, timedelta
from pathlib import Path

# .env.local を手動で読む
env_path = Path(__file__).parent.parent / '.env.local'
env = {}
if env_path.exists():
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()

SUPABASE_URL = env.get('NEXT_PUBLIC_SUPABASE_URL', '')
SUPABASE_KEY = env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit('ERROR: .env.local に SUPABASE_URL/ANON_KEY がありません')

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
}

def sb_get(table, params=''):
    r = requests.get(f'{SUPABASE_URL}/rest/v1/{table}?{params}', headers=HEADERS)
    r.raise_for_status()
    return r.json()

def sb_upsert(table, rows, on_conflict=None):
    if not rows:
        return []
    h = {**HEADERS, 'Prefer': 'resolution=merge-duplicates,return=representation'}
    url = f'{SUPABASE_URL}/rest/v1/{table}'
    if on_conflict:
        url += f'?on_conflict={on_conflict}'
    r = requests.post(url, headers=h, json=rows)
    if not r.ok:
        print(f'  ERROR {table}: {r.status_code} {r.text[:300]}')
        return []
    return r.json()

def sb_delete_where(table, where):
    r = requests.delete(f'{SUPABASE_URL}/rest/v1/{table}?{where}', headers=HEADERS)
    # 404 は無視
    return r

# ---- 週キー → 土曜日の日付 ----
def week_key_to_saturday(year, month, week_num):
    """旧ツール: YYYY-M-Wn → 土曜日の date"""
    first = date(year, month, 1)
    dow = (first.weekday() + 1) % 7  # 土=0, 日=1, 月=2...金=6
    week_start_day = 1 - dow + (week_num - 1) * 7
    sat = date(year, month, 1) + timedelta(days=week_start_day - 1)
    return sat

def saturday_to_monday(sat: date) -> date:
    """土曜 → 翌月曜 (+2日)"""
    return sat + timedelta(days=2)

def get_week_days_from_saturday(sat: date):
    """土曜起点7日 [土,日,月,火,水,木,金]"""
    return [(sat + timedelta(days=i)).isoformat() for i in range(7)]

def parse_week_key(wk):
    parts = wk.split('-')
    return int(parts[0]), int(parts[1]), int(parts[2][1:])

KEY_MAP = {
    'post': 'post', 'apoGet': 'apo_get', 'apoExec': 'apo_exec',
    'apoCxl': 'apo_cxl', 'testClose': 'test_close', 'offer': 'offer',
    'ng': 'ng', 'muchaku': 'muchaku', 'doinGet': 'doin_get',
    'doinGetCxl': 'doin_get_cxl', 'doinExec': 'doin_exec',
    'doinExecCxl': 'doin_exec_cxl', 'mendanGet': 'mendan_get',
    'mendanExec': 'mendan_exec', 'seiyaku': 'seiyaku',
    'lineExchange': 'line_exchange',
}

# ============================================================
print('=== データ読み込み ===')
with open('C:/Users/81908/Downloads/sales-tracker-export.json', encoding='utf-8') as f:
    data = json.load(f)

core = data['salesPro_core']
weeks = core.get('weeks', {})
old_accounts = core.get('accounts', [])
old_members = core.get('members', [])

# ============================================================
# メンバーIDマッピング
# ============================================================
print('\n=== st_members 照合 ===')
st_members = sb_get('st_members', 'select=id,name')
print(f'  Supabase: {len(st_members)}件')

def normalize(name): return name.strip()

new_by_name = {normalize(m['name']): m['id'] for m in st_members}
print('  新メンバー:', list(new_by_name.keys()))

old_id_to_new = {}
unmatched = []
for om in old_members:
    nm = normalize(om['name'])
    matched = None
    # 1文字以下の名前は完全一致のみ（"岡"が増岡紗貴にマッチするのを防ぐ）
    min_len = 2 if len(nm) <= 2 else 1
    for nn, uid in new_by_name.items():
        if nm == nn:
            matched = uid
            break
        if len(nm) >= min_len and (nm in nn or nn in nm) and len(nm) >= 2:
            matched = uid
            break
    # テスト用メンバーはスキップ
    if 'テスト' in nm:
        print(f'  スキップ(テスト): {om["name"]}')
        continue
    if matched:
        old_id_to_new[om['id']] = matched
        print(f'  ✓ {om["name"]}({om["id"][:12]}) → {matched[:8]}')
    else:
        unmatched.append(om)
        print(f'  ✗ 未マッチ: {om["name"]}({om["id"]})')

print()

# ============================================================
# 1. st_instagram_accounts
# ============================================================
print('=== 1. st_instagram_accounts ===')
existing = sb_get('st_instagram_accounts', 'select=id,member_id,name,url')
existing_key = {(a['member_id'], a['name']): a['id'] for a in existing}

old_acc_to_new = {}  # 旧acc_id → 新UUID
insert_accs = []

for acc in old_accounts:
    owner_new = old_id_to_new.get(acc.get('ownerId', ''))
    if not owner_new:
        continue
    key = (owner_new, acc.get('name', ''))
    if key in existing_key:
        old_acc_to_new[acc['id']] = existing_key[key]
    else:
        insert_accs.append({
            'member_id': owner_new,
            'name': acc.get('name', ''),
            'url': acc.get('url', '').strip(),
        })

if insert_accs:
    result = sb_upsert('st_instagram_accounts', insert_accs)
    print(f'  {len(result)}件 追加')
else:
    print('  新規なし')

# 再取得してIDマップ完成
all_accs = sb_get('st_instagram_accounts', 'select=id,member_id,name,url')
for a in all_accs:
    for oa in old_accounts:
        if (oa.get('name','') == a['name'] and
                old_id_to_new.get(oa.get('ownerId','')) == a['member_id']):
            old_acc_to_new[oa['id']] = a['id']

print(f'  IDマップ: {len(old_acc_to_new)}件')

# ============================================================
# 2. st_daily_metrics  (列名: date ← 旧: metric_date NG)
# ============================================================
print('\n=== 2. st_daily_metrics ===')
daily_rows = []

for wk, wv in weeks.items():
    if 'daily' not in wv:
        continue
    year, month, wnum = parse_week_key(wk)
    sat = week_key_to_saturday(year, month, wnum)
    mon = saturday_to_monday(sat)
    week_days = get_week_days_from_saturday(sat)  # [土,日,月...金]

    for old_mid, mdata in wv['daily'].items():
        new_uuid = old_id_to_new.get(old_mid)
        if not new_uuid or not isinstance(mdata, dict):
            continue
        for day_idx, day_str in enumerate(week_days):
            row = {
                'member_id': new_uuid,
                'date': day_str,
            }
            for old_key, new_key in KEY_MAP.items():
                arr = mdata.get(old_key, [])
                val = arr[day_idx] if isinstance(arr, list) and day_idx < len(arr) else 0
                row[new_key] = val or 0
            if any(row[nk] != 0 for nk in KEY_MAP.values()):
                daily_rows.append(row)

print(f'  対象: {len(daily_rows)}件')
total = 0
for i in range(0, len(daily_rows), 100):
    batch = daily_rows[i:i+100]
    # 既存削除 → 挿入
    for row in batch:
        sb_delete_where('st_daily_metrics',
            f'member_id=eq.{row["member_id"]}&date=eq.{row["date"]}')
    result = sb_upsert('st_daily_metrics', batch, on_conflict='member_id,date')
    total += len(result)
    print(f'  バッチ {i//100+1}: {len(result)}件')
print(f'  合計: {total}件')

# ============================================================
# 3. st_weekly_reviews (memberReview)
# ============================================================
print('\n=== 3. st_weekly_reviews ===')
review_rows = []

for wk, wv in weeks.items():
    mr = wv.get('memberReview', {})
    if not mr:
        continue
    year, month, wnum = parse_week_key(wk)
    sat = week_key_to_saturday(year, month, wnum)
    mon = saturday_to_monday(sat)

    for old_mid, rdata in mr.items():
        new_uuid = old_id_to_new.get(old_mid)
        if not new_uuid or not isinstance(rdata, dict):
            continue
        cause_actions = rdata.get('causeActions', []) or []
        ca = []
        for item in (cause_actions if isinstance(cause_actions, list) else []):
            if isinstance(item, dict):
                ca.append({'action': item.get('action',''), 'deadline': item.get('deadline','')})
            elif isinstance(item, str) and item:
                ca.append({'action': item, 'deadline': ''})

        review_rows.append({
            'member_id': new_uuid,
            'week_start_date': mon.isoformat(),
            'main_issue': rdata.get('mainIssue', '') or '',
            'main_cause': rdata.get('mainCause', '') or '',
            'top_action': rdata.get('topReasonAction', '') or '',
            'cause_actions': ca,
            'muchaku_reasons': [],
            'ng_reasons': [],
        })

print(f'  対象(重複前): {len(review_rows)}件')
# (member_id, week_start_date) で重複排除（後勝ち）
deduped = {}
for row in review_rows:
    key = (row['member_id'], row['week_start_date'])
    deduped[key] = row
review_rows = list(deduped.values())
print(f'  対象(重複排除後): {len(review_rows)}件')

total = 0
for i in range(0, len(review_rows), 50):
    batch = review_rows[i:i+50]
    for row in batch:
        sb_delete_where('st_weekly_reviews',
            f'member_id=eq.{row["member_id"]}&week_start_date=eq.{row["week_start_date"]}')
    result = sb_upsert('st_weekly_reviews', batch, on_conflict='member_id,week_start_date')
    total += len(result)
print(f'  合計: {total}件')

# ============================================================
# 4. st_daily_reports (nippo) ← 列名: date, output, gratitude, video_url
# ============================================================
print('\n=== 4. st_daily_reports ===')
nippo_rows = []

for wk, wv in weeks.items():
    nippo = wv.get('nippo', {})
    if not nippo:
        continue
    year, month, wnum = parse_week_key(wk)
    sat = week_key_to_saturday(year, month, wnum)
    mon = saturday_to_monday(sat)

    for old_mid, ndata in nippo.items():
        new_uuid = old_id_to_new.get(old_mid)
        if not new_uuid or not isinstance(ndata, dict):
            continue
        output = ndata.get('output', '') or ''
        gratitude = ndata.get('gratitude', '') or ''
        video_url = ndata.get('videoUrl', '') or ''
        if not output and not gratitude and not video_url:
            continue
        nippo_rows.append({
            'member_id': new_uuid,
            'date': mon.isoformat(),
            'output': output,
            'gratitude': gratitude,
            'video_url': video_url,
        })

print(f'  対象: {len(nippo_rows)}件')
total = 0
for i in range(0, len(nippo_rows), 50):
    batch = nippo_rows[i:i+50]
    for row in batch:
        sb_delete_where('st_daily_reports',
            f'member_id=eq.{row["member_id"]}&date=eq.{row["date"]}')
    result = sb_upsert('st_daily_reports', batch, on_conflict='member_id,date')
    total += len(result)
print(f'  合計: {total}件')

# ============================================================
# 5. st_instagram_metrics  ← 列名: follows,followers,dm_send,dm_reply,
#                             ig_offer,ig_apo_get,ig_apo_exec,ig_doin_exec,ig_seiyaku
# ============================================================
print('\n=== 5. st_instagram_metrics ===')
# 旧ツールのインスタ配列は [post,reach,follower,profile,reply,dm,like] の7要素
# → 新ツールに対応するものだけマップ
# 旧: reply≒dm_reply, dm≒dm_send
INSTA_IDX_MAP = {
    1: 'follows',    # reach → follows に近似
    2: 'followers',  # follower
    4: 'dm_reply',   # reply
    5: 'dm_send',    # dm
}

insta_rows = []
for wk, wv in weeks.items():
    insta_wv = wv.get('instagram', {})
    if not insta_wv:
        continue
    year, month, wnum = parse_week_key(wk)
    sat = week_key_to_saturday(year, month, wnum)
    week_days = get_week_days_from_saturday(sat)

    for old_mid, acc_map in insta_wv.items():
        if not isinstance(acc_map, dict):
            continue
        for old_acc_id, day_data in acc_map.items():
            new_acc_uuid = old_acc_to_new.get(old_acc_id)
            if not new_acc_uuid:
                continue
            # day_data は dict{'post':[...], 'reach':[...], ...} or list
            if isinstance(day_data, dict):
                keys_list = list(day_data.keys())
                # 各日ごとに行を作る
                for day_idx in range(7):
                    if day_idx >= len(week_days):
                        break
                    row = {'account_id': new_acc_uuid, 'date': week_days[day_idx]}
                    has_data = False
                    for col_name in ['post','reach','follower','profile','reply','dm','like']:
                        arr = day_data.get(col_name, [])
                        val = arr[day_idx] if isinstance(arr, list) and day_idx < len(arr) else 0
                        if val:
                            has_data = True
                        # マッピング
                        if col_name == 'reach':
                            row['follows'] = val or 0
                        elif col_name == 'follower':
                            row['followers'] = val or 0
                        elif col_name == 'reply':
                            row['dm_reply'] = val or 0
                        elif col_name == 'dm':
                            row['dm_send'] = val or 0
                    if has_data:
                        row.setdefault('follows', 0)
                        row.setdefault('followers', 0)
                        row.setdefault('dm_send', 0)
                        row.setdefault('dm_reply', 0)
                        row.setdefault('ig_offer', 0)
                        row.setdefault('ig_apo_get', 0)
                        row.setdefault('ig_apo_exec', 0)
                        row.setdefault('ig_doin_exec', 0)
                        row.setdefault('ig_seiyaku', 0)
                        insta_rows.append(row)

print(f'  対象: {len(insta_rows)}件')
if insta_rows:
    total = 0
    for i in range(0, len(insta_rows), 100):
        batch = insta_rows[i:i+100]
        for row in batch:
            sb_delete_where('st_instagram_metrics',
                f'account_id=eq.{row["account_id"]}&date=eq.{row["date"]}')
        result = sb_upsert('st_instagram_metrics', batch, on_conflict='account_id,date')
        total += len(result)
    print(f'  合計: {total}件')
else:
    print('  データなし')

print('\n=== ✅ 移行完了 ===')
