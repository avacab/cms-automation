import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { SupabaseService } from '../services/SupabaseService';
import { RBACService } from '../services/RBACService';
import { UsageTrackingService } from '../services/UsageTrackingService';

export interface AuthenticatedUser {
  id: string;
  email: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  organization?: {
    id: string;
    name: string;
    planType: 'free' | 'pro' | 'enterprise';
  };
}

export class AuthService {
  private supabase: SupabaseService;
  private rbac: RBACService;
  private usageTracking: UsageTrackingService;
  private jwtSecret: string;
  private jwtRefreshSecret: string;

  constructor(supabase: SupabaseService) {
    this.supabase = supabase;
    this.rbac = new RBACService(supabase);
    this.usageTracking = new UsageTrackingService(supabase);
    this.jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret-change-this';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-this';
  }

  // Generate access token (15 minutes)
  generateAccessToken(payload: { userId: string; email: string; organizationId: string; role: string }): string {
    return jwt.sign(payload, this.jwtSecret, { 
      expiresIn: '15m',
      issuer: 'cms-automation-api'
    });
  }

  // Generate refresh token (7 days)
  generateRefreshToken(payload: { userId: string }): string {
    return jwt.sign(payload, this.jwtRefreshSecret, { 
      expiresIn: '7d',
      issuer: 'cms-automation-api'
    });
  }

