import Stripe from 'stripe';
import { SupabaseService } from './SupabaseService';

export interface PlanDetails {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    content_types: number;
    content_items: number;
    media_files: number;
    ai_requests_per_month: number;
    api_calls_per_month: number;
  };
}

export interface SubscriptionData {
  id: string;
  organizationId: string;
  planType: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialStart?: Date;
  trialEnd?: Date;
}

export class StripeService {
  private stripe: Stripe;
  private supabase: SupabaseService;
  private webhookSecret: string;

  // Plan configurations
  private readonly plans: Record<string, PlanDetails> = {
    free: {
      id: 'free',
      name: 'Free Plan',
      price: 0,
      currency: 'usd',
      interval: 'month',
      features: [
        '1 Content Type',
        '10 Content Items',
        '5 Media Files',
        '10 AI Requests/month',
        'Basic Support'
      ],
      limits: {
        content_types: 1,
        content_items: 10,
        media_files: 5,
        ai_requests_per_month: 10,
        api_calls_per_month: 100
      }
    },
    pro: {
      id: 'pro',
      name: 'Pro Plan',
      price: 2900, // $29.00 in cents
      currency: 'usd',
      interval: 'month',
      features: [
        '10 Content Types',
        '1,000 Content Items',
        '100 Media Files',
        '500 AI Requests/month',
        'API Access',
        'Priority Support'
      ],
      limits: {
        content_types: 10,
        content_items: 1000,
        media_files: 100,
        ai_requests_per_month: 500,
        api_calls_per_month: 10000
      }
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise Plan',
      price: 9900, // $99.00 in cents
      currency: 'usd',
      interval: 'month',
      features: [
        'Unlimited Content Types',
        'Unlimited Content Items',
        'Unlimited Media Files',
        'Unlimited AI Requests',
        'Advanced API Access',
        'White-label Options',
        'Dedicated Support'
      ],
      limits: {
        content_types: -1, // -1 means unlimited
        content_items: -1,
        media_files: -1,
        ai_requests_per_month: -1,
        api_calls_per_month: -1
      }
    }
  };

