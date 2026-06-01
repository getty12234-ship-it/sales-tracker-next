-- Instagramアカウントの「現在の数値」スナップショット（プロフィール最新値）
-- フォロワー / フォロー中 / 投稿数 をアカウント単位で保持
-- Supabase Dashboard の SQL Editor で実行してください
-- ※ 本番には2026-05-30に適用済み

ALTER TABLE st_instagram_accounts
  ADD COLUMN IF NOT EXISTS cur_followers integer NOT NULL DEFAULT 0,  -- 現在のフォロワー数
  ADD COLUMN IF NOT EXISTS cur_follows   integer NOT NULL DEFAULT 0,  -- 現在のフォロー中数
  ADD COLUMN IF NOT EXISTS cur_posts     integer NOT NULL DEFAULT 0;  -- 現在の投稿数
