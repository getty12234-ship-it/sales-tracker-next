-- 今月の目標・予算メモ（自由記述）を月別に保存
-- st_settings.monthly_goals JSONB に { "YYYY-MM": "本文", ... } で格納
-- Supabase Dashboard の SQL Editor で実行してください
-- ※ 本番には2026-05-30に適用済み

ALTER TABLE st_settings
  ADD COLUMN IF NOT EXISTS monthly_goals jsonb NOT NULL DEFAULT '{}'::jsonb;
