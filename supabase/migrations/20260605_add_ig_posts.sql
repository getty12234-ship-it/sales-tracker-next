-- インスタ日次メトリクスに「投稿数（posts）」カラムを追加
-- 日次フロー（その日の投稿本数）
ALTER TABLE st_instagram_metrics
  ADD COLUMN IF NOT EXISTS posts INTEGER DEFAULT 0;
