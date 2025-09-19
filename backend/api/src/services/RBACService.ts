import { SupabaseService } from './SupabaseService';

export interface Role {
  name: string;
  description: string;
  permissions: string[];
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource_type: string;
  action: string;
}

export interface UserRole {
  userId: string;
  organizationId: string;
  role: string;
  permissions: string[];
}

export class RBACService {
  private supabase: SupabaseService;
  private roleCache: Map<string, Role> = new Map();
  private permissionCache: Map<string, Permission> = new Map();

  constructor(supabase: SupabaseService) {
    this.supabase = supabase;
    this.initializeCache();
  }

  // Initialize cache with permissions and role mappings
  private async initializeCache(): Promise<void> {
    try {
      // Load all permissions
      const { data: permissions, error: permError } = await this.supabase.supabase
        .from('permissions')
        .select('*');

      if (permError) {
        console.error('Failed to load permissions:', permError);
        return;
      }

      // Cache permissions
      permissions?.forEach(permission => {
        this.permissionCache.set(permission.name, permission);
      });

      // Load role permissions
      const { data: rolePermissions, error: roleError } = await this.supabase.supabase
        .from('role_permissions')
        .select(`
          role,
          permissions!inner(name, description, resource_type, action)
        `);

      if (roleError) {
        console.error('Failed to load role permissions:', roleError);
        return;
      }

      // Group permissions by role
      const roleMap: Record<string, string[]> = {};
      rolePermissions?.forEach(rp => {
        if (!roleMap[rp.role]) {
          roleMap[rp.role] = [];
        }
        roleMap[rp.role].push(rp.permissions.name);
      });

      // Cache roles with their permissions
      Object.entries(roleMap).forEach(([roleName, permissions]) => {
        this.roleCache.set(roleName, {
          name: roleName,
          description: this.getRoleDescription(roleName),
          permissions
        });
      });

      console.log('RBAC cache initialized with', this.permissionCache.size, 'permissions and', this.roleCache.size, 'roles');
    } catch (error) {
      console.error('Failed to initialize RBAC cache:', error);
    }
  }

  // Get role description
  private getRoleDescription(role: string): string {
    const descriptions: Record<string, string> = {
      owner: 'Full administrative access to the organization',
      admin: 'Administrative access with limited organization management',
      editor: 'Can create, edit, and manage content',
      viewer: 'Read-only access to content and organization data'
    };
    return descriptions[role] || `${role} role`;
  }

