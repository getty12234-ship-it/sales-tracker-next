-- Instagram メトリクス: スプレッドシート相当の項目を追加
-- フォロー削り / フォロワー削り / 動員獲得 / ブロックチェック
-- Supabase Dashboard の SQL Editor で実行してください
-- URL: https://supabase.com/dashboard/project/pbctrjnnrvssdyywgtdx/sql/new
-- ※ 本番には2026-05-30に適用済み

ALTER TABLE st_instagram_metrics
  ADD COLUMN IF NOT EXISTS follow_trim   integer NOT NULL DEFAULT 0,  -- フォロー削り（日次）
  ADD COLUMN IF NOT EXISTS follower_trim integer NOT NULL DEFAULT 0,  -- フォロワー削り（日次）
  ADD COLUMN IF NOT EXISTS ig_doin_get   integer NOT NULL DEFAULT 0,  -- 動員獲得（日次）
  ADD COLUMN IF NOT EXISTS blocked       boolean NOT NULL DEFAULT false; -- その日ブロックされたか
