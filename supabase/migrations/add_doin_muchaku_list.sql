-- 動員後無着地リスト カラム追加
-- Supabase Dashboard の SQL Editor で実行してください
-- URL: https://supabase.com/dashboard/project/pbctrjnnrvssdyywgtdx/editor

ALTER TABLE st_weekly_reviews
  ADD COLUMN IF NOT EXISTS doin_muchaku_list JSONB DEFAULT '[]'::jsonb;
