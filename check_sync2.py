"""
Firebase -> Supabase データ同期状況チェックスクリプト v2
"""
import json
import urllib.request

SUPABASE_URL = "https://pbctrjnnrvssdyywgtdx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiY3Ryam5ucnZzc2R5eXdndGR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5ODA2MDgsImV4cCI6MjA4NTU1NjYwOH0.MTOIZ9enImEiakaxyNb-SGw6QFeYFia83cmOk5TSnq4"
FIREBASE_JSON = "C:/Users/81908/Downloads/sales-tracker-export.json"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
}

def supabase_get(path):
    url = SUPABASE_URL + path
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))

# Firebase読み込み
with open(FIREBASE_JSON, encoding="utf-8") as f:
    fb_data = json.load(f)

core = fb_data["salesPro_core"]
members = core["members"]
weeks = core["weeks"]
deleted_ids = set(core.get("deletedMembers", []))

active_map = {m["id"]: m["name"] for m in members}

# 週データ件数集計
fb_week_counts = {}
for wk, wv in weeks.items():
    if "daily" in wv:
        for mid in wv["daily"].keys():
            if mid not in deleted_ids:
                fb_week_counts[mid] = fb_week_counts.get(mid, 0) + 1

# Supabase取得
sb_members = supabase_get("/rest/v1/st_members?select=id,name&limit=1000")
sb_metrics = supabase_get("/rest/v1/st_daily_metrics?select=member_id,date&limit=10000")

sb_name_to_id = {m["name"]: m["id"] for m in sb_members}

sb_count_by_id = {}
for r in sb_metrics:
    mid = r.get("member_id", "")
    sb_count_by_id[mid] = sb_count_by_id.get(mid, 0) + 1

# 手動マッピング
MANUAL_MAP = {
    "岡":        None,           # 不明（増岡紗貴か米岡理子か）
    "稲垣":      "稲垣葵咲",
    "藤澤":      "藤澤さくら",
    "増岡":      "増岡紗貴",
    "久保":      "久保　綾乃",
    "テスト":    None,           # テストユーザー
    "原田テスト": "原田",
    "森":        "森菜丘",
}

print("=" * 80)
print("Firebase -> Supabase 同期状況レポート")
print("=" * 80)
print()
header = "{:<12} {:>6}  {:<16} {:>12}  {}".format(
    "メンバー名(FB)", "FB週数", "Supabase名", "SBレコード数", "状態"
)
print(header)
print("-" * 75)

sb_matched_ids = set()

for fb_mid, fb_name in active_map.items():
    fb_weeks = fb_week_counts.get(fb_mid, 0)
    sb_target_name = MANUAL_MAP.get(fb_name, fb_name)

    if fb_name == "テスト":
        print("{:<12} {:>6}  {:<16} {:>12}  {}".format(
            fb_name, fb_weeks, "(テストユーザー)", "-", "スキップ"))
        continue

    if sb_target_name is None:
        print("{:<12} {:>6}  {:<16} {:>12}  {}".format(
            fb_name, fb_weeks, "(不明/要確認)", "-", "不明"))
        continue

    sb_id = sb_name_to_id.get(sb_target_name)
    if sb_id:
        sb_matched_ids.add(sb_id)
        sb_count = sb_count_by_id.get(sb_id, 0)
        if fb_weeks > 0 and sb_count > 0:
            status = "OK 同期済み"
        elif fb_weeks > 0 and sb_count == 0:
            status = "NG 未同期"
        elif fb_weeks == 0 and sb_count > 0:
            status = "!! SBのみデータあり"
        else:
            status = "-- データなし"
        print("{:<12} {:>6}  {:<16} {:>12}  {}".format(
            fb_name, fb_weeks, sb_target_name, sb_count, status))
    else:
        print("{:<12} {:>6}  {:<16} {:>12}  {}".format(
            fb_name, fb_weeks, sb_target_name, "-", "NG SBに存在しない"))

print()
print("=" * 80)
print("Supabaseのみに存在するメンバー（Firebase現役リストに対応なし）")
print("=" * 80)
print()
print("{:<16} {:>14}".format("Supabase名", "dailyレコード数"))
print("-" * 35)
for m in sorted(sb_members, key=lambda x: x.get("name", "")):
    sid = m["id"]
    sname = m["name"]
    if sid not in sb_matched_ids:
        cnt = sb_count_by_id.get(sid, 0)
        print("{:<16} {:>14}".format(sname, cnt))

print()
print("--- st_daily_metrics 全体 ---")
print("総レコード数: {}".format(len(sb_metrics)))
if sb_metrics:
    dates = sorted([r.get("date", "") for r in sb_metrics if r.get("date")])
    if dates:
        print("日付範囲: {} ~ {}".format(dates[0], dates[-1]))
