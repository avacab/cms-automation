import { SupabaseService } from './SupabaseService';

export interface UsageMetric {
  organizationId: string;
  metricType: string;
  currentUsage: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface UsageLimits {
  content_types: number;
  content_items: number;
  media_files: number;
  ai_requests: number;
  api_calls: number;
}

export interface UsageUpdate {
  organizationId: string;
  metricType: string;
  increment?: number;
  absolute?: number;
}

export class UsageTrackingService {
  private supabase: SupabaseService;
  
  // Plan limits configuration
  private readonly planLimits: Record<string, UsageLimits> = {
    free: {
      content_types: 1,
      content_items: 10,
      media_files: 5,
      ai_requests: 10,
      api_calls: 100
    },
    pro: {
      content_types: 10,
      content_items: 1000,
      media_files: 100,
      ai_requests: 500,
      api_calls: 10000
    },
    enterprise: {
      content_types: -1, // unlimited
      content_items: -1,
      media_files: -1,
      ai_requests: -1,
      api_calls: -1
    }
  };

  constructor(supabase: SupabaseService) {
    this.supabase = supabase;
  }

  // Initialize usage metrics for a new organization
  async initializeOrganizationUsage(organizationId: string): Promise<boolean> {
    try {
      const currentDate = new Date();
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      
      const metrics = [
        'content_types',
        'content_items', 
        'media_files',
        'ai_requests',
        'api_calls'
      ];

      const usageRecords = metrics.map(metricType => ({
        organization_id: organizationId,
        metric_type: metricType,
        current_usage: 0,
        period_start: currentDate.toISOString(),
        period_end: nextMonth.toISOString()
      }));

      const { error } = await this.supabase.supabase
        .from('usage_metrics')
        .insert(usageRecords);

      if (error) {
        console.error('Failed to initialize usage metrics:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error initializing organization usage:', error);
      return false;
    }
  }

  // Get current usage for organization
  async getCurrentUsage(organizationId: string): Promise<Record<string, number>> {
    try {
      const { data: metrics, error } = await this.supabase.supabase
        .from('usage_metrics')
        .select('metric_type, current_usage')
        .eq('organization_id', organizationId)
        .gte('period_end', new Date().toISOString());

      if (error) {
        throw new Error(`Failed to fetch usage metrics: ${error.message}`);
      }

      const usage: Record<string, number> = {};
      metrics?.forEach(metric => {
        usage[metric.metric_type] = metric.current_usage;
      });

      return usage;
    } catch (error) {
      console.error('Error getting current usage:', error);
      return {};
    }
  }

  // Get limits for organization based on their plan
  async getLimitsForOrganization(organizationId: string): Promise<UsageLimits> {
    try {
      const { data: org, error } = await this.supabase.supabase
        .from('organizations')
        .select('plan_type')
        .eq('id', organizationId)
        .single();

      if (error || !org) {
        throw new Error('Organization not found');
      }

      const limits = this.planLimits[org.plan_type];
      if (!limits) {
        throw new Error(`Invalid plan type: ${org.plan_type}`);
      }

      return limits;
    } catch (error) {
      console.error('Error getting limits for organization:', error);
      // Return free plan limits as fallback
      return this.planLimits.free;
    }
  }

  // Check if organization has reached a specific limit
  async checkLimit(organizationId: string, metricType: string): Promise<boolean> {
    try {
      const [usage, limits] = await Promise.all([
        this.getCurrentUsage(organizationId),
        this.getLimitsForOrganization(organizationId)
      ]);

      const currentUsage = usage[metricType] || 0;
      const limit = limits[metricType as keyof UsageLimits];

      // -1 means unlimited
      if (limit === -1) {
        return false;
      }

      return currentUsage >= limit;
    } catch (error) {
      console.error('Error checking limit:', error);
      // Return true (at limit) as safe fallback
      return true;
    }
  }

  // Update usage for an organization
  async updateUsage(update: UsageUpdate): Promise<boolean> {
    try {
      const { organizationId, metricType, increment, absolute } = update;

      // Get or create current period usage record
      let usageRecord = await this.getCurrentPeriodUsage(organizationId, metricType);
      
      if (!usageRecord) {
        // Create new usage record for current period
        usageRecord = await this.createCurrentPeriodUsage(organizationId, metricType);
      }

      let newUsage: number;
      if (absolute !== undefined) {
        newUsage = absolute;
      } else {
        newUsage = usageRecord.current_usage + (increment || 1);
      }

      // Ensure usage doesn't go below 0
      newUsage = Math.max(0, newUsage);

      const { error } = await this.supabase.supabase
        .from('usage_metrics')
        .update({ 
          current_usage: newUsage,
          updated_at: new Date().toISOString()
        })
        .eq('id', usageRecord.id);

      if (error) {
        throw new Error(`Failed to update usage: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Error updating usage:', error);
      return false;
    }
  }

  // Increment usage by 1
  async incrementUsage(organizationId: string, metricType: string): Promise<boolean> {
    return this.updateUsage({
      organizationId,
      metricType,
      increment: 1
    });
  }

  // Decrement usage by 1 (when items are deleted)
  async decrementUsage(organizationId: string, metricType: string): Promise<boolean> {
    return this.updateUsage({
      organizationId,
      metricType,
      increment: -1
    });
  }

  // Set absolute usage value
  async setUsage(organizationId: string, metricType: string, value: number): Promise<boolean> {
    return this.updateUsage({
      organizationId,
      metricType,
      absolute: value
    });
  }

  // Get current period usage record
  private async getCurrentPeriodUsage(organizationId: string, metricType: string) {
    try {
      const { data, error } = await this.supabase.supabase
        .from('usage_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('metric_type', metricType)
        .gte('period_end', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  // Create new usage record for current period
  private async createCurrentPeriodUsage(organizationId: string, metricType: string) {
    const currentDate = new Date();
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

    const { data, error } = await this.supabase.supabase
      .from('usage_metrics')
      .insert({
        organization_id: organizationId,
        metric_type: metricType,
        current_usage: 0,
        period_start: currentDate.toISOString(),
        period_end: nextMonth.toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create usage record: ${error.message}`);
    }

    return data;
  }

  // Get usage statistics for organization
  async getUsageStats(organizationId: string): Promise<{
    usage: Record<string, number>;
    limits: UsageLimits;
    percentages: Record<string, number>;
    atLimit: Record<string, boolean>;
  }> {
    try {
      const [usage, limits] = await Promise.all([
        this.getCurrentUsage(organizationId),
        this.getLimitsForOrganization(organizationId)
      ]);

      const percentages: Record<string, number> = {};
      const atLimit: Record<string, boolean> = {};

      Object.entries(limits).forEach(([metric, limit]) => {
        const currentUsage = usage[metric] || 0;
        
        if (limit === -1) {
          percentages[metric] = 0; // Unlimited
          atLimit[metric] = false;
        } else if (limit === 0) {
          percentages[metric] = 100; // No usage allowed
          atLimit[metric] = true;
        } else {
          percentages[metric] = Math.min((currentUsage / limit) * 100, 100);
          atLimit[metric] = currentUsage >= limit;
        }
      });

      return {
        usage,
        limits,
        percentages,
        atLimit
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      throw new Error('Failed to get usage statistics');
    }
  }

  // Reset usage for new billing period
  async resetUsageForNewPeriod(organizationId: string): Promise<boolean> {
    try {
      const currentDate = new Date();
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      
      const metrics = [
        'ai_requests',  // These reset monthly
        'api_calls'
      ];

      // Archive current period metrics
      await this.supabase.supabase
        .from('usage_metrics')
        .update({ period_end: currentDate.toISOString() })
        .eq('organization_id', organizationId)
        .in('metric_type', metrics)
        .gte('period_end', currentDate.toISOString());

      // Create new period metrics
      const newMetrics = metrics.map(metricType => ({
        organization_id: organizationId,
        metric_type: metricType,
        current_usage: 0,
        period_start: currentDate.toISOString(),
        period_end: nextMonth.toISOString()
      }));

      const { error } = await this.supabase.supabase
        .from('usage_metrics')
        .insert(newMetrics);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error resetting usage for new period:', error);
      return false;
    }
  }

  // Get historical usage data
  async getUsageHistory(organizationId: string, metricType: string, months: number = 6): Promise<Array<{
    period: string;
    usage: number;
    limit: number;
  }>> {
    try {
      const { data: metrics, error } = await this.supabase.supabase
        .from('usage_metrics')
        .select('current_usage, period_start, period_end')
        .eq('organization_id', organizationId)
        .eq('metric_type', metricType)
        .order('period_start', { ascending: false })
        .limit(months);

      if (error) {
        throw error;
      }

      const limits = await this.getLimitsForOrganization(organizationId);
      const limit = limits[metricType as keyof UsageLimits];

      return (metrics || []).map(metric => ({
        period: new Date(metric.period_start).toISOString().substring(0, 7), // YYYY-MM format
        usage: metric.current_usage,
        limit: limit === -1 ? 999999 : limit // Use large number for unlimited in charts
      }));
    } catch (error) {
      console.error('Error getting usage history:', error);
      return [];
    }
  }

  // Bulk update usage for multiple metrics
  async bulkUpdateUsage(organizationId: string, updates: Record<string, number>): Promise<boolean> {
    try {
      const promises = Object.entries(updates).map(([metricType, increment]) =>
        this.updateUsage({
          organizationId,
          metricType,
          increment
        })
      );

      const results = await Promise.all(promises);
      return results.every(result => result === true);
    } catch (error) {
      console.error('Error bulk updating usage:', error);
      return false;
    }
  }

  // Calculate resource counts from actual database data
  async syncUsageWithActualCounts(organizationId: string): Promise<boolean> {
    try {
      // Count actual resources
      const [contentTypesCount, contentItemsCount, mediaFilesCount] = await Promise.all([
        this.countContentTypes(organizationId),
        this.countContentItems(organizationId),
        this.countMediaFiles(organizationId)
      ]);

      // Update usage to match actual counts
      const updates = {
        content_types: contentTypesCount,
        content_items: contentItemsCount,
        media_files: mediaFilesCount
      };

      const promises = Object.entries(updates).map(([metricType, count]) =>
        this.setUsage(organizationId, metricType, count)
      );

      const results = await Promise.all(promises);
      return results.every(result => result === true);
    } catch (error) {
      console.error('Error syncing usage with actual counts:', error);
      return false;
    }
  }

  // Helper methods to count actual resources
  private async countContentTypes(organizationId: string): Promise<number> {
    const { count, error } = await this.supabase.supabase
      .from('content_types')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    return error ? 0 : (count || 0);
  }

  private async countContentItems(organizationId: string): Promise<number> {
    const { count, error } = await this.supabase.supabase
      .from('content_items')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    return error ? 0 : (count || 0);
  }

  private async countMediaFiles(organizationId: string): Promise<number> {
    const { count, error } = await this.supabase.supabase
      .from('media_files')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    return error ? 0 : (count || 0);
  }
}