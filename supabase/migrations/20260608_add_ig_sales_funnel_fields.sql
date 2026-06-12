-- インスタ日次メトリクスに「その他の獲得方法」と同じ商談フロー項目を追加
-- （アポCXL / テストクロ / NG / 無着地 / LINE交換 / 動員獲得CXL / 動員実施CXL / 面談獲得 / 面談実施 / クーリングOFF）
-- ※ 本番には適用済み（堀川アカウントのメトリクスで確認）
-- URL: https://supabase.com/dashboard/project/pbctrjnnrvssdyywgtdx/sql/new
ALTER TABLE st_instagram_metrics
  ADD COLUMN IF NOT EXISTS ig_apo_cxl        integer NOT NULL DEFAULT 0,  -- アポCXL（キャンセル）
  ADD COLUMN IF NOT EXISTS ig_test_close     integer NOT NULL DEFAULT 0,  -- テストクロ
  ADD COLUMN IF NOT EXISTS ig_ng             integer NOT NULL DEFAULT 0,  -- NG
  ADD COLUMN IF NOT EXISTS ig_muchaku        integer NOT NULL DEFAULT 0,  -- 無着地
  ADD COLUMN IF NOT EXISTS ig_line_exchange  integer NOT NULL DEFAULT 0,  -- LINE交換
  ADD COLUMN IF NOT EXISTS ig_doin_get_cxl   integer NOT NULL DEFAULT 0,  -- 動員獲得CXL
  ADD COLUMN IF NOT EXISTS ig_doin_exec_cxl  integer NOT NULL DEFAULT 0,  -- 動員実施CXL
  ADD COLUMN IF NOT EXISTS ig_mendan_get     integer NOT NULL DEFAULT 0,  -- 面談獲得
  ADD COLUMN IF NOT EXISTS ig_mendan_exec    integer NOT NULL DEFAULT 0,  -- 面談実施
  ADD COLUMN IF NOT EXISTS ig_cooling_off    integer NOT NULL DEFAULT 0;  -- クーリングOFF
