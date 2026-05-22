# Sales Tracker Next — 進捗まとめ

最終更新: 2026-05-18

---

## プロジェクト概要

旧ツール（HTML + Firebase Realtime Database）から  
**Next.js 15 + Supabase + TypeScript + Vercel** へフルリビルド。

- **リポジトリ**: `C:\Users\81908\projects\sales-tracker-next`
- **GitHub**: `https://github.com/getty12234-ship-it/sales-tracker-next`
- **本番 URL**: `https://sales-tracker-next.vercel.app`
- **Supabase プロジェクト**: `アポイントメントシステム`（`pbctrjnnrvssdyywgtdx`）

---

## 技術スタック

| 層 | 採用技術 |
|---|---|
| フロントエンド | Next.js 15.5.18（App Router）、TypeScript、Tailwind CSS |
| 状態管理 | TanStack React Query v5、Zustand（useAppState） |
| DB | Supabase（PostgreSQL）、RLS 無効、anon キー使用 |
| デプロイ | Vercel（GitHub 連携 auto-deploy） |

---

## DB テーブル一覧

| テーブル名 | 内容 | 作成済み |
|---|---|---|
| `st_members` | メンバープロフィール | ✅ |
| `st_daily_metrics` | 日別数字 | ✅ |
| `st_weekly_reviews` | 週次施策シート | ✅ |
| `st_daily_reports` | 日報 | ✅ |
| `st_monthly_videos` | 月次動画リスト | ✅ |
| `st_instagram_accounts` | インスタアカウント | ✅ |
| `st_instagram_metrics` | インスタ指標 | ✅ |
| `st_settings` | 設定 | ✅ |
| `st_member_goals` | ゴールロードマップ | ✅（2026-05-13 追加） |

> 全テーブルに `DISABLE ROW LEVEL SECURITY` と `GRANT ALL TO anon, authenticated` 適用済み

---

## 実装済み機能

### サイドバー（`/dashboard/*`）
| ページ | パス | 内容 |
|---|---|---|
| サマリー | `/dashboard` | 週次集計ダッシュボード |
| 日別数字 | `/dashboard/daily` | 日別入力・表示 |
| 施策シート | `/dashboard/review` | 週次レビューフォーム |
| 日報 | `/dashboard/nippo` | 日報入力 |
| インスタ | `/dashboard/instagram` | インスタ指標 |
| **ゴール** | `/dashboard/goals` | ゴールロードマップ（新規追加） |
| 設定 | `/dashboard/settings` | 設定画面 |

### 施策シート（`/dashboard/review`）
- 今週分（編集可能）と**先週分（読み取り専用）を同時表示**
- 先週分はラベルが「先週の〜」に変わり、追加・削除ボタン非表示
- WeekNav で週移動すると両パネルが連動

### ゴールロードマップ（`/dashboard/goals`）
- 6段階のゴールカードを縦に並べて表示
  1. 🏔️ 長期ゴール
  2. 🎯 中期ゴール
  3. 🚀 短期ゴール
  4. ⚡ 短短期ゴール（3ヶ月）
  5. 📅 来月の目標
  6. 🔥 今月の目標
- メンバーごとに保存（`st_member_goals` テーブル）
- 600ms デバウンス自動保存

---

## データ移行状況

