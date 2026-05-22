# Sales Tracker Next — セッション全記録

作成日: 2026-05-13

---

## プロジェクト概要

旧ツール（HTML + Firebase Realtime Database）を  
**Next.js 15 + Supabase + TypeScript + Vercel** でフルリビルド。

| 項目 | 内容 |
|---|---|
| リポジトリ | `C:\Users\81908\projects\sales-tracker-next` |
| GitHub | `https://github.com/getty12234-ship-it/sales-tracker-next` |
| 本番URL | `https://sales-tracker-next.vercel.app` |
| Supabaseプロジェクト | アポイントメントシステム (`pbctrjnnrvssdyywgtdx`) |

---

## 技術スタック

| 層 | 採用技術 |
|---|---|
| フレームワーク | Next.js 15.5.18（App Router、force-dynamic） |
| 言語 | TypeScript |
| スタイル | Tailwind CSS + shadcn/ui |
| 状態管理 | TanStack React Query v5、Zustand |
| DB | Supabase（PostgreSQL）、RLS無効、anonキー |
| デプロイ | Vercel（GitHub push → auto-deploy） |

---

## DBテーブル一覧（全9テーブル）

| テーブル名 | 内容 | 状態 |
|---|---|---|
| `st_members` | メンバープロフィール | ✅ |
| `st_daily_metrics` | 日別数字（アポ/面談/成約等） | ✅ |
| `st_weekly_reviews` | 週次施策シート | ✅ |
| `st_daily_reports` | 日報 | ✅ |
| `st_monthly_videos` | 月次動画リスト（31行） | ✅ |
| `st_instagram_accounts` | インスタアカウント | ✅ |
| `st_instagram_metrics` | インスタ指標 | ✅ |
| `st_settings` | 個人設定・目標値 | ✅ |
| `st_member_goals` | ゴールロードマップ | ✅（後日追加） |

> 全テーブル: `DISABLE ROW LEVEL SECURITY` + `GRANT ALL TO anon, authenticated` 適用済み

### Supabase 注意事項
- 新テーブル作成時はRLSが自動ONになる → 必ず別途 `ALTER TABLE xxx DISABLE ROW LEVEL SECURITY;` を実行
- GRANT は schema SQL 内では効かない場合がある → テーブル作成後に再実行
- `update_updated_at_column()` 関数が存在しないとトリガー作成が失敗 → 関数込みでSQLを実行すること

---

## 実装機能

### サイドバーナビ

| ページ | パス | 説明 |
|---|---|---|
| サマリー | `/dashboard` | 週次集計ダッシュボード |
| 日別数字 | `/dashboard/daily` | 日別入力・表示 |
| 施策シート | `/dashboard/review` | 週次レビュー（今週＋先週同時表示） |
| 日報 | `/dashboard/nippo` | 日報入力 |
| インスタ | `/dashboard/instagram` | インスタ指標 |
| ゴール | `/dashboard/goals` | ゴールロードマップ（6段階） |
| 設定 | `/dashboard/settings` | 設定画面 |

### 施策シート（`/dashboard/review`）
- 今週（編集可）と**先週（読み取り専用）を同時表示**
- 先週パネルはラベルが「先週の〜」、入力欄はreadOnly、追加/削除ボタン非表示
- WeekNavで週を動かすと両パネルが連動

### ゴールロードマップ（`/dashboard/goals`）
- 6段階縦並び：🏔️長期 → 🎯中期 → 🚀短期 → ⚡短短期(3ヶ月) → 📅来月 → 🔥今月
- メンバーごとに `st_member_goals` テーブルに保存
- 600ms デバウンス自動保存

---

## 主要ファイル

```
sales-tracker-next/
├── app/
│   └── dashboard/
│       ├── layout.tsx              # force-dynamic、Header+Sidebar
│       ├── page.tsx                # サマリー
│       ├── daily/page.tsx
│       ├── review/page.tsx         # 今週+先週 2パネル ★
│       ├── goals/page.tsx          # ゴールロードマップ ★
│       ├── nippo/page.tsx
│       ├── instagram/page.tsx
│       └── settings/page.tsx
├── components/dashboard/
│   ├── Header.tsx                  # syncEvents pub/sub、WeekNav
│   ├── Sidebar.tsx                 # ゴールリンク追加 ★
│   ├── ReviewSheet.tsx             # weekStart/readOnly props ★
│   ├── GoalsView.tsx               # ゴールUI ★
│   └── ...
├── lib/
│   ├── queries.ts                  # getMemberGoals/upsertMemberGoals 追加 ★
│   ├── supabase.ts                 # 型定義
│   ├── store.ts                    # Zustand（currentMember, currentWeekStart）
│   ├── constants.ts                # METRIC_FIELDS等
│   └── date-utils.ts               # addWeeks, getWeekLabel等
├── scripts/
│   └── migrate.py                  # 旧→新 データ移行スクリプト ★
├── PROGRESS.md                     # 進捗サマリー
└── SESSION_LOG.md                  # このファイル
```

