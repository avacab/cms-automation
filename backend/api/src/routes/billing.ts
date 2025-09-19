import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService, AuthenticatedRequest } from '../middleware/auth';
import { SupabaseService } from '../services/SupabaseService';
import { StripeService } from '../services/StripeService';

export function createBillingRoutes(supabase: SupabaseService): Router {
  const router = Router();
  const authService = new AuthService(supabase);
  const stripeService = new StripeService(supabase);

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

  // Get available plans
  router.get('/plans', (req: Request, res: Response) => {
    try {
      const plans = stripeService.getPlans();
      
      res.json({
        success: true,
        data: plans
      });
    } catch (error) {
      console.error('Error fetching plans:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch plans' }
      });
    }
  });

  // Get current subscription for organization
  router.get('/subscription', authService.authenticate, authService.requirePermission('organization.billing'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.organization) {
        return res.status(400).json({
          success: false,
          error: { message: 'Organization context required' }
        });
      }

      const subscription = await stripeService.getSubscription(req.organization.id);
      const usageData = await stripeService.getUsageAndLimits(req.organization.id);

      res.json({
        success: true,
        data: {
          subscription,
          ...usageData
        }
      });
    } catch (error) {
      console.error('Error fetching subscription:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch subscription details' }
      });
    }
  });

  // Create checkout session for plan upgrade
  router.post('/checkout', [
    authService.authenticate,
    authService.requirePermission('organization.billing'),
    body('planId').isIn(['pro', 'enterprise'])
  ], async (req: AuthenticatedRequest, res: Response) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { planId } = req.body;

      if (!req.organization || !req.user) {
        return res.status(400).json({
          success: false,
          error: { message: 'Organization and user context required' }
        });
      }

      // Check if organization already has this plan or higher
      if (req.organization.planType === planId || 
         (req.organization.planType === 'enterprise' && planId === 'pro')) {
        return res.status(400).json({
          success: false,
          error: { message: 'Organization already has this plan or higher' }
        });
      }

      // Get or create Stripe customer
      let customerId: string | undefined;
      
      const { data: existingSubscription } = await supabase.supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('organization_id', req.organization.id)
        .single();

      if (existingSubscription?.stripe_customer_id) {
        customerId = existingSubscription.stripe_customer_id;
      } else {
        // Create new customer
        const { data: orgData } = await supabase.supabase
          .from('organizations')
          .select('name')
          .eq('id', req.organization.id)
          .single();

        customerId = await stripeService.createCustomer(
          req.organization.id,
          req.user.email,
          orgData?.name || 'Organization'
        );
      }

      const checkoutUrl = await stripeService.createCheckoutSession(
        req.organization.id,
        planId,
        customerId
      );

      res.json({
        success: true,
        data: {
          checkoutUrl
        }
      });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to create checkout session' }
      });
    }
  });

  // Create billing portal session
  router.post('/portal', authService.authenticate, authService.requirePermission('organization.billing'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.organization) {
        return res.status(400).json({
          success: false,
          error: { message: 'Organization context required' }
        });
      }

      const { data: subscription, error } = await supabase.supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('organization_id', req.organization.id)
        .single();

      if (error || !subscription?.stripe_customer_id) {
        return res.status(400).json({
          success: false,
          error: { message: 'No billing account found. Please subscribe to a plan first.' }
        });
      }

      const portalUrl = await stripeService.createBillingPortalSession(
        subscription.stripe_customer_id
      );

      res.json({
        success: true,
        data: {
          portalUrl
        }
      });
    } catch (error) {
      console.error('Error creating billing portal session:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to create billing portal session' }
      });
    }
  });

  // Cancel subscription
  router.post('/cancel', [
    authService.authenticate,
    authService.requirePermission('organization.billing'),
    body('cancelAtPeriodEnd').optional().isBoolean()
  ], async (req: AuthenticatedRequest, res: Response) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { cancelAtPeriodEnd = true } = req.body;

      if (!req.organization) {
        return res.status(400).json({
          success: false,
          error: { message: 'Organization context required' }
        });
      }

      const success = await stripeService.cancelSubscription(
        req.organization.id,
        cancelAtPeriodEnd
      );

      if (!success) {
        throw new Error('Failed to cancel subscription');
      }

      res.json({
        success: true,
        data: {
          message: cancelAtPeriodEnd 
            ? 'Subscription will be canceled at the end of the current billing period'
            : 'Subscription canceled immediately'
        }
      });
    } catch (error) {
      console.error('Error canceling subscription:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to cancel subscription' }
      });
    }
  });

  // Get usage statistics
  router.get('/usage', authService.authenticate, authService.requirePermission('organization.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.organization) {
        return res.status(400).json({
          success: false,
          error: { message: 'Organization context required' }
        });
      }

      const usageData = await stripeService.getUsageAndLimits(req.organization.id);

      // Calculate usage percentages
      const usagePercentages: Record<string, number> = {};
      Object.entries(usageData.usage).forEach(([metric, value]) => {
        const limit = usageData.limits[metric];
        if (limit === -1) {
          usagePercentages[metric] = 0; // Unlimited
        } else if (limit === 0) {
          usagePercentages[metric] = 100; // No usage allowed
        } else {
          usagePercentages[metric] = Math.min((value / limit) * 100, 100);
        }
      });

      res.json({
        success: true,
        data: {
          plan: usageData.plan,
          usage: usageData.usage,
          limits: usageData.limits,
          usagePercentages
        }
      });
    } catch (error) {
      console.error('Error fetching usage statistics:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch usage statistics' }
      });
    }
  });

  // Stripe webhook endpoint
  router.post('/webhook', async (req: Request, res: Response) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      
      if (!signature) {
        return res.status(400).json({
          success: false,
          error: { message: 'Missing stripe signature' }
        });
      }

      const success = await stripeService.handleWebhook(req.body, signature);

      if (success) {
        res.json({ received: true });
      } else {
        res.status(400).json({
          success: false,
          error: { message: 'Webhook processing failed' }
        });
      }
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).json({
        success: false,
        error: { message: 'Webhook processing failed' }
      });
    }
  });

  // Get billing history (invoices)
  router.get('/history', authService.authenticate, authService.requirePermission('organization.billing'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.organization) {
        return res.status(400).json({
          success: false,
          error: { message: 'Organization context required' }
        });
      }

      const { data: subscription, error } = await supabase.supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('organization_id', req.organization.id)
        .single();

      if (error || !subscription?.stripe_customer_id) {
        return res.json({
          success: true,
          data: []
        });
      }

      // This would require additional Stripe API calls to get invoice history
      // For now, return empty array
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      console.error('Error fetching billing history:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch billing history' }
      });
    }
  });

  return router;
}