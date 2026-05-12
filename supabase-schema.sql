-- =============================================
-- Sales Tracker Next - Supabase Schema
-- =============================================
-- ※ Supabase SQL Editorで実行してください

-- メンバーテーブル
CREATE TABLE IF NOT EXISTS st_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 日別数字テーブル
CREATE TABLE IF NOT EXISTS st_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES st_members(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  -- SNS・LINE
  post INTEGER DEFAULT 0,
  line_exchange INTEGER DEFAULT 0,
  -- アポ
  apo_get INTEGER DEFAULT 0,
  apo_exec INTEGER DEFAULT 0,
  apo_cxl INTEGER DEFAULT 0,
  -- テストクロ・オファー
  test_close INTEGER DEFAULT 0,
  offer INTEGER DEFAULT 0,
  -- NG・無着地
  ng INTEGER DEFAULT 0,
  muchaku INTEGER DEFAULT 0,
  -- 動員
  doin_get INTEGER DEFAULT 0,
  doin_get_cxl INTEGER DEFAULT 0,
  doin_exec INTEGER DEFAULT 0,
  doin_exec_cxl INTEGER DEFAULT 0,
  -- 面談・成約
  mendan_get INTEGER DEFAULT 0,
  mendan_exec INTEGER DEFAULT 0,
  seiyaku INTEGER DEFAULT 0,
  cooling_off INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, date)
);

-- 週次レビューテーブル
CREATE TABLE IF NOT EXISTS st_weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES st_members(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL, -- 月曜日
  main_issue TEXT DEFAULT '',
  main_cause TEXT DEFAULT '',
  top_action TEXT DEFAULT '',
  cause_actions JSONB DEFAULT '[]'::jsonb,
  muchaku_reasons JSONB DEFAULT '[]'::jsonb,
  ng_reasons JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, week_start_date)
);

-- 日報テーブル
CREATE TABLE IF NOT EXISTS st_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES st_members(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  video_url TEXT DEFAULT '',
  output TEXT DEFAULT '',
  gratitude TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, date)
);

-- 月別動画テーブル
CREATE TABLE IF NOT EXISTS st_monthly_videos (
  date DATE PRIMARY KEY,
  video_url TEXT NOT NULL
);

-- Instagramアカウントテーブル
CREATE TABLE IF NOT EXISTS st_instagram_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES st_members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Instagram数字テーブル
CREATE TABLE IF NOT EXISTS st_instagram_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES st_instagram_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  follows INTEGER DEFAULT 0,
  followers INTEGER DEFAULT 0,
  dm_send INTEGER DEFAULT 0,
  dm_reply INTEGER DEFAULT 0,
  ig_offer INTEGER DEFAULT 0,
  ig_apo_get INTEGER DEFAULT 0,
  ig_apo_exec INTEGER DEFAULT 0,
  ig_doin_exec INTEGER DEFAULT 0,
  ig_seiyaku INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, date)
);

-- 設定テーブル（メンバーごとの目標値）
CREATE TABLE IF NOT EXISTS st_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES st_members(id) ON DELETE CASCADE UNIQUE,
  goals JSONB DEFAULT '{
    "seiyaku": 3,
    "mendan_exec": 6,
    "doin_exec": 12,
    "apo_exec": 20,
    "offer": 12,
    "apo_get": 30,
    "post": 30,
    "line_exchange": 60,
    "doin_get": 20
  }'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5月2026動画シード
INSERT INTO st_monthly_videos (date, video_url) VALUES
  ('2026-05-01', 'https://www.youtube.com/watch?v=vbO4QV6YHcA'),
  ('2026-05-02', 'https://www.youtube.com/watch?v=c5tDSRWfYW4'),
  ('2026-05-03', 'https://www.youtube.com/watch?v=Xe6ynFpYXWU'),
  ('2026-05-04', 'https://www.youtube.com/watch?v=7RYqQmUKcSI'),
  ('2026-05-05', 'https://www.youtube.com/watch?v=9mMzs2Lsz6M'),
  ('2026-05-06', 'https://www.youtube.com/watch?v=3a_gVVPQNd0'),
  ('2026-05-07', 'https://www.youtube.com/watch?v=XZGMoA4PXWM'),
  ('2026-05-08', 'https://www.youtube.com/watch?v=d21Rv6JLBWE'),
  ('2026-05-09', 'https://www.youtube.com/watch?v=nVxkVqKh0Go'),
  ('2026-05-10', 'https://www.youtube.com/watch?v=RMWdRBGdJSk'),
  ('2026-05-11', 'https://www.youtube.com/watch?v=JCQFuA7BveA'),
  ('2026-05-12', 'https://www.youtube.com/watch?v=G6wFQB-RFUI'),
  ('2026-05-13', 'https://www.youtube.com/watch?v=K0IkNpT9kQ0'),
  ('2026-05-14', 'https://www.youtube.com/watch?v=lhI2qEm5bJI'),
  ('2026-05-15', 'https://www.youtube.com/watch?v=fLJsdqxnZb0'),
  ('2026-05-16', 'https://www.youtube.com/watch?v=N2_7Fj56g5I'),
  ('2026-05-17', 'https://www.youtube.com/watch?v=vqZ4e-iH-6o'),
  ('2026-05-18', 'https://www.youtube.com/watch?v=UF8uR6Z6KLc'),
  ('2026-05-19', 'https://www.youtube.com/watch?v=WXuK6gekU1Y'),
  ('2026-05-20', 'https://www.youtube.com/watch?v=9bZkp7q19f0'),
  ('2026-05-21', 'https://www.youtube.com/watch?v=a-_MLOhPUnE'),
  ('2026-05-22', 'https://www.youtube.com/watch?v=Ks-_Mh1QhMc'),
  ('2026-05-23', 'https://www.youtube.com/watch?v=YykjpeuMNEk'),
  ('2026-05-24', 'https://www.youtube.com/watch?v=ZZ5LpwO-An4'),
  ('2026-05-25', 'https://www.youtube.com/watch?v=ktvTqknDobU'),
  ('2026-05-26', 'https://www.youtube.com/watch?v=r1CH8N0BAFI'),
  ('2026-05-27', 'https://www.youtube.com/watch?v=bM7SZ5SBzyY'),
  ('2026-05-28', 'https://www.youtube.com/watch?v=hY7m5jjJ9s8'),
  ('2026-05-29', 'https://www.youtube.com/watch?v=kGLBkGRxXHc'),
  ('2026-05-30', 'https://www.youtube.com/watch?v=3JZ_D3ELwOA'),
  ('2026-05-31', 'https://www.youtube.com/watch?v=HRPkW_IUWcI')
ON CONFLICT (date) DO NOTHING;

-- RLS（Row Level Security）- 今回はパスコード認証なのでdisable
ALTER TABLE st_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE st_daily_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE st_weekly_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE st_daily_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE st_monthly_videos DISABLE ROW LEVEL SECURITY;
ALTER TABLE st_instagram_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE st_instagram_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE st_settings DISABLE ROW LEVEL SECURITY;

-- updated_atを自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_metrics_updated_at BEFORE UPDATE ON st_daily_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER weekly_reviews_updated_at BEFORE UPDATE ON st_weekly_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER daily_reports_updated_at BEFORE UPDATE ON st_daily_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON st_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
