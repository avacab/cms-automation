import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FacebookService, FacebookPost } from './FacebookService.js';
import cron from 'node-cron';

export interface SocialAccount {
  id: string;
  platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram';
  account_name: string;
  account_id: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SocialPost {
  id: string;
  content_id: string;
  platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram';
  account_id: string;
  status: 'scheduled' | 'published' | 'failed' | 'cancelled';
  scheduled_time: string;
  published_time?: string;
  platform_post_id?: string;
  post_data: any;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
}

export interface SchedulingRule {
  id: string;
  platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram';
  optimal_hour: number; // 0-23
  optimal_minute: number; // 0-59
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchedulePostRequest {
  contentId: string;
  platforms: string[];
  content: {
    message: string;
    title?: string;
    url?: string;
    imageUrl?: string;
  };
  customScheduleTime?: string; // ISO string
  useOptimalTiming?: boolean;
}

export interface SocialSchedulerResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export class SocialSchedulerService {
  private supabase: SupabaseClient;
  private facebookService: FacebookService | null = null;
  private scheduledJobs: Map<string, any> = new Map();
  
  // Default optimal posting times (in UTC)
  private readonly defaultOptimalTimes = {
    facebook: { hour: 15, minute: 0 }, // 3:00 PM
    twitter: { hour: 8, minute: 0 },   // 8:00 AM
    linkedin: { hour: 12, minute: 0 }, // 12:00 PM
    instagram: { hour: 19, minute: 0 } // 7:00 PM
  };

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.initializeFacebookService();
    this.startScheduler();
  }

  private initializeFacebookService(): void {
    const facebookAppId = process.env.FACEBOOK_APP_ID;
    const facebookAppSecret = process.env.FACEBOOK_APP_SECRET;

    if (facebookAppId && facebookAppSecret) {
      this.facebookService = new FacebookService({
        appId: facebookAppId,
        appSecret: facebookAppSecret
      });
    }
  }

  /**
   * Schedule posts across multiple platforms
   */
  async scheduleMultiPlatformPost(request: SchedulePostRequest): Promise<SocialSchedulerResult<SocialPost[]>> {
    try {
      const scheduledPosts: SocialPost[] = [];
      
      for (const platform of request.platforms) {
        const scheduledTime = request.customScheduleTime 
          ? new Date(request.customScheduleTime)
          : await this.calculateOptimalPostTime(platform as any);

        const socialPost = await this.schedulePost({
          contentId: request.contentId,
          platform: platform as any,
          scheduledTime,
          content: request.content
        });

        if (socialPost.success && socialPost.data) {
          scheduledPosts.push(socialPost.data);
        }
      }

      return {
        success: true,
        data: scheduledPosts
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SCHEDULING_ERROR',
          message: 'Failed to schedule multi-platform posts',
          details: error
        }
      };
    }
  }

