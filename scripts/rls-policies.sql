-- Enhanced Row Level Security Policies for Multi-tenant Architecture
-- This script creates secure, organization-scoped RLS policies

-- First, let's create a helper function to get the current user from JWT
CREATE OR REPLACE FUNCTION auth.user_id() RETURNS UUID AS $$
BEGIN
  RETURN auth.jwt() ->> 'sub';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's organization from JWT context
CREATE OR REPLACE FUNCTION auth.user_organization_id() RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt() ->> 'organizationId')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user belongs to organization
CREATE OR REPLACE FUNCTION public.user_belongs_to_organization(user_id UUID, org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM organization_members om
    WHERE om.user_id = user_id 
    AND om.organization_id = org_id 
    AND om.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check user permissions
CREATE OR REPLACE FUNCTION public.user_has_permission(
  user_id UUID,
  org_id UUID,
  permission_name TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user's role in the organization
  SELECT om.role INTO user_role
  FROM organization_members om
  WHERE om.user_id = user_id
  AND om.organization_id = org_id
  AND om.is_active = true;
  
  -- If no role found, deny access
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if the role has the requested permission
  RETURN EXISTS(
    SELECT 1
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role = user_role
    AND p.name = permission_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop all existing policies before creating new ones
DROP POLICY IF EXISTS "Organization members can access organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can access their own data" ON public.users;
DROP POLICY IF EXISTS "Organization members can access memberships" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners can access subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Organization members can access usage metrics" ON public.usage_metrics;
DROP POLICY IF EXISTS "Organization members can access API tokens" ON public.api_tokens;
DROP POLICY IF EXISTS "Users can access their refresh tokens" ON public.refresh_tokens;
DROP POLICY IF EXISTS "Users can access their sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Allow read access to permissions" ON public.permissions;
DROP POLICY IF EXISTS "Allow read access to role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Organization members can access content types" ON public.content_types;
DROP POLICY IF EXISTS "Organization members can access content items" ON public.content_items;
DROP POLICY IF EXISTS "Organization members can access media files" ON public.media_files;

-- Organizations: Users can only see organizations they belong to
CREATE POLICY "Organization members can access organizations" ON public.organizations
    FOR ALL USING (
        id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        )
    )
    WITH CHECK (
        id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
            AND om.role IN ('owner', 'admin')
        )
    );

-- Users: Users can see their own profile and profiles of users in their organizations
CREATE POLICY "Users can access user data" ON public.users
    FOR SELECT USING (
        id = auth.user_id() OR
        id IN (
            SELECT DISTINCT om2.user_id
            FROM organization_members om1
            JOIN organization_members om2 ON om1.organization_id = om2.organization_id
            WHERE om1.user_id = auth.user_id()
            AND om1.is_active = true
            AND om2.is_active = true
        )
    );

-- Users can only update their own profile
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (id = auth.user_id())
    WITH CHECK (id = auth.user_id());

-- Users cannot insert or delete (registration is handled separately)
CREATE POLICY "Users cannot insert themselves" ON public.users
    FOR INSERT WITH CHECK (false);

CREATE POLICY "Users cannot delete themselves" ON public.users
    FOR DELETE USING (false);

-- Organization Members: Can see members of their organizations
CREATE POLICY "Organization members can access memberships" ON public.organization_members
    FOR SELECT USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        )
    );

-- Only owners and admins can modify memberships
CREATE POLICY "Organization admins can modify memberships" ON public.organization_members
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
            AND om.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Organization admins can update memberships" ON public.organization_members
    FOR UPDATE USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
            AND om.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
            AND om.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Organization admins can delete memberships" ON public.organization_members
    FOR DELETE USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
            AND om.role IN ('owner', 'admin')
        )
    );

-- Subscriptions: Only organization owners and admins can access
CREATE POLICY "Organization owners can access subscriptions" ON public.subscriptions
    FOR ALL USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
            AND om.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
            AND om.role IN ('owner', 'admin')
        )
    );

-- Usage Metrics: Organization members can read, owners/admins can modify
CREATE POLICY "Organization members can read usage metrics" ON public.usage_metrics
    FOR SELECT USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        )
    );

