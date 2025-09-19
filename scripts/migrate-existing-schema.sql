-- Migration script to update existing tables with new authentication structure
-- This adds organization and user references to existing content tables

-- First, add organization_id and updated user references to content_types
ALTER TABLE public.content_types 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Update created_by and updated_by to reference the new users table
ALTER TABLE public.content_types 
ADD COLUMN IF NOT EXISTS created_by_user UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS updated_by_user UUID REFERENCES users(id);

-- Add organization_id to content_items  
ALTER TABLE public.content_items
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Update user references in content_items
ALTER TABLE public.content_items 
ALTER COLUMN created_by TYPE UUID USING created_by::UUID,
ALTER COLUMN updated_by TYPE UUID USING updated_by::UUID;

-- Add foreign key constraints for content_items user references
ALTER TABLE public.content_items 
ADD CONSTRAINT fk_content_items_created_by FOREIGN KEY (created_by) REFERENCES users(id),
ADD CONSTRAINT fk_content_items_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);

-- Add organization_id to media_files
ALTER TABLE public.media_files
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Update user references in media_files
ALTER TABLE public.media_files 
ALTER COLUMN uploaded_by TYPE UUID USING uploaded_by::UUID;

-- Add foreign key constraint for media_files user reference
ALTER TABLE public.media_files 
ADD CONSTRAINT fk_media_files_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id);

-- Create indexes for new foreign keys
CREATE INDEX IF NOT EXISTS idx_content_types_organization_id ON content_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_content_types_created_by ON content_types(created_by_user);
CREATE INDEX IF NOT EXISTS idx_content_types_updated_by ON content_types(updated_by_user);
CREATE INDEX IF NOT EXISTS idx_content_items_organization_id ON content_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_content_items_created_by ON content_items(created_by);
CREATE INDEX IF NOT EXISTS idx_content_items_updated_by ON content_items(updated_by);
CREATE INDEX IF NOT EXISTS idx_media_files_organization_id ON media_files(organization_id);
CREATE INDEX IF NOT EXISTS idx_media_files_uploaded_by ON media_files(uploaded_by);

-- Update RLS policies for existing tables to be organization-scoped
-- Content Types policies
DROP POLICY IF EXISTS "Allow full access to content_types" ON public.content_types;
CREATE POLICY "Organization members can access content types" ON public.content_types
    FOR ALL USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.uid() 
            AND om.is_active = true
        )
    );

-- Content Items policies  
DROP POLICY IF EXISTS "Allow full access to content_items" ON public.content_items;
CREATE POLICY "Organization members can access content items" ON public.content_items
    FOR ALL USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.uid() 
            AND om.is_active = true
        )
    );

-- Media Files policies
DROP POLICY IF EXISTS "Allow full access to media_files" ON public.media_files;
CREATE POLICY "Organization members can access media files" ON public.media_files
    FOR ALL USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.uid() 
            AND om.is_active = true
        )
    );

-- Create function to get user's current organization context
CREATE OR REPLACE FUNCTION public.get_current_user_organization()
RETURNS UUID AS $$
DECLARE
    org_id UUID;
BEGIN
    -- This will be set by the application based on JWT token context
    -- For now, return the first organization the user belongs to
    SELECT om.organization_id INTO org_id
    FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    ORDER BY om.joined_at ASC
    LIMIT 1;
    
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has permission for an action
CREATE OR REPLACE FUNCTION public.user_has_permission(
    user_id UUID,
    org_id UUID,
    permission_name TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    has_permission BOOLEAN := false;
BEGIN
    -- Get user's role in the organization
    SELECT om.role INTO user_role
    FROM organization_members om
    WHERE om.user_id = user_id
    AND om.organization_id = org_id
    AND om.is_active = true;
    
    -- Check if the role has the requested permission
    SELECT EXISTS(
        SELECT 1
        FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role = user_role
        AND p.name = permission_name
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get plan limits for an organization
CREATE OR REPLACE FUNCTION public.get_plan_limits(org_id UUID)
RETURNS JSON AS $$
DECLARE
    plan_type TEXT;
    limits JSON;
BEGIN
    -- Get organization's current plan
    SELECT o.plan_type INTO plan_type
    FROM organizations o
    WHERE o.id = org_id;
    
    -- Define limits based on plan type
    CASE plan_type
        WHEN 'free' THEN
            limits := json_build_object(
                'content_types', 1,
                'content_items', 10,
                'media_files', 5,
                'ai_requests_per_month', 10,
                'api_calls_per_month', 100
            );
        WHEN 'pro' THEN
            limits := json_build_object(
                'content_types', 10,
                'content_items', 1000,
                'media_files', 100,
                'ai_requests_per_month', 500,
                'api_calls_per_month', 10000
            );
        WHEN 'enterprise' THEN
            limits := json_build_object(
                'content_types', -1,  -- -1 means unlimited
                'content_items', -1,
                'media_files', -1,
                'ai_requests_per_month', -1,
                'api_calls_per_month', -1
            );
        ELSE
            limits := json_build_object(
                'content_types', 0,
                'content_items', 0,
                'media_files', 0,
                'ai_requests_per_month', 0,
                'api_calls_per_month', 0
            );
    END CASE;
    
    RETURN limits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if organization has reached a usage limit
CREATE OR REPLACE FUNCTION public.check_usage_limit(
    org_id UUID,
    metric_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    current_usage INTEGER;
    plan_limits JSON;
    limit_value INTEGER;
BEGIN
    -- Get current usage for this period
    SELECT COALESCE(um.current_usage, 0) INTO current_usage
    FROM usage_metrics um
    WHERE um.organization_id = org_id
    AND um.metric_type = metric_type
    AND um.period_start <= NOW()
    AND um.period_end >= NOW();
    
    -- Get plan limits
    plan_limits := get_plan_limits(org_id);
    limit_value := (plan_limits ->> metric_type)::INTEGER;
    
    -- If limit is -1 (unlimited), return false (not at limit)
    IF limit_value = -1 THEN
        RETURN false;
    END IF;
    
    -- Return true if at or over limit
    RETURN current_usage >= limit_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;