  /**
   * Schedule a single post for a specific platform
   */
  async schedulePost(params: {
    contentId: string;
    platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram';
    scheduledTime: Date;
    content: any;
  }): Promise<SocialSchedulerResult<SocialPost>> {
    try {
      // Get active account for the platform
      const account = await this.getActivePlatformAccount(params.platform);
      if (!account) {
        throw new Error(`No active ${params.platform} account found`);
      }

      // Transform content for the specific platform
      const platformContent = this.transformContentForPlatform(params.content, params.platform);

      // Create social post record
      const socialPost: Omit<SocialPost, 'id' | 'created_at' | 'updated_at'> = {
        content_id: params.contentId,
        platform: params.platform,
        account_id: account.id,
        status: 'scheduled',
        scheduled_time: params.scheduledTime.toISOString(),
        post_data: platformContent,
        retry_count: 0,
        max_retries: 3
      };

      const { data, error } = await this.supabase
        .from('social_posts')
        .insert([socialPost])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Schedule the job
      this.schedulePublishJob(data);

      return {
        success: true,
        data: data
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SCHEDULE_POST_ERROR',
          message: 'Failed to schedule post',
          details: error
        }
      };
    }
  }

  /**
   * Publish a post immediately
   */
  async publishPost(postId: string): Promise<SocialSchedulerResult<{ platformPostId: string }>> {
    try {
      const { data: post, error } = await this.supabase
        .from('social_posts')
        .select(`
          *,
          social_accounts (*)
        `)
        .eq('id', postId)
        .single();

      if (error || !post) {
        throw new Error('Social post not found');
      }

      const account = post.social_accounts;
      let platformPostId: string | null = null;

      switch (post.platform) {
        case 'facebook':
          platformPostId = await this.publishToFacebook(post.post_data, account);
          break;
        case 'twitter':
          // TODO: Implement Twitter publishing
          throw new Error('Twitter publishing not yet implemented');
        case 'linkedin':
          // TODO: Implement LinkedIn publishing
          throw new Error('LinkedIn publishing not yet implemented');
        case 'instagram':
          // TODO: Implement Instagram publishing
          throw new Error('Instagram publishing not yet implemented');
        default:
          throw new Error(`Unsupported platform: ${post.platform}`);
      }

      if (!platformPostId) {
        throw new Error('Failed to get platform post ID');
      }

      // Update post status
      await this.updatePostStatus(postId, 'published', { 
        platform_post_id: platformPostId,
        published_time: new Date().toISOString()
      });

      return {
        success: true,
        data: { platformPostId }
      };
    } catch (error) {
      await this.updatePostStatus(postId, 'failed', { 
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: {
          code: 'PUBLISH_ERROR',
          message: 'Failed to publish post',
          details: error
        }
      };
    }
  }

  /**
   * Publish to Facebook
   */
  private async publishToFacebook(postData: any, account: SocialAccount): Promise<string> {
    if (!this.facebookService) {
      throw new Error('Facebook service not initialized');
    }

    this.facebookService.setPageAccessToken(account.access_token, account.account_id);

    const facebookPost: FacebookPost = {
      message: postData.message,
      link: postData.url,
      picture: postData.imageUrl
    };

    const result = await this.facebookService.publishPost(facebookPost);
    
    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Facebook publishing failed');
    }

    return result.data.id;
  }

  /**
   * Calculate optimal posting time for a platform
   */
  private async calculateOptimalPostTime(platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram'): Promise<Date> {
    try {
      // Get custom scheduling rule for the platform
      const { data: rule } = await this.supabase
        .from('scheduling_rules')
        .select('*')
        .eq('platform', platform)
        .eq('is_active', true)
        .single();

      const optimalTime = rule 
        ? { hour: rule.optimal_hour, minute: rule.optimal_minute }
        : this.defaultOptimalTimes[platform];

      // Calculate next optimal posting time
      const now = new Date();
      const nextOptimalTime = new Date();
      nextOptimalTime.setUTCHours(optimalTime.hour, optimalTime.minute, 0, 0);

      // If the optimal time today has passed, schedule for tomorrow
      if (nextOptimalTime <= now) {
        nextOptimalTime.setUTCDate(nextOptimalTime.getUTCDate() + 1);
      }

      return nextOptimalTime;
    } catch (error) {
      // Fallback to default timing
      const optimalTime = this.defaultOptimalTimes[platform];
      const nextOptimalTime = new Date();
      nextOptimalTime.setUTCHours(optimalTime.hour, optimalTime.minute, 0, 0);
      
      if (nextOptimalTime <= new Date()) {
        nextOptimalTime.setUTCDate(nextOptimalTime.getUTCDate() + 1);
      }

      return nextOptimalTime;
    }
  }

  /**
   * Transform content for specific platform requirements
   */
  private transformContentForPlatform(content: any, platform: string): any {
    const baseContent = { ...content };

    switch (platform) {
      case 'facebook':
        return {
          message: baseContent.message,
          url: baseContent.url,
          imageUrl: baseContent.imageUrl
        };
      case 'twitter':
        // Limit to 280 characters for Twitter
        return {
          message: baseContent.message.substring(0, 250) + (baseContent.url ? ` ${baseContent.url}` : ''),
          imageUrl: baseContent.imageUrl
        };
      case 'linkedin':
        return {
          message: baseContent.message,
          title: baseContent.title,
          url: baseContent.url,
          imageUrl: baseContent.imageUrl
        };
      case 'instagram':
        return {
          caption: baseContent.message,
          imageUrl: baseContent.imageUrl,
          // Instagram requires media
          media_type: 'image'
        };
      default:
        return baseContent;
    }
  }

  /**
   * Get active account for a platform
   */
  private async getActivePlatformAccount(platform: string): Promise<SocialAccount | null> {
    const { data, error } = await this.supabase
      .from('social_accounts')
      .select('*')
      .eq('platform', platform)
      .eq('is_active', true)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * Update post status and metadata
   */
  private async updatePostStatus(postId: string, status: SocialPost['status'], metadata: Partial<SocialPost> = {}): Promise<void> {
    await this.supabase
      .from('social_posts')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...metadata
      })
      .eq('id', postId);
  }

  /**
   * Schedule a publish job using cron
   */
  private schedulePublishJob(post: SocialPost): void {
    const scheduledTime = new Date(post.scheduled_time);
    const cronExpression = this.dateToCronExpression(scheduledTime);
    
    const job = cron.schedule(cronExpression, async () => {
      console.log(`Publishing scheduled post ${post.id} on ${post.platform}`);
      await this.publishPost(post.id);
      
      // Remove the job after execution
      this.scheduledJobs.delete(post.id);
      job.destroy();
    }, {
      scheduled: false
    });

    this.scheduledJobs.set(post.id, job);
    job.start();
  }

  /**
   * Convert Date to cron expression
   */
  private dateToCronExpression(date: Date): string {
    const minute = date.getUTCMinutes();
    const hour = date.getUTCHours();
    const day = date.getUTCDate();
    const month = date.getUTCMonth() + 1;
    
    return `${minute} ${hour} ${day} ${month} *`;
  }

  /**
   * Start the main scheduler that processes queued posts
   */
  private startScheduler(): void {
    // Run every minute to check for posts to publish
    cron.schedule('* * * * *', async () => {
      await this.processScheduledPosts();
    });

    // Run every hour to retry failed posts
    cron.schedule('0 * * * *', async () => {
      await this.retryFailedPosts();
    });
  }

  /**
   * Process posts that are due for publishing
   */
  private async processScheduledPosts(): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      const { data: duePosts, error } = await this.supabase
        .from('social_posts')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_time', now)
        .limit(10);

      if (error || !duePosts) {
        return;
      }

      for (const post of duePosts) {
        await this.publishPost(post.id);
      }
    } catch (error) {
      console.error('Error processing scheduled posts:', error);
    }
  }

  /**
   * Retry failed posts that haven't exceeded max retry count
   */
  private async retryFailedPosts(): Promise<void> {
    try {
      const { data: failedPosts, error } = await this.supabase
        .from('social_posts')
        .select('*')
        .eq('status', 'failed')
        .lt('retry_count', 3) // Default max_retries
        .limit(5);

      if (error || !failedPosts) {
        return;
      }

      for (const post of failedPosts) {
        // Update retry count
        await this.supabase
          .from('social_posts')
          .update({
            retry_count: post.retry_count + 1,
            status: 'scheduled',
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id);

        // Retry publishing
        await this.publishPost(post.id);
      }
    } catch (error) {
      console.error('Error retrying failed posts:', error);
    }
  }

  /**
   * Get scheduled posts for a content item
   */
  async getScheduledPosts(contentId: string): Promise<SocialSchedulerResult<SocialPost[]>> {
    try {
      const { data, error } = await this.supabase
        .from('social_posts')
        .select(`
          *,
          social_accounts (platform, account_name)
        `)
        .eq('content_id', contentId)
        .order('scheduled_time', { ascending: true });

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_POSTS_ERROR',
          message: 'Failed to get scheduled posts',
          details: error
        }
      };
    }
  }

  /**
   * Cancel a scheduled post
   */
  async cancelScheduledPost(postId: string): Promise<SocialSchedulerResult<void>> {
    try {
      // Cancel the cron job if it exists
      const job = this.scheduledJobs.get(postId);
      if (job) {
        job.destroy();
        this.scheduledJobs.delete(postId);
      }

      // Update database
      await this.updatePostStatus(postId, 'cancelled');

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CANCEL_POST_ERROR',
          message: 'Failed to cancel scheduled post',
          details: error
        }
      };
    }
  }

  /**
   * Get social media analytics
   */
  async getAnalytics(timeRange: '7d' | '30d' | '90d' = '30d'): Promise<SocialSchedulerResult<any>> {
    try {
      const startDate = new Date();
      switch (timeRange) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
      }

      const { data: posts, error } = await this.supabase
        .from('social_posts')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (error) {
        throw error;
      }

      const analytics = {
        total_posts: posts.length,
        published_posts: posts.filter(p => p.status === 'published').length,
        failed_posts: posts.filter(p => p.status === 'failed').length,
        scheduled_posts: posts.filter(p => p.status === 'scheduled').length,
        platform_breakdown: this.calculatePlatformBreakdown(posts),
        success_rate: posts.length ? (posts.filter(p => p.status === 'published').length / posts.length * 100) : 0
      };

      return {
        success: true,
        data: analytics
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Failed to get analytics',
          details: error
        }
      };
    }
  }

  private calculatePlatformBreakdown(posts: SocialPost[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    for (const post of posts) {
      breakdown[post.platform] = (breakdown[post.platform] || 0) + 1;
    }

    return breakdown;
  }
}