"""
田沢さんの2026年5月データをスクリーンショットから直接Supabaseに投入するスクリプト
合計値で検証済み:
  投稿=24, LINE交換=4, アポ獲得=15, アポ実施=12, CXL=4,
  テスクロ=3, オファー=3, NG=5, 無着地=4, 動員獲得=1
"""

import requests
from pathlib import Path

env_path = Path(__file__).parent.parent / '.env.local'
env = {}
for line in env_path.read_text(encoding='utf-8').splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip()

SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY = env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=representation',
}

# 田沢さんのUUID（今セッションで追加済み）
MEMBER_ID = '6e4dd7ff-3810-46f3-9306-c3f726f90325'

# スクリーンショットから読み取った日別データ（キー=YYYY-MM-DD）
# 列順: post, line_exchange, apo_get, apo_exec, apo_cxl, test_close, offer, ng, muchaku,
#       doin_get, doin_get_cxl, doin_exec, doin_exec_cxl, mendan_get, mendan_exec, seiyaku, cooling_off
RAW = {
    '2026-05-01': [3, 1, 2, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    '2026-05-02': [3, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    '2026-05-03': [3, 1, 2, 2, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    '2026-05-04': [3, 1, 3, 2, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    # 5/5〜8: GW・ゼロのため省略
    '2026-05-09': [3, 0, 1, 0, 2, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    '2026-05-10': [3, 0, 0, 4, 1, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    '2026-05-11': [3, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    '2026-05-12': [3, 1, 2, 3, 0, 1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
}

FIELDS = [
    'post', 'line_exchange', 'apo_get', 'apo_exec', 'apo_cxl',
    'test_close', 'offer', 'ng', 'muchaku',
    'doin_get', 'doin_get_cxl', 'doin_exec', 'doin_exec_cxl',
    'mendan_get', 'mendan_exec', 'seiyaku', 'cooling_off',
]

# 合計検証
totals = {}
for vals in RAW.values():
    for i, f in enumerate(FIELDS):
        totals[f] = totals.get(f, 0) + vals[i]

expected = {
    'post': 24, 'line_exchange': 4, 'apo_get': 15, 'apo_exec': 12,
    'apo_cxl': 4, 'test_close': 3, 'offer': 3, 'ng': 5,
    'muchaku': 4, 'doin_get': 1,
}
print('=== 合計値検証 ===')
for k, v in expected.items():
    actual = totals.get(k, 0)
    status = '✓' if actual == v else f'✗ (期待={v})'
    print(f'  {k}: {actual} {status}')

# 挿入
rows = []
for date, vals in RAW.items():
    row = {'member_id': MEMBER_ID, 'date': date}
    for i, f in enumerate(FIELDS):
        row[f] = vals[i]
    rows.append(row)

print(f'\n=== Supabaseに{len(rows)}行を投入 ===')
r = requests.post(
    f'{SUPABASE_URL}/rest/v1/st_daily_metrics?on_conflict=member_id,date',
    headers=HEADERS,
    json=rows,
)
if r.ok:
    inserted = r.json()
    print(f'  ✅ {len(inserted)}行 upsert 完了')
else:
    print(f'  ❌ エラー: {r.status_code} {r.text[:300]}')
