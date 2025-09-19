import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import { AuthService, AuthenticatedRequest } from '../middleware/auth';
import { SupabaseService } from '../services/SupabaseService';

export function createAuthRoutes(supabase: SupabaseService): Router {
  const router = Router();
  const authService = new AuthService(supabase);

  // Validation middleware
  const validateEmail = body('email').isEmail().normalizeEmail();
  const validatePassword = body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/);
  const validateName = body('firstName').isLength({ min: 1 }).trim().escape();
  const validateLastName = body('lastName').isLength({ min: 1 }).trim().escape();
  const validateOrgName = body('organizationName').isLength({ min: 1 }).trim().escape();

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

  // Generate organization slug from name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  };

  // Register new user with organization
  router.post('/register', [
    validateEmail,
    validatePassword,
    validateName,
    validateLastName,
    validateOrgName
  ], async (req: Request, res: Response) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { email, password, firstName, lastName, organizationName } = req.body;

      // Check if user already exists
      const { data: existingUser } = await supabase.supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: { message: 'User with this email already exists' }
        });
      }

      // Generate organization slug and ensure it's unique
      let slug = generateSlug(organizationName);
      let slugCounter = 1;
      let finalSlug = slug;

      while (true) {
        const { data: existingOrg } = await supabase.supabase
          .from('organizations')
          .select('id')
          .eq('slug', finalSlug)
          .single();

        if (!existingOrg) break;
        
        finalSlug = `${slug}-${slugCounter}`;
        slugCounter++;
      }

      // Hash password
      const passwordHash = await authService.hashPassword(password);

      // Generate email verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');

      // Start transaction - create user and organization
      const { data: newUser, error: userError } = await supabase.supabase
        .from('users')
        .insert({
          email,
          password_hash: passwordHash,
          first_name: firstName,
          last_name: lastName,
          email_verification_token: emailVerificationToken,
          is_active: true
        })
        .select()
        .single();

      if (userError) {
        throw new Error(`Failed to create user: ${userError.message}`);
      }

      // Create organization
      const { data: newOrg, error: orgError } = await supabase.supabase
        .from('organizations')
        .insert({
          name: organizationName,
          slug: finalSlug,
          plan_type: 'free'
        })
        .select()
        .single();

      if (orgError) {
        // Cleanup: delete user if org creation failed
        await supabase.supabase
          .from('users')
          .delete()
          .eq('id', newUser.id);
        
        throw new Error(`Failed to create organization: ${orgError.message}`);
      }

      // Add user as owner of the organization
      const { error: memberError } = await supabase.supabase
        .from('organization_members')
        .insert({
          organization_id: newOrg.id,
          user_id: newUser.id,
          role: 'owner'
        });

      if (memberError) {
        // Cleanup: delete user and org if membership creation failed
        await supabase.supabase.from('organizations').delete().eq('id', newOrg.id);
        await supabase.supabase.from('users').delete().eq('id', newUser.id);
        
        throw new Error(`Failed to create organization membership: ${memberError.message}`);
      }

      // Initialize usage metrics for the new organization
      const currentDate = new Date();
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      
      await supabase.supabase
        .from('usage_metrics')
        .insert([
          'content_types',
          'content_items', 
          'media_files',
          'ai_requests'
        ].map(metricType => ({
          organization_id: newOrg.id,
          metric_type: metricType,
          current_usage: 0,
          period_start: currentDate.toISOString(),
          period_end: nextMonth.toISOString()
        })));

      // Generate tokens
      const accessToken = authService.generateAccessToken({
        userId: newUser.id,
        email: newUser.email,
        organizationId: newOrg.id,
        role: 'owner'
      });

      const refreshToken = authService.generateRefreshToken({
        userId: newUser.id
      });

      // Store refresh token
      await authService.storeRefreshToken(newUser.id, refreshToken);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.first_name,
            lastName: newUser.last_name,
            emailVerified: false
          },
          organization: {
            id: newOrg.id,
            name: newOrg.name,
            slug: newOrg.slug,
            planType: newOrg.plan_type
          },
          tokens: {
            accessToken,
            refreshToken
          }
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to register user' }
      });
    }
  });

  // Login user
  router.post('/login', [
    validateEmail,
    body('password').exists()
  ], async (req: Request, res: Response) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { email, password, organizationId } = req.body;

      // Get user
      const { data: user, error: userError } = await supabase.supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single();

      if (userError || !user) {
        return res.status(401).json({
          success: false,
          error: { message: 'Invalid email or password' }
        });
      }

      // Verify password
      const isValidPassword = await authService.verifyPassword(password, user.password_hash);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: { message: 'Invalid email or password' }
        });
      }

      // Get user's organizations
      const { data: memberships, error: memberError } = await supabase.supabase
        .from('organization_members')
        .select(`
          organization_id,
          role,
          organizations!inner(id, name, slug, plan_type)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (memberError || !memberships || memberships.length === 0) {
        return res.status(401).json({
          success: false,
          error: { message: 'No active organization memberships found' }
        });
      }

      // Use specified organization or default to first one
      let selectedMembership = memberships[0];
      if (organizationId) {
        const found = memberships.find(m => m.organization_id === organizationId);
        if (found) {
          selectedMembership = found;
        }
      }

      // Update last login
      await supabase.supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      // Generate tokens
      const accessToken = authService.generateAccessToken({
        userId: user.id,
        email: user.email,
        organizationId: selectedMembership.organization_id,
        role: selectedMembership.role
      });

      const refreshToken = authService.generateRefreshToken({
        userId: user.id
      });

      // Store refresh token
      await authService.storeRefreshToken(user.id, refreshToken);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            emailVerified: user.email_verified
          },
          organization: {
            id: selectedMembership.organizations.id,
            name: selectedMembership.organizations.name,
            slug: selectedMembership.organizations.slug,
            planType: selectedMembership.organizations.plan_type
          },
          organizations: memberships.map(m => ({
            id: m.organizations.id,
            name: m.organizations.name,
            slug: m.organizations.slug,
            role: m.role
          })),
          tokens: {
            accessToken,
            refreshToken
          }
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to login' }
      });
    }
  });

  // Refresh access token
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: { message: 'Refresh token required' }
        });
      }

      // Verify refresh token
      const decoded = authService.verifyRefreshToken(refreshToken);
      
      // Validate token exists in database
      const isValid = await authService.validateRefreshToken(decoded.userId, refreshToken);
      
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: { message: 'Invalid refresh token' }
        });
      }

      // Get user with organization
      const user = await authService.getUserWithOrganization(decoded.userId);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not found' }
        });
      }

      // Generate new access token
      const accessToken = authService.generateAccessToken({
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role
      });

      res.json({
        success: true,
        data: {
          accessToken
        }
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({
        success: false,
        error: { message: 'Invalid or expired refresh token' }
      });
    }
  });

  // Logout (revoke refresh token)
  router.post('/logout', authService.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { refreshToken } = req.body;

      if (refreshToken && req.user) {
        await authService.revokeRefreshToken(req.user.id, refreshToken);
      }

      res.json({
        success: true,
        data: { message: 'Logged out successfully' }
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to logout' }
      });
    }
  });

  // Get current user profile
  router.get('/me', authService.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user || !req.organization) {
        return res.status(401).json({
          success: false,
          error: { message: 'Authentication required' }
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role,
            permissions: req.user.permissions
          },
          organization: req.organization
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get user profile' }
      });
    }
  });

  // Request password reset
  router.post('/forgot-password', [validateEmail], async (req: Request, res: Response) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { email } = req.body;

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date();
      resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry

      // Update user with reset token
      const { error } = await supabase.supabase
        .from('users')
        .update({
          password_reset_token: resetToken,
          password_reset_expires: resetExpires.toISOString()
        })
        .eq('email', email)
        .eq('is_active', true);

      if (error) {
        throw new Error(`Failed to set reset token: ${error.message}`);
      }

      // TODO: Send email with reset link
      // For now, just return success (in production, send email)
      console.log(`Password reset token for ${email}: ${resetToken}`);

      res.json({
        success: true,
        data: { message: 'Password reset email sent if account exists' }
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to process password reset request' }
      });
    }
  });

  // Reset password with token
  router.post('/reset-password', [
    body('token').isLength({ min: 1 }),
    validatePassword
  ], async (req: Request, res: Response) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { token, password } = req.body;

      // Find user with valid reset token
      const { data: user, error: userError } = await supabase.supabase
        .from('users')
        .select('*')
        .eq('password_reset_token', token)
        .gt('password_reset_expires', new Date().toISOString())
        .eq('is_active', true)
        .single();

      if (userError || !user) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid or expired reset token' }
        });
      }

      // Hash new password
      const passwordHash = await authService.hashPassword(password);

      // Update user password and clear reset token
      const { error: updateError } = await supabase.supabase
        .from('users')
        .update({
          password_hash: passwordHash,
          password_reset_token: null,
          password_reset_expires: null
        })
        .eq('id', user.id);

      if (updateError) {
        throw new Error(`Failed to update password: ${updateError.message}`);
      }

      res.json({
        success: true,
        data: { message: 'Password reset successfully' }
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to reset password' }
      });
    }
  });

  return router;
}