---

## データ移行

### 旧ツール構成
- ファイル: `core.html`（Firebase Realtime Database + localStorage）
- エクスポートファイル: `C:\Users\81908\Downloads\sales-tracker-export.json`
- 旧ツール週キー形式: `YYYY-M-Wn`（土曜始まり、7日配列）

### 旧→新 週の変換
```
旧: 土曜始まり（YYYY-M-Wn）
新: 月曜始まり（YYYY-MM-DD）
変換: saturday + 2日 = monday
```

### camelCase → snake_case マッピング
```python
KEY_MAP = {
    'post': 'post', 'apoGet': 'apo_get', 'apoExec': 'apo_exec',
    'apoCxl': 'apo_cxl', 'testClose': 'test_close', 'offer': 'offer',
    'ng': 'ng', 'muchaku': 'muchaku', 'doinGet': 'doin_get',
    'doinGetCxl': 'doin_get_cxl', 'doinExec': 'doin_exec',
    'doinExecCxl': 'doin_exec_cxl', 'mendanGet': 'mendan_get',
    'mendanExec': 'mendan_exec', 'seiyaku': 'seiyaku',
    'lineExchange': 'line_exchange',
}
```

### 移行結果

| テーブル | 件数 | 備考 |
|---|---|---|
| `st_instagram_accounts` | 9件 | 旧 accounts → 新テーブル |
| `st_daily_metrics` | 53件 | 旧 weeks.daily → 新テーブル |
| `st_weekly_reviews` | 20件 | 旧 weeks.memberReview → 新テーブル |
| `st_daily_reports` | 0件 | 旧ツールにデータなし |
| `st_instagram_metrics` | 0件 | 旧ツールにデータなし |

### 未解決: 1文字メンバー問題
- `岡`（旧ID: member_1770000467128_pkxwu）→ 増岡紗貴 or 米岡理子 か不明のためスキップ
- `森`（旧ID: mem_1770593694792）→ 森菜丘 or 森口愛子 か不明のためスキップ
- → 確認後、`migrate.py` の `old_id_to_new` に手動追記して再実行すれば移行可能

---

## 遭遇したエラーと解決策

| エラー | 原因 | 解決 |
|---|---|---|
| `metadata-boundary.js` ビルドエラー | `.next` キャッシュ破損 | `.next` 削除して再ビルド |
| `Permission denied` (REST API) | RLSが自動ON | `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` を別途実行 |
| `GRANT` SQL失敗 | bashヒアドキュメントのまま貼り付け | 純粋なSQL（bash構文なし）で再実行 |
| インスタ accounts 0件 | schema内INSERTはGRANT前で権限なし | GRANT後に再INSERT |
| upsert duplicate key | 複合ユニークキーに `resolution=merge-duplicates` が効かない | DELETE → INSERT パターンに変更 |
| `is_active` カラムなし | supabase.tsの型とDB実態の不一致 | カラム削除してスクリプト修正 |
| `week_start_date` カラムなし | st_daily_metricsにそのカラムなし | カラム削除してスクリプト修正 |
| `update_updated_at_column()` not exist | trigger関数が未作成 | CREATE FUNCTION 込みのSQLで再実行 |
| バッチ内重複 ON CONFLICT エラー | 複数旧メンバーが同一UUIDにマップ → バッチ内重複 | dict で (member_id, week) をキーに後勝ちデdup |

---

## 今後のバックログ

- [ ] `岡` メンバーの帰属先確認・移行（増岡紗貴 or 米岡理子）
- [ ] `森` メンバーの帰属先確認・移行（森菜丘 or 森口愛子）
- [ ] モバイル対応
- [ ] チームサマリー（全メンバー一覧比較ビュー）

---

## 移行スクリプトの再実行方法

```bash
cd C:\Users\81908\projects\sales-tracker-next
python scripts/migrate.py
```

`岡` と `森` を追加移行する場合は `migrate.py` の照合部分に追記：
```python
# 手動追記例（migrate.py の old_id_to_new 初期化後に追加）
old_id_to_new['member_1770000467128_pkxwu'] = '<増岡紗貴のUUID>'  # 岡
old_id_to_new['mem_1770593694792'] = '<森菜丘のUUID>'             # 森
```
