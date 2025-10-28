-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create content_types table
CREATE TABLE IF NOT EXISTS public.content_types (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    schema JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create content_items table
CREATE TABLE IF NOT EXISTS public.content_items (
    id VARCHAR(255) PRIMARY KEY,
    content_type_id VARCHAR(255) NOT NULL REFERENCES content_types(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Create media_files table
CREATE TABLE IF NOT EXISTS public.media_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    alt_text TEXT,
    caption TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_content_items_content_type ON content_items(content_type_id);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_published_at ON content_items(published_at);
CREATE INDEX IF NOT EXISTS idx_content_items_created_at ON content_items(created_at);
CREATE INDEX IF NOT EXISTS idx_media_files_created_at ON media_files(created_at);
CREATE INDEX IF NOT EXISTS idx_media_files_mime_type ON media_files(mime_type);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS set_updated_at_content_types ON public.content_types;
CREATE TRIGGER set_updated_at_content_types
    BEFORE UPDATE ON public.content_types
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_content_items ON public.content_items;
CREATE TRIGGER set_updated_at_content_items
    BEFORE UPDATE ON public.content_items
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security
ALTER TABLE public.content_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;

-- Create social_accounts table for social media account management
CREATE TABLE IF NOT EXISTS public.social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('linkedin', 'facebook', 'twitter', 'instagram')),
    account_name VARCHAR(255) NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    account_data JSONB DEFAULT '{}', -- Store profile info, permissions, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(platform, account_id)
);

-- Create social_posts table for scheduled and published posts
CREATE TABLE IF NOT EXISTS public.social_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id VARCHAR(255), -- Reference to source content (optional)
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('linkedin', 'facebook', 'twitter', 'instagram')),
    account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'published', 'failed', 'cancelled')),
    scheduled_time TIMESTAMP WITH TIME ZONE,
    published_time TIMESTAMP WITH TIME ZONE,
    post_data JSONB NOT NULL DEFAULT '{}', -- Platform-specific post content
    platform_post_id VARCHAR(255), -- ID returned by social platform
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    analytics_data JSONB DEFAULT '{}', -- Engagement metrics
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create content_social_mappings table to link content_items with social posts
CREATE TABLE IF NOT EXISTS public.content_social_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_item_id VARCHAR(255) NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    social_post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('linkedin', 'facebook', 'twitter', 'instagram')),
    auto_publish BOOLEAN DEFAULT true,
    publish_immediately BOOLEAN DEFAULT false, -- true for immediate, false for scheduled
    custom_message TEXT, -- Custom social media message override
    hashtags TEXT[], -- Array of hashtags
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'skipped')),
    published_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(content_item_id, social_post_id)
);

-- Create additional indexes for social media tables
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_active ON social_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_time ON social_posts(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_social_posts_account_id ON social_posts(account_id);
CREATE INDEX IF NOT EXISTS idx_content_social_mappings_content_id ON content_social_mappings(content_item_id);
CREATE INDEX IF NOT EXISTS idx_content_social_mappings_platform ON content_social_mappings(platform);
CREATE INDEX IF NOT EXISTS idx_content_social_mappings_status ON content_social_mappings(status);

-- Add updated_at triggers for social media tables
DROP TRIGGER IF EXISTS set_updated_at_social_accounts ON public.social_accounts;
CREATE TRIGGER set_updated_at_social_accounts
    BEFORE UPDATE ON public.social_accounts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_social_posts ON public.social_posts;
CREATE TRIGGER set_updated_at_social_posts
    BEFORE UPDATE ON public.social_posts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_content_social_mappings ON public.content_social_mappings;
CREATE TRIGGER set_updated_at_content_social_mappings
    BEFORE UPDATE ON public.content_social_mappings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security for social media tables
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_social_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for service role, can be refined later)
DROP POLICY IF EXISTS "Allow full access to content_types" ON public.content_types;
CREATE POLICY "Allow full access to content_types" ON public.content_types
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access to content_items" ON public.content_items;
CREATE POLICY "Allow full access to content_items" ON public.content_items
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access to media_files" ON public.media_files;
CREATE POLICY "Allow full access to media_files" ON public.media_files
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access to social_accounts" ON public.social_accounts;
CREATE POLICY "Allow full access to social_accounts" ON public.social_accounts
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access to social_posts" ON public.social_posts;
CREATE POLICY "Allow full access to social_posts" ON public.social_posts
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access to content_social_mappings" ON public.content_social_mappings;
CREATE POLICY "Allow full access to content_social_mappings" ON public.content_social_mappings
    FOR ALL USING (true);