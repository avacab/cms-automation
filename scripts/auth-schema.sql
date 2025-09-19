-- Enhanced Authentication & Authorization Schema
-- This extends the existing schema with user management, organizations, and subscription support

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations table for multi-tenant architecture
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    website_url TEXT,
    logo_url TEXT,
    plan_type VARCHAR(20) DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'enterprise')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT false,
    email_verification_token TEXT,
    password_reset_token TEXT,
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization members (users can belong to multiple organizations)
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Subscriptions table for billing
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('free', 'pro', 'enterprise')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing')),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT false,
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage tracking for freemium limits
CREATE TABLE IF NOT EXISTS public.usage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- 'content_types', 'content_items', 'media_files', 'ai_requests'
    current_usage INTEGER DEFAULT 0,
    period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 month'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, metric_type, period_start)
);

-- API tokens for programmatic access
CREATE TABLE IF NOT EXISTS public.api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    token_hash TEXT NOT NULL,
    scopes TEXT[] DEFAULT ARRAY['read'], -- ['read', 'write', 'admin']
    last_used TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refresh tokens for JWT authentication
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions for tracking active sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permissions for fine-grained access control
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    resource_type VARCHAR(50) NOT NULL, -- 'content_types', 'content_items', 'media_files', 'organization', 'users'
    action VARCHAR(20) NOT NULL, -- 'create', 'read', 'update', 'delete', 'manage'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Role permissions mapping
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(20) NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(role, permission_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_org_type ON usage_metrics(organization_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_api_tokens_org_id ON api_tokens(organization_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource_type, action);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS set_updated_at_organizations ON public.organizations;
CREATE TRIGGER set_updated_at_organizations
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_users ON public.users;
CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_subscriptions ON public.subscriptions;
CREATE TRIGGER set_updated_at_subscriptions
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_usage_metrics ON public.usage_metrics;
CREATE TRIGGER set_updated_at_usage_metrics
    BEFORE UPDATE ON public.usage_metrics
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security on new tables
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

-- Create RLS policies (temporarily allow all, will be refined later)
DROP POLICY IF EXISTS "Allow full access to organizations" ON public.organizations;
CREATE POLICY "Allow full access to organizations" ON public.organizations
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access to users" ON public.users;
CREATE POLICY "Allow full access to users" ON public.users
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access to organization_members" ON public.organization_members;
CREATE POLICY "Allow full access to organization_members" ON public.organization_members
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access to subscriptions" ON public.subscriptions;
CREATE POLICY "Allow full access to subscriptions" ON public.subscriptions
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access to usage_metrics" ON public.usage_metrics;
CREATE POLICY "Allow full access to usage_metrics" ON public.usage_metrics
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access to api_tokens" ON public.api_tokens;
CREATE POLICY "Allow full access to api_tokens" ON public.api_tokens
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access to refresh_tokens" ON public.refresh_tokens;
CREATE POLICY "Allow full access to refresh_tokens" ON public.refresh_tokens
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access to user_sessions" ON public.user_sessions;
CREATE POLICY "Allow full access to user_sessions" ON public.user_sessions
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access to permissions" ON public.permissions;
CREATE POLICY "Allow full access to permissions" ON public.permissions
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access to role_permissions" ON public.role_permissions;
CREATE POLICY "Allow full access to role_permissions" ON public.role_permissions
    FOR ALL USING (true);

-- Insert default permissions
INSERT INTO public.permissions (name, description, resource_type, action) VALUES
    -- Content Types permissions
    ('content_types.create', 'Create content types', 'content_types', 'create'),
    ('content_types.read', 'Read content types', 'content_types', 'read'),
    ('content_types.update', 'Update content types', 'content_types', 'update'),
    ('content_types.delete', 'Delete content types', 'content_types', 'delete'),
    ('content_types.manage', 'Full management of content types', 'content_types', 'manage'),
    
    -- Content Items permissions
    ('content_items.create', 'Create content items', 'content_items', 'create'),
    ('content_items.read', 'Read content items', 'content_items', 'read'),
    ('content_items.update', 'Update content items', 'content_items', 'update'),
    ('content_items.delete', 'Delete content items', 'content_items', 'delete'),
    ('content_items.publish', 'Publish content items', 'content_items', 'publish'),
    ('content_items.manage', 'Full management of content items', 'content_items', 'manage'),
    
    -- Media Files permissions
    ('media_files.create', 'Upload media files', 'media_files', 'create'),
    ('media_files.read', 'View media files', 'media_files', 'read'),
    ('media_files.update', 'Update media files', 'media_files', 'update'),
    ('media_files.delete', 'Delete media files', 'media_files', 'delete'),
    ('media_files.manage', 'Full management of media files', 'media_files', 'manage'),
    
    -- Organization permissions
    ('organization.read', 'View organization details', 'organization', 'read'),
    ('organization.update', 'Update organization settings', 'organization', 'update'),
    ('organization.manage', 'Full organization management', 'organization', 'manage'),
    ('organization.billing', 'Manage billing and subscriptions', 'organization', 'billing'),
    
    -- User management permissions
    ('users.invite', 'Invite users to organization', 'users', 'invite'),
    ('users.read', 'View user details', 'users', 'read'),
    ('users.update', 'Update user roles', 'users', 'update'),
    ('users.remove', 'Remove users from organization', 'users', 'remove'),
    ('users.manage', 'Full user management', 'users', 'manage')
ON CONFLICT (name) DO NOTHING;

-- Insert role permissions mapping
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'owner', id FROM public.permissions; -- Owner has all permissions

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', id FROM public.permissions
WHERE name NOT IN ('organization.manage', 'users.manage'); -- Admin has most permissions except organization management

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'editor', id FROM public.permissions
WHERE resource_type IN ('content_types', 'content_items', 'media_files')
AND action IN ('create', 'read', 'update', 'delete', 'publish'); -- Editor can manage content

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'viewer', id FROM public.permissions
WHERE action = 'read'; -- Viewer can only read