  // Verify access token
  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  // Verify refresh token
  verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtRefreshSecret);
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  // Hash password
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  // Verify password
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // Store refresh token in database
  async storeRefreshToken(userId: string, token: string): Promise<void> {
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const { error } = await this.supabase.supabase
      .from('refresh_tokens')
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString()
      });

    if (error) {
      throw new Error(`Failed to store refresh token: ${error.message}`);
    }
  }

  // Validate refresh token from database
  async validateRefreshToken(userId: string, token: string): Promise<boolean> {
    const { data: tokens, error } = await this.supabase.supabase
      .from('refresh_tokens')
      .select('token_hash')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString());

    if (error) {
      throw new Error(`Failed to validate refresh token: ${error.message}`);
    }

    for (const tokenRecord of tokens || []) {
      if (await bcrypt.compare(token, tokenRecord.token_hash)) {
        return true;
      }
    }

    return false;
  }

  // Revoke refresh token
  async revokeRefreshToken(userId: string, token: string): Promise<void> {
    // Find and delete the matching token
    const { data: tokens, error: fetchError } = await this.supabase.supabase
      .from('refresh_tokens')
      .select('id, token_hash')
      .eq('user_id', userId);

    if (fetchError) {
      throw new Error(`Failed to fetch refresh tokens: ${fetchError.message}`);
    }

    for (const tokenRecord of tokens || []) {
      if (await bcrypt.compare(token, tokenRecord.token_hash)) {
        const { error: deleteError } = await this.supabase.supabase
          .from('refresh_tokens')
          .delete()
          .eq('id', tokenRecord.id);

        if (deleteError) {
          throw new Error(`Failed to revoke refresh token: ${deleteError.message}`);
        }
        break;
      }
    }
  }

  // Get user with organization details
  async getUserWithOrganization(userId: string, organizationId?: string): Promise<AuthenticatedUser | null> {
    // If no specific organization provided, get the user's first active organization
    let orgQuery = this.supabase.supabase
      .from('organization_members')
      .select(`
        organization_id,
        role,
        organizations!inner(id, name, plan_type),
        users!inner(id, email, first_name, last_name)
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (organizationId) {
      orgQuery = orgQuery.eq('organization_id', organizationId);
    }

    const { data: membership, error } = await orgQuery.limit(1).single();

    if (error || !membership) {
      return null;
    }

    // Get user permissions using RBAC service
    const permissions = await this.rbac.getUserPermissions(userId, membership.organization_id);

    return {
      id: membership.users.id,
      email: membership.users.email,
      organizationId: membership.organization_id,
      role: membership.role,
      permissions
    };
  }

  // Middleware to authenticate requests
  authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ 
          success: false, 
          error: { message: 'Access token required' }
        });
        return;
      }

      const token = authHeader.substring(7);
      const decoded = this.verifyAccessToken(token);
      
      // Get user with organization details
      const user = await this.getUserWithOrganization(decoded.userId, decoded.organizationId);
      
      if (!user) {
        res.status(401).json({ 
          success: false, 
          error: { message: 'User not found or not member of organization' }
        });
        return;
      }

      // Get organization details
      const { data: organization, error: orgError } = await this.supabase.supabase
        .from('organizations')
        .select('id, name, plan_type')
        .eq('id', user.organizationId)
        .single();

      if (orgError || !organization) {
        res.status(401).json({ 
          success: false, 
          error: { message: 'Organization not found' }
        });
        return;
      }

      req.user = user;
      req.organization = {
        id: organization.id,
        name: organization.name,
        planType: organization.plan_type
      };

      next();
    } catch (error) {
      res.status(401).json({ 
        success: false, 
        error: { message: 'Invalid or expired token' }
      });
    }
  };

  // Middleware to check permissions
  requirePermission = (permission: string) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user || !req.organization) {
        res.status(401).json({ 
          success: false, 
          error: { message: 'Authentication required' }
        });
        return;
      }

      // Check permission using RBAC service
      const hasPermission = await this.rbac.hasPermission(
        req.user.id, 
        req.organization.id, 
        permission
      );

      if (!hasPermission) {
        res.status(403).json({ 
          success: false, 
          error: { 
            message: `Permission denied: ${permission}`,
            code: 'INSUFFICIENT_PERMISSIONS'
          }
        });
        return;
      }

      next();
    };
  };

  // Middleware to check resource-specific permissions
  requireResourcePermission = (resourceType: string, action: string) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user || !req.organization) {
        res.status(401).json({ 
          success: false, 
          error: { message: 'Authentication required' }
        });
        return;
      }

      const canPerform = await this.rbac.canPerformAction(
        req.user.id,
        req.organization.id,
        resourceType,
        action
      );

      if (!canPerform) {
        res.status(403).json({ 
          success: false, 
          error: { 
            message: `Cannot perform ${action} on ${resourceType}`,
            code: 'INSUFFICIENT_PERMISSIONS'
          }
        });
        return;
      }

      next();
    };
  };

  // Middleware to check role
  requireRole = (roles: string | string[]) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user || !req.organization) {
        res.status(401).json({ 
          success: false, 
          error: { message: 'Authentication required' }
        });
        return;
      }

      const allowedRoles = Array.isArray(roles) ? roles : [roles];
      
      const hasRole = await this.rbac.hasRole(
        req.user.id,
        req.organization.id,
        allowedRoles
      );

      if (!hasRole) {
        res.status(403).json({ 
          success: false, 
          error: { 
            message: `Role required: ${allowedRoles.join(' or ')}`,
            code: 'INSUFFICIENT_ROLE'
          }
        });
        return;
      }

      next();
    };
  };

  // Middleware to check usage limits
  checkUsageLimit = (metricType: string) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      if (!req.organization) {
        res.status(401).json({ 
          success: false, 
          error: { message: 'Organization context required' }
        });
        return;
      }

      try {
        const atLimit = await this.usageTracking.checkLimit(req.organization.id, metricType);

        if (atLimit) {
          const usageStats = await this.usageTracking.getUsageStats(req.organization.id);
          const currentUsage = usageStats.usage[metricType] || 0;
          const limit = usageStats.limits[metricType as keyof typeof usageStats.limits];

          res.status(403).json({ 
            success: false, 
            error: { 
              message: `Usage limit reached for ${metricType}. Please upgrade your plan.`,
              code: 'USAGE_LIMIT_EXCEEDED',
              metricType,
              currentUsage,
              limit,
              planType: req.organization.planType
            }
          });
          return;
        }

        next();
      } catch (error) {
        console.error('Error checking usage limit:', error);
        res.status(500).json({ 
          success: false, 
          error: { message: 'Failed to validate usage limits' }
        });
      }
    };
  };

  // Middleware to track usage after successful operations
  trackUsage = (metricType: string, increment: number = 1) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      if (!req.organization) {
        next();
        return;
      }

      try {
        await this.usageTracking.updateUsage({
          organizationId: req.organization.id,
          metricType,
          increment
        });
      } catch (error) {
        console.error('Error tracking usage:', error);
        // Don't fail the request if usage tracking fails
      }

      next();
    };
  };
}