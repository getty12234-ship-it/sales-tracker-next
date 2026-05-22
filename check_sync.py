"""
Firebase -> Supabase データ同期状況チェックスクリプト
"""
import json
import sys
import urllib.request
import urllib.parse

# === 設定 ===
SUPABASE_URL = "https://pbctrjnnrvssdyywgtdx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiY3Ryam5ucnZzc2R5eXdndGR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5ODA2MDgsImV4cCI6MjA4NTU1NjYwOH0.MTOIZ9enImEiakaxyNb-SGw6QFeYFia83cmOk5TSnq4"
FIREBASE_JSON = "C:/Users/81908/Downloads/sales-tracker-export.json"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

def supabase_get(path):
    url = SUPABASE_URL + path
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode()}")
        return []
    except Exception as e:
        print(f"Error: {e}")
        return []

# === Step 1: Firebase データ読み込み ===
print("=== Firebase データ読み込み ===")
with open(FIREBASE_JSON, encoding="utf-8") as f:
    fb_data = json.load(f)

core = fb_data["salesPro_core"]
members = core["members"]
weeks = core["weeks"]
deleted_ids = set(core.get("deletedMembers", []))

print(f"現役メンバー数: {len(members)}")
print(f"削除済みメンバーID数: {len(deleted_ids)}")

# 現役メンバーのIDと名前マップ
active_member_map = {m["id"]: m["name"] for m in members}

# 各メンバーのweekly daily件数を集計（現役のみ）
fb_week_counts = {}  # member_id -> 週数
for week_key, week_val in weeks.items():
    if "daily" in week_val:
        daily = week_val["daily"]
        for mid in daily.keys():
            if mid not in deleted_ids:
                fb_week_counts[mid] = fb_week_counts.get(mid, 0) + 1

print("\n--- Firebase 現役メンバー別 週データ数 ---")
for mid, name in active_member_map.items():
    wc = fb_week_counts.get(mid, 0)
    print(f"  {name}（{mid}）: {wc}週")

# deletedMembersに含まれないが membersリストにもないメンバーのdailyデータ
unknown_in_daily = set(fb_week_counts.keys()) - set(active_member_map.keys())
if unknown_in_daily:
    print(f"\n  ※ メンバーリスト外でdailyデータがある未知ID数: {len(unknown_in_daily)}")

# === Step 2: Supabase データ取得 ===
print("\n=== Supabase データ取得 ===")

# st_membersテーブルを全件取得
sb_members = supabase_get("/rest/v1/st_members?select=*&limit=1000")
print(f"st_members 件数: {len(sb_members)}")

if sb_members and len(sb_members) > 0:
    print("サンプル:", sb_members[0])

# st_daily_metricsテーブルを全件取得（member_idと日付だけ）
sb_metrics = supabase_get("/rest/v1/st_daily_metrics?select=member_id,date&limit=10000")
print(f"st_daily_metrics 件数: {len(sb_metrics)}")

# === Step 3: 比較レポート ===
print("\n=== 同期状況レポート ===")

# Supabaseメンバーを名前でマップ
sb_member_by_name = {}
sb_member_by_id = {}
for m in sb_members:
    name = m.get("name", "")
    mid = m.get("id", "")
    sb_member_by_name[name] = m
    sb_member_by_id[mid] = m

# Supabaseの各メンバーのdaily件数
sb_metrics_by_member = {}
for row in sb_metrics:
    mid = row.get("member_id", "")
    sb_metrics_by_member[mid] = sb_metrics_by_member.get(mid, 0) + 1

print(f"\n{'メンバー名':<15} {'FirebaseID':<35} {'FB週数':>6} {'SB member_id':<40} {'SBレコード数':>10} {'状態'}")
print("-" * 130)

# Firebaseの現役メンバー各自をチェック
checked_sb_ids = set()
for fb_mid, fb_name in active_member_map.items():
    fb_weeks = fb_week_counts.get(fb_mid, 0)

    # 名前でSupabaseを検索（部分一致も試みる）
    sb_match = None
    # 完全一致
    if fb_name in sb_member_by_name:
        sb_match = sb_member_by_name[fb_name]
    else:
        # 部分一致（前方）
        for sb_name, sb_m in sb_member_by_name.items():
            if fb_name in sb_name or sb_name in fb_name:
                sb_match = sb_m
                break

    if sb_match:
        sb_mid = sb_match.get("id", "")
        sb_count = sb_metrics_by_member.get(sb_mid, 0)
        checked_sb_ids.add(sb_mid)

        # 状態判定
        if fb_weeks == 0 and sb_count == 0:
            status = "⚪ データなし"
        elif fb_weeks > 0 and sb_count == 0:
            status = "❌ 未同期"
        elif fb_weeks > 0 and sb_count > 0:
            status = "✅ 同期済み"
        else:
            status = "⚠️ 確認要"

        print(f"{fb_name:<15} {fb_mid:<35} {fb_weeks:>6} {sb_mid:<40} {sb_count:>10} {status}")
    else:
        fb_w_str = str(fb_weeks) if fb_weeks > 0 else "0"
        print(f"{fb_name:<15} {fb_mid:<35} {fb_weeks:>6} {'(Supabaseに存在しない)':40} {'':>10} ❌ SBなし")

# SupabaseにいてFirebaseにいないメンバー
print("\n--- Supabaseのみに存在するメンバー ---")
sb_only = [(m.get("id",""), m.get("name","")) for m in sb_members if m.get("id","") not in checked_sb_ids]
if sb_only:
    for sb_id, sb_name in sb_only:
        sb_count = sb_metrics_by_member.get(sb_id, 0)
        print(f"  {sb_name}（{sb_id}）: daily件数={sb_count}")
else:
    print("  なし")

# st_daily_metricsのサマリ
print(f"\n--- st_daily_metrics サマリ ---")
print(f"総レコード数: {len(sb_metrics)}")
if sb_metrics:
    dates = [r.get("date","") for r in sb_metrics if r.get("date")]
    if dates:
        print(f"日付範囲: {min(dates)} 〜 {max(dates)}")