  // Check if user has specific permission
  async hasPermission(userId: string, organizationId: string, permission: string): Promise<boolean> {
    try {
      // Get user's role in the organization
      const { data: membership, error } = await this.supabase.supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .single();

      if (error || !membership) {
        return false;
      }

      // Check if role has the permission
      const role = this.roleCache.get(membership.role);
      return role ? role.permissions.includes(permission) : false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  // Check if user has any of the specified roles
  async hasRole(userId: string, organizationId: string, roles: string[]): Promise<boolean> {
    try {
      const { data: membership, error } = await this.supabase.supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .single();

      if (error || !membership) {
        return false;
      }

      return roles.includes(membership.role);
    } catch (error) {
      console.error('Error checking role:', error);
      return false;
    }
  }

  // Get all permissions for a user in an organization
  async getUserPermissions(userId: string, organizationId: string): Promise<string[]> {
    try {
      const { data: membership, error } = await this.supabase.supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .single();

      if (error || !membership) {
        return [];
      }

      const role = this.roleCache.get(membership.role);
      return role ? role.permissions : [];
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }

  // Get user's role in organization
  async getUserRole(userId: string, organizationId: string): Promise<string | null> {
    try {
      const { data: membership, error } = await this.supabase.supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .single();

      if (error || !membership) {
        return null;
      }

      return membership.role;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }

  // Check if user can perform action on resource type
  async canPerformAction(
    userId: string,
    organizationId: string,
    resourceType: string,
    action: string
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, organizationId);
    
    // Check for specific permission (e.g., 'content_items.create')
    const specificPermission = `${resourceType}.${action}`;
    if (permissions.includes(specificPermission)) {
      return true;
    }

    // Check for manage permission (e.g., 'content_items.manage')
    const managePermission = `${resourceType}.manage`;
    if (permissions.includes(managePermission)) {
      return true;
    }

    return false;
  }

  // Get all available roles
  getRoles(): Role[] {
    return Array.from(this.roleCache.values());
  }

  // Get all available permissions
  getPermissions(): Permission[] {
    return Array.from(this.permissionCache.values());
  }

  // Get permissions for a specific role
  getRolePermissions(roleName: string): string[] {
    const role = this.roleCache.get(roleName);
    return role ? role.permissions : [];
  }

  // Add permission to role (requires database update)
  async addPermissionToRole(role: string, permissionName: string): Promise<boolean> {
    try {
      // Get permission ID
      const permission = this.permissionCache.get(permissionName);
      if (!permission) {
        throw new Error(`Permission '${permissionName}' not found`);
      }

      // Add to database
      const { error } = await this.supabase.supabase
        .from('role_permissions')
        .insert({
          role,
          permission_id: permission.id
        });

      if (error) {
        throw error;
      }

      // Update cache
      const cachedRole = this.roleCache.get(role);
      if (cachedRole && !cachedRole.permissions.includes(permissionName)) {
        cachedRole.permissions.push(permissionName);
      }

      return true;
    } catch (error) {
      console.error('Error adding permission to role:', error);
      return false;
    }
  }

  // Remove permission from role
  async removePermissionFromRole(role: string, permissionName: string): Promise<boolean> {
    try {
      const permission = this.permissionCache.get(permissionName);
      if (!permission) {
        throw new Error(`Permission '${permissionName}' not found`);
      }

      // Remove from database
      const { error } = await this.supabase.supabase
        .from('role_permissions')
        .delete()
        .eq('role', role)
        .eq('permission_id', permission.id);

      if (error) {
        throw error;
      }

      // Update cache
      const cachedRole = this.roleCache.get(role);
      if (cachedRole) {
        cachedRole.permissions = cachedRole.permissions.filter(p => p !== permissionName);
      }

      return true;
    } catch (error) {
      console.error('Error removing permission from role:', error);
      return false;
    }
  }

  // Update user role in organization
  async updateUserRole(userId: string, organizationId: string, newRole: string): Promise<boolean> {
    try {
      // Validate role exists
      if (!this.roleCache.has(newRole)) {
        throw new Error(`Role '${newRole}' does not exist`);
      }

      const { error } = await this.supabase.supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('user_id', userId)
        .eq('organization_id', organizationId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error updating user role:', error);
      return false;
    }
  }

  // Create custom permission
  async createPermission(
    name: string,
    description: string,
    resourceType: string,
    action: string
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.supabase
        .from('permissions')
        .insert({
          name,
          description,
          resource_type: resourceType,
          action
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Update cache
      this.permissionCache.set(name, data);
      return true;
    } catch (error) {
      console.error('Error creating permission:', error);
      return false;
    }
  }

  // Get hierarchical permissions (permissions that grant access to sub-resources)
  getHierarchicalPermissions(permission: string): string[] {
    const hierarchical = [];
    
    // If checking for specific action, also include manage permission
    if (permission.includes('.')) {
      const [resource] = permission.split('.');
      hierarchical.push(`${resource}.manage`);
    }

    // Organization-level permissions
    if (permission.startsWith('organization.')) {
      hierarchical.push('organization.manage');
    }

    return hierarchical;
  }

  // Refresh cache (call when permissions are updated)
  async refreshCache(): Promise<void> {
    this.roleCache.clear();
    this.permissionCache.clear();
    await this.initializeCache();
  }
}