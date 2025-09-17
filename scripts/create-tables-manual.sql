-- Manual SQL to run in Supabase SQL Editor
-- Go to https://supabase.com/dashboard/project/neezcjbguizmkbyglroe/sql/new
-- Copy and paste this SQL and click "Run"

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