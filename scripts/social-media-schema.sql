-- Social Media Integration Database Schema
-- Run this in Supabase SQL editor to create the required tables

-- Create social_accounts table for storing connected social media accounts
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('facebook', 'twitter', 'linkedin', 'instagram')),
  account_name VARCHAR(255) NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(platform, account_id)
);

-- Create social_posts table for storing scheduled and published posts
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id VARCHAR(255) NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('facebook', 'twitter', 'linkedin', 'instagram')),
  account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'published', 'failed', 'cancelled')),
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  published_time TIMESTAMP WITH TIME ZONE,
  platform_post_id VARCHAR(255),
  post_data JSONB NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scheduling_rules table for optimal posting times per platform
CREATE TABLE IF NOT EXISTS scheduling_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('facebook', 'twitter', 'linkedin', 'instagram')),
  optimal_hour INTEGER NOT NULL CHECK (optimal_hour >= 0 AND optimal_hour <= 23),
  optimal_minute INTEGER NOT NULL DEFAULT 0 CHECK (optimal_minute >= 0 AND optimal_minute <= 59),
  timezone VARCHAR(50) DEFAULT 'UTC',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(platform)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_active ON social_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_social_posts_content_id ON social_posts(content_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_time ON social_posts(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_scheduling_rules_platform ON scheduling_rules(platform);
CREATE INDEX IF NOT EXISTS idx_scheduling_rules_active ON scheduling_rules(is_active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_social_accounts_updated_at 
  BEFORE UPDATE ON social_accounts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_posts_updated_at 
  BEFORE UPDATE ON social_posts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduling_rules_updated_at 
  BEFORE UPDATE ON scheduling_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default optimal posting times
INSERT INTO scheduling_rules (platform, optimal_hour, optimal_minute, timezone, is_active)
VALUES 
  ('facebook', 15, 0, 'UTC', true),    -- 3:00 PM UTC
  ('twitter', 8, 0, 'UTC', true),      -- 8:00 AM UTC  
  ('linkedin', 12, 0, 'UTC', true),    -- 12:00 PM UTC
  ('instagram', 19, 0, 'UTC', true)    -- 7:00 PM UTC
ON CONFLICT (platform) DO NOTHING;

-- Create RLS (Row Level Security) policies
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_rules ENABLE ROW LEVEL SECURITY;

-- Allow service role to access all data (for backend API)
CREATE POLICY "Service role can access social_accounts" ON social_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can access social_posts" ON social_posts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can access scheduling_rules" ON scheduling_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Grant permissions to service role
GRANT ALL ON social_accounts TO service_role;
GRANT ALL ON social_posts TO service_role;
GRANT ALL ON scheduling_rules TO service_role;

-- Create function to get social media analytics
CREATE OR REPLACE FUNCTION get_social_media_analytics(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  platform VARCHAR(20),
  total_posts BIGINT,
  published_posts BIGINT,
  failed_posts BIGINT,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.platform,
    COUNT(*) as total_posts,
    COUNT(*) FILTER (WHERE sp.status = 'published') as published_posts,
    COUNT(*) FILTER (WHERE sp.status = 'failed') as failed_posts,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND(COUNT(*) FILTER (WHERE sp.status = 'published')::NUMERIC / COUNT(*)::NUMERIC * 100, 2)
      ELSE 0 
    END as success_rate
  FROM social_posts sp
  WHERE sp.created_at >= start_date AND sp.created_at <= end_date
  GROUP BY sp.platform
  ORDER BY sp.platform;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get upcoming scheduled posts
CREATE OR REPLACE FUNCTION get_upcoming_posts(
  hours_ahead INTEGER DEFAULT 24
)
RETURNS TABLE (
  id UUID,
  content_id VARCHAR(255),
  platform VARCHAR(20),
  account_name VARCHAR(255),
  scheduled_time TIMESTAMP WITH TIME ZONE,
  post_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id,
    sp.content_id,
    sp.platform,
    sa.account_name,
    sp.scheduled_time,
    (sp.post_data->>'message')::TEXT as post_message
  FROM social_posts sp
  JOIN social_accounts sa ON sp.account_id = sa.id
  WHERE sp.status = 'scheduled'
    AND sp.scheduled_time BETWEEN NOW() AND NOW() + (hours_ahead || ' hours')::INTERVAL
  ORDER BY sp.scheduled_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE social_accounts IS 'Stores connected social media account credentials and metadata';
COMMENT ON TABLE social_posts IS 'Stores scheduled, published, and failed social media posts';
COMMENT ON TABLE scheduling_rules IS 'Defines optimal posting times for each social media platform';
COMMENT ON FUNCTION get_social_media_analytics IS 'Returns analytics data for social media posts within a date range';
COMMENT ON FUNCTION get_upcoming_posts IS 'Returns upcoming scheduled posts within specified hours';