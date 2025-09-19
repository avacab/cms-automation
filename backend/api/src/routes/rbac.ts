import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService, AuthenticatedRequest } from '../middleware/auth';
import { SupabaseService } from '../services/SupabaseService';
import { RBACService } from '../services/RBACService';

export function createRBACRoutes(supabase: SupabaseService): Router {
  const router = Router();
  const authService = new AuthService(supabase);
  const rbacService = new RBACService(supabase);

  // Helper function to handle validation errors
  const handleValidationErrors = (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
      return true;
    }
    return false;
  };

  // Get all roles and permissions
  router.get('/roles', authService.authenticate, authService.requireRole(['owner', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const roles = rbacService.getRoles();
      const permissions = rbacService.getPermissions();

      res.json({
        success: true,
        data: {
          roles: roles.map(role => ({
            name: role.name,
            description: role.description,
            permissions: role.permissions
          })),
          permissions: permissions.map(permission => ({
            id: permission.id,
            name: permission.name,
            description: permission.description,
            resource_type: permission.resource_type,
            action: permission.action
          }))
        }
      });
    } catch (error) {
      console.error('Error fetching roles and permissions:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch roles and permissions' }
      });
    }
  });

  // Get organization members with their roles
  router.get('/members', authService.authenticate, authService.requirePermission('users.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.organization) {
        return res.status(400).json({
          success: false,
          error: { message: 'Organization context required' }
        });
      }

      const { data: members, error } = await supabase.supabase
        .from('organization_members')
        .select(`
          user_id,
          role,
          joined_at,
          is_active,
          users!inner(id, email, first_name, last_name)
        `)
        .eq('organization_id', req.organization.id)
        .eq('is_active', true)
        .order('joined_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch members: ${error.message}`);
      }

      const membersWithPermissions = await Promise.all(
        (members || []).map(async (member) => {
          const permissions = await rbacService.getUserPermissions(
            member.user_id,
            req.organization!.id
          );

          return {
            userId: member.user_id,
            email: member.users.email,
            firstName: member.users.first_name,
            lastName: member.users.last_name,
            role: member.role,
            permissions,
            joinedAt: member.joined_at
          };
        })
      );

      res.json({
        success: true,
        data: membersWithPermissions
      });
    } catch (error) {
      console.error('Error fetching organization members:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch organization members' }
      });
    }
  });

  // Update user role
  router.put('/members/:userId/role', [
    authService.authenticate,
    authService.requirePermission('users.update'),
    body('role').isIn(['owner', 'admin', 'editor', 'viewer'])
  ], async (req: AuthenticatedRequest, res: Response) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!req.user || !req.organization) {
        return res.status(401).json({
          success: false,
          error: { message: 'Authentication required' }
        });
      }

      // Prevent users from changing their own role to prevent lockout
      if (userId === req.user.id) {
        return res.status(400).json({
          success: false,
          error: { message: 'Cannot change your own role' }
        });
      }

      // Only owners can assign owner role
      if (role === 'owner' && req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          error: { message: 'Only owners can assign owner role' }
        });
      }

      // Check if target user exists in organization
      const { data: existingMember, error: memberError } = await supabase.supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', req.organization.id)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (memberError || !existingMember) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found in organization' }
        });
      }

      // Update role using RBAC service
      const success = await rbacService.updateUserRole(userId, req.organization.id, role);

      if (!success) {
        throw new Error('Failed to update user role');
      }

      res.json({
        success: true,
        data: {
          userId,
          role,
          message: 'User role updated successfully'
        }
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update user role' }
      });
    }
  });

  // Get permissions for a specific role
  router.get('/roles/:roleName/permissions', authService.authenticate, authService.requireRole(['owner', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { roleName } = req.params;
      const permissions = rbacService.getRolePermissions(roleName);

      res.json({
        success: true,
        data: {
          role: roleName,
          permissions
        }
      });
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch role permissions' }
      });
    }
  });

  // Add permission to role (owners only)
  router.post('/roles/:roleName/permissions', [
    authService.authenticate,
    authService.requireRole(['owner']),
    body('permission').isString().isLength({ min: 1 })
  ], async (req: AuthenticatedRequest, res: Response) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { roleName } = req.params;
      const { permission } = req.body;

      const success = await rbacService.addPermissionToRole(roleName, permission);

      if (!success) {
        throw new Error('Failed to add permission to role');
      }

      res.json({
        success: true,
        data: {
          role: roleName,
          permission,
          message: 'Permission added to role successfully'
        }
      });
    } catch (error) {
      console.error('Error adding permission to role:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to add permission to role' }
      });
    }
  });

  // Remove permission from role (owners only)
  router.delete('/roles/:roleName/permissions/:permission', [
    authService.authenticate,
    authService.requireRole(['owner'])
  ], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { roleName, permission } = req.params;

      const success = await rbacService.removePermissionFromRole(roleName, permission);

      if (!success) {
        throw new Error('Failed to remove permission from role');
      }

      res.json({
        success: true,
        data: {
          role: roleName,
          permission,
          message: 'Permission removed from role successfully'
        }
      });
    } catch (error) {
      console.error('Error removing permission from role:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to remove permission from role' }
      });
    }
  });

  // Create custom permission (owners only)
  router.post('/permissions', [
    authService.authenticate,
    authService.requireRole(['owner']),
    body('name').isString().isLength({ min: 1 }),
    body('description').isString().isLength({ min: 1 }),
    body('resourceType').isString().isLength({ min: 1 }),
    body('action').isString().isLength({ min: 1 })
  ], async (req: AuthenticatedRequest, res: Response) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { name, description, resourceType, action } = req.body;

      const success = await rbacService.createPermission(name, description, resourceType, action);

      if (!success) {
        throw new Error('Failed to create permission');
      }

      res.status(201).json({
        success: true,
        data: {
          name,
          description,
          resourceType,
          action,
          message: 'Permission created successfully'
        }
      });
    } catch (error) {
      console.error('Error creating permission:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to create permission' }
      });
    }
  });

  // Check user permissions (useful for frontend)
  router.get('/check-permission/:permission', authService.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { permission } = req.params;

      if (!req.user || !req.organization) {
        return res.status(401).json({
          success: false,
          error: { message: 'Authentication required' }
        });
      }

      const hasPermission = await rbacService.hasPermission(
        req.user.id,
        req.organization.id,
        permission
      );

      res.json({
        success: true,
        data: {
          permission,
          hasPermission
        }
      });
    } catch (error) {
      console.error('Error checking permission:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to check permission' }
      });
    }
  });

  // Get current user's effective permissions
  router.get('/my-permissions', authService.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user || !req.organization) {
        return res.status(401).json({
          success: false,
          error: { message: 'Authentication required' }
        });
      }

      const permissions = await rbacService.getUserPermissions(
        req.user.id,
        req.organization.id
      );

      res.json({
        success: true,
        data: {
          userId: req.user.id,
          organizationId: req.organization.id,
          role: req.user.role,
          permissions
        }
      });
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch user permissions' }
      });
    }
  });

  return router;
}