### Firebase → Supabase
- 旧ツール: `core.html`（Firebase Realtime Database）
- `export-data.html` で localStorage からエクスポート → JSON ファイル取得
- `sales-tracker-export.json`（`C:\Users\81908\Downloads\`）をマイグレーションスクリプトで処理
- 日別数字（`st_daily_metrics`）移行済み

### データ移行完了（2026-05-13）
- Firebase「岡」→ **米岡理子** に帰属確定（増岡紗貴と日付重複あり → 別人判定）
- 63件移行（重複週統合後）、米岡理子の総レコード = 91件
- 田添莉奈の5月データ追加（8件）、田沢（誤重複）削除
- 全 Firebase メンバー（稲垣・藤澤・増岡・久保・原田テスト・森・岡）→ Supabase 移行完了

---

## 主要ファイル

```
sales-tracker-next/
├── app/
│   └── dashboard/
│       ├── layout.tsx          # force-dynamic, Header+Sidebar
│       ├── page.tsx            # サマリー
│       ├── daily/page.tsx
│       ├── review/page.tsx     # 今週+先週の2パネル ★更新
│       ├── goals/page.tsx      # ゴールロードマップ ★新規
│       ├── nippo/page.tsx
│       ├── instagram/page.tsx
│       └── settings/page.tsx
├── components/dashboard/
│   ├── Header.tsx              # syncEvents, WeekNav含む
│   ├── Sidebar.tsx             # ゴールリンク追加 ★更新
│   ├── ReviewSheet.tsx         # weekStart/readOnly props ★更新
│   ├── GoalsView.tsx           # ゴールロードマップUI ★新規
│   └── ...
├── lib/
│   ├── queries.ts              # getMemberGoals/upsertMemberGoals 追加 ★更新
│   ├── supabase.ts
│   ├── store.ts                # Zustand store
│   ├── constants.ts            # METRIC_FIELDS等
│   └── date-utils.ts           # addWeeks, getWeekLabel等
└── PROGRESS.md                 # このファイル
```

---

## 既知の問題・注意事項

1. **RLS 注意**: Supabase で新テーブルを作ると RLS が自動 ON になる。  
   必ず `ALTER TABLE xxx DISABLE ROW LEVEL SECURITY;` を別途実行すること。

2. **GRANT は schema 作成後に実行**: schema SQL 内の GRANT は効かない場合がある。  
   テーブル作成後に `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;` を再実行。

3. **ビルドキャッシュ**: `.next` が壊れたら削除して再ビルド。

---

---

## 2026-05-18 セッション実装内容

### 1. TypeScript ビルドエラー修正
- `components/ui/dialog.tsx` — `React.cloneElement` の型キャスト修正（`ReactElement<any>`）
- `components/dashboard/Header.tsx` — `<SelectItem>` の無効な `textValue` prop 削除
- `components/dashboard/InstagramView.tsx` — `useQuery` 重複 import 削除
- `components/dashboard/ReviewSheet.tsx` — `pct` 重複 import 削除
- `components/dashboard/DailyMetricsTable.tsx` — `Button asChild` → styled `<label>` 置換

### 2. チーム分け機能（TOP / 2ND）

#### DB 変更
- `st_members` に `team TEXT DEFAULT 'top'` カラム追加（Supabase Management API 経由）
- メンバー割り当て:
  - **セカンドチーム**: 相部、黒沢、森口、濱田、山口（5名）
  - **トップチーム**: それ以外（14名）

#### コード変更
| ファイル | 変更内容 |
|---|---|
| `lib/supabase.ts` | `Member` 型に `team?: 'top' \| 'second'` 追加 |
| `lib/store.ts` | `currentTeam` / `setCurrentTeam` を `AppState` に追加 |
| `app/providers.tsx` | `currentTeam` state + Context に渡す |
| `components/dashboard/Header.tsx` | TOP/2ND トグルボタン追加、メンバードロップダウンをチームで絞り込み、チーム切替時に最初のメンバーを自動選択 |
| `components/dashboard/TeamSummary.tsx` | `currentTeam` でメンバーフィルタ |
| `components/dashboard/SettingsView.tsx` | `currentTeam` でメンバーフィルタ |
| `lib/queries.ts` | `createMember(name, color, team)` — team 引数追加 |

### 3. 旧プロトタイプ（harada.html）との差分機能追加

#### DB 変更
- `st_weekly_reviews` に `doin_muchaku_list JSONB DEFAULT '[]'` カラム追加

#### 新機能一覧
| 機能 | 対象ファイル |
|---|---|
| CSV 出力（週次データ） | `DailyMetricsTable.tsx` |
| CSV 取込（週次データ） | `DailyMetricsTable.tsx` |
| Instagram 月間アカウント別サマリーテーブル + CSV | `InstagramView.tsx` |
| サマリー：無着地理由ランキング（棒グラフ TOP5） | `SummaryDashboard.tsx` |
| サマリー：NG理由ランキング（棒グラフ TOP5） | `SummaryDashboard.tsx` |
| サマリー CSV 出力 | `SummaryDashboard.tsx` |
| 施策シート：確認数字（変換率）表示 | `ReviewSheet.tsx` |
| 施策シート：動員後無着地リスト入力 | `ReviewSheet.tsx` |
| 施策シート：曜日別 アポ獲得・動員実施・成約 グラフ | `ReviewSheet.tsx` |
| 残案件フィルタリング（選択メンバーが動員した案件のみ） | `SummaryDashboard.tsx` |

---

## 今後やること（バックログ）

- [x] "岡" メンバーの帰属先確認・修正 ← 米岡理子に確定・移行完了（2026-05-13）
- [ ] モバイル対応（現状 PC 前提）
- [x] チームサマリー（全メンバー一覧比較）← 2026-05-13 実装済み
- [x] チーム分け（TOP / 2ND トグル）← 2026-05-18 実装済み
- [x] CSV 入出力 ← 2026-05-18 実装済み
- [x] 施策シート グラフ ← 2026-05-18 実装済み