  constructor(supabase: SupabaseService) {
    this.supabase = supabase;
    
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16'
    });

    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  }

  // Get all available plans
  getPlans(): PlanDetails[] {
    return Object.values(this.plans);
  }

  // Get specific plan details
  getPlan(planId: string): PlanDetails | null {
    return this.plans[planId] || null;
  }

  // Create Stripe customer for organization
  async createCustomer(organizationId: string, email: string, name: string): Promise<string> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          organization_id: organizationId
        }
      });

      return customer.id;
    } catch (error) {
      console.error('Failed to create Stripe customer:', error);
      throw new Error('Failed to create customer account');
    }
  }

  // Create checkout session for subscription
  async createCheckoutSession(
    organizationId: string,
    planId: string,
    customerId?: string,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<string> {
    try {
      const plan = this.getPlan(planId);
      if (!plan || planId === 'free') {
        throw new Error('Invalid plan for checkout');
      }

      // Create or get Stripe price for the plan
      const price = await this.getOrCreatePrice(plan);

      const sessionData: Stripe.Checkout.SessionCreateParams = {
        mode: 'subscription',
        line_items: [{
          price: price.id,
          quantity: 1
        }],
        success_url: successUrl || `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/billing/cancel`,
        metadata: {
          organization_id: organizationId,
          plan_id: planId
        },
        subscription_data: {
          metadata: {
            organization_id: organizationId,
            plan_id: planId
          }
        }
      };

      if (customerId) {
        sessionData.customer = customerId;
      } else {
        sessionData.customer_creation = 'always';
      }

      const session = await this.stripe.checkout.sessions.create(sessionData);

      if (!session.url) {
        throw new Error('Failed to create checkout session URL');
      }

      return session.url;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  // Get or create Stripe price for plan
  private async getOrCreatePrice(plan: PlanDetails): Promise<Stripe.Price> {
    try {
      // First, try to find existing price
      const existingPrices = await this.stripe.prices.list({
        lookup_keys: [plan.id],
        active: true
      });

      if (existingPrices.data.length > 0) {
        return existingPrices.data[0];
      }

      // Create new price
      return await this.stripe.prices.create({
        unit_amount: plan.price,
        currency: plan.currency,
        recurring: { interval: plan.interval },
        product_data: {
          name: plan.name,
          description: `${plan.name} - ${plan.features.join(', ')}`
        },
        lookup_key: plan.id,
        metadata: {
          plan_id: plan.id
        }
      });
    } catch (error) {
      console.error('Failed to get or create price:', error);
      throw new Error('Failed to setup pricing');
    }
  }

  // Create billing portal session
  async createBillingPortalSession(customerId: string, returnUrl?: string): Promise<string> {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl || `${process.env.FRONTEND_URL}/billing`
      });

      return session.url;
    } catch (error) {
      console.error('Failed to create billing portal session:', error);
      throw new Error('Failed to create billing portal session');
    }
  }

  // Get subscription by organization ID
  async getSubscription(organizationId: string): Promise<SubscriptionData | null> {
    try {
      const { data: subscription, error } = await this.supabase.supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (error || !subscription) {
        return null;
      }

      return {
        id: subscription.id,
        organizationId: subscription.organization_id,
        planType: subscription.plan_type,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start),
        currentPeriodEnd: new Date(subscription.current_period_end),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialStart: subscription.trial_start ? new Date(subscription.trial_start) : undefined,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end) : undefined
      };
    } catch (error) {
      console.error('Failed to get subscription:', error);
      throw new Error('Failed to get subscription');
    }
  }

  // Update subscription in database
  async updateSubscription(subscriptionData: Partial<SubscriptionData>): Promise<boolean> {
    try {
      const { error } = await this.supabase.supabase
        .from('subscriptions')
        .upsert({
          organization_id: subscriptionData.organizationId,
          plan_type: subscriptionData.planType,
          status: subscriptionData.status,
          current_period_start: subscriptionData.currentPeriodStart?.toISOString(),
          current_period_end: subscriptionData.currentPeriodEnd?.toISOString(),
          cancel_at_period_end: subscriptionData.cancelAtPeriodEnd,
          trial_start: subscriptionData.trialStart?.toISOString(),
          trial_end: subscriptionData.trialEnd?.toISOString()
        });

      if (error) {
        throw error;
      }

      // Update organization plan type
      await this.supabase.supabase
        .from('organizations')
        .update({ plan_type: subscriptionData.planType })
        .eq('id', subscriptionData.organizationId);

      return true;
    } catch (error) {
      console.error('Failed to update subscription:', error);
      return false;
    }
  }

  // Handle Stripe webhooks
  async handleWebhook(payload: string | Buffer, signature: string): Promise<boolean> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );

      console.log('Processing Stripe webhook:', event.type);

      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      return true;
    } catch (error) {
      console.error('Webhook processing failed:', error);
      return false;
    }
  }

  // Handle successful checkout
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const organizationId = session.metadata?.organization_id;
    const planId = session.metadata?.plan_id;

    if (!organizationId || !planId) {
      console.error('Missing organization_id or plan_id in checkout session metadata');
      return;
    }

    if (session.subscription) {
      const subscription = await this.stripe.subscriptions.retrieve(
        session.subscription as string
      );

      await this.updateSubscription({
        organizationId,
        planType: planId as 'pro' | 'enterprise',
        status: subscription.status as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined
      });

      // Store Stripe IDs for future reference
      await this.supabase.supabase
        .from('subscriptions')
        .update({
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer as string
        })
        .eq('organization_id', organizationId);
    }
  }

  // Handle successful payment
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    if (invoice.subscription) {
      const subscription = await this.stripe.subscriptions.retrieve(
        invoice.subscription as string
      );

      const organizationId = subscription.metadata?.organization_id;
      if (organizationId) {
        await this.updateSubscription({
          organizationId,
          status: 'active',
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000)
        });
      }
    }
  }

  // Handle failed payment
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (invoice.subscription) {
      const subscription = await this.stripe.subscriptions.retrieve(
        invoice.subscription as string
      );

      const organizationId = subscription.metadata?.organization_id;
      if (organizationId) {
        await this.updateSubscription({
          organizationId,
          status: 'past_due'
        });
      }
    }
  }

  // Handle subscription updates
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const organizationId = subscription.metadata?.organization_id;
    if (!organizationId) return;

    await this.updateSubscription({
      organizationId,
      status: subscription.status as any,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });
  }

  // Handle subscription deletion
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const organizationId = subscription.metadata?.organization_id;
    if (!organizationId) return;

    await this.updateSubscription({
      organizationId,
      planType: 'free',
      status: 'canceled'
    });
  }

  // Cancel subscription
  async cancelSubscription(organizationId: string, cancelAtPeriodEnd: boolean = true): Promise<boolean> {
    try {
      const { data: subscription, error } = await this.supabase.supabase
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('organization_id', organizationId)
        .single();

      if (error || !subscription?.stripe_subscription_id) {
        throw new Error('Subscription not found');
      }

      if (cancelAtPeriodEnd) {
        await this.stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: true
        });
      } else {
        await this.stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      }

      return true;
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      return false;
    }
  }

  // Get usage and limits for organization
  async getUsageAndLimits(organizationId: string): Promise<{
    plan: PlanDetails;
    usage: Record<string, number>;
    limits: Record<string, number>;
  }> {
    try {
      // Get organization's current plan
      const { data: org, error: orgError } = await this.supabase.supabase
        .from('organizations')
        .select('plan_type')
        .eq('id', organizationId)
        .single();

      if (orgError || !org) {
        throw new Error('Organization not found');
      }

      const plan = this.getPlan(org.plan_type);
      if (!plan) {
        throw new Error('Invalid plan type');
      }

      // Get current usage metrics
      const { data: metrics, error: metricsError } = await this.supabase.supabase
        .from('usage_metrics')
        .select('metric_type, current_usage')
        .eq('organization_id', organizationId)
        .gte('period_end', new Date().toISOString());

      if (metricsError) {
        throw metricsError;
      }

      const usage: Record<string, number> = {};
      metrics?.forEach(metric => {
        usage[metric.metric_type] = metric.current_usage;
      });

      return {
        plan,
        usage,
        limits: plan.limits
      };
    } catch (error) {
      console.error('Failed to get usage and limits:', error);
      throw new Error('Failed to get usage and limits');
    }
  }
}