CREATE POLICY "Organization admins can modify usage metrics" ON public.usage_metrics
    FOR ALL USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
            AND om.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
            AND om.role IN ('owner', 'admin')
        )
    );

-- API Tokens: Organization members can see organization tokens
CREATE POLICY "Organization members can access API tokens" ON public.api_tokens
    FOR SELECT USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        )
    );

-- Users can create/modify their own tokens
CREATE POLICY "Users can manage their own API tokens" ON public.api_tokens
    FOR ALL USING (user_id = auth.user_id())
    WITH CHECK (user_id = auth.user_id());

-- Refresh Tokens: Users can only access their own
CREATE POLICY "Users can access their refresh tokens" ON public.refresh_tokens
    FOR ALL USING (user_id = auth.user_id())
    WITH CHECK (user_id = auth.user_id());

-- User Sessions: Users can only access their own
CREATE POLICY "Users can access their sessions" ON public.user_sessions
    FOR ALL USING (user_id = auth.user_id())
    WITH CHECK (user_id = auth.user_id());

-- Permissions: Read-only for all authenticated users
CREATE POLICY "Allow read access to permissions" ON public.permissions
    FOR SELECT USING (auth.user_id() IS NOT NULL);

-- Role Permissions: Read-only for all authenticated users
CREATE POLICY "Allow read access to role permissions" ON public.role_permissions
    FOR SELECT USING (auth.user_id() IS NOT NULL);

-- Content Types: Organization-scoped access with permission checks
CREATE POLICY "Organization members can read content types" ON public.content_types
    FOR SELECT USING (
        organization_id IS NULL OR  -- Allow access to global content types
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        )
    );

CREATE POLICY "Users with permission can create content types" ON public.content_types
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        ) AND
        user_has_permission(auth.user_id(), organization_id, 'content_types.create')
    );

CREATE POLICY "Users with permission can update content types" ON public.content_types
    FOR UPDATE USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        ) AND
        user_has_permission(auth.user_id(), organization_id, 'content_types.update')
    )
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        ) AND
        user_has_permission(auth.user_id(), organization_id, 'content_types.update')
    );

CREATE POLICY "Users with permission can delete content types" ON public.content_types
    FOR DELETE USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        ) AND
        user_has_permission(auth.user_id(), organization_id, 'content_types.delete')
    );

-- Content Items: Organization-scoped access with permission checks
CREATE POLICY "Organization members can read content items" ON public.content_items
    FOR SELECT USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        ) AND
        user_has_permission(auth.user_id(), organization_id, 'content_items.read')
    );

CREATE POLICY "Users with permission can create content items" ON public.content_items
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        ) AND
        user_has_permission(auth.user_id(), organization_id, 'content_items.create')
    );

CREATE POLICY "Users with permission can update content items" ON public.content_items
    FOR UPDATE USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        ) AND
        user_has_permission(auth.user_id(), organization_id, 'content_items.update')
    )
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        ) AND
        user_has_permission(auth.user_id(), organization_id, 'content_items.update')
    );

CREATE POLICY "Users with permission can delete content items" ON public.content_items
    FOR DELETE USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        ) AND
        user_has_permission(auth.user_id(), organization_id, 'content_items.delete')
    );

-- Media Files: Organization-scoped access with permission checks
CREATE POLICY "Organization members can read media files" ON public.media_files
    FOR SELECT USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        ) AND
        user_has_permission(auth.user_id(), organization_id, 'media_files.read')
    );

CREATE POLICY "Users with permission can create media files" ON public.media_files
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        ) AND
        user_has_permission(auth.user_id(), organization_id, 'media_files.create')
    );

CREATE POLICY "Users with permission can update media files" ON public.media_files
    FOR UPDATE USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        ) AND
        user_has_permission(auth.user_id(), organization_id, 'media_files.update')
    )
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        ) AND
        user_has_permission(auth.user_id(), organization_id, 'media_files.update')
    );

CREATE POLICY "Users with permission can delete media files" ON public.media_files
    FOR DELETE USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.user_id()
            AND om.is_active = true
        ) AND
        user_has_permission(auth.user_id(), organization_id, 'media_files.delete')
    );

-- Grant necessary permissions to service role (for server-side operations)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant read access to authenticated users for reference tables
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;

-- Ensure all tables have RLS enabled
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;