import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LinkedInService } from './LinkedInService.js';
import { ContentPublishingService, SocialPost } from './ContentPublishingService.js';
import cron from 'node-cron';

export interface SocialAccount {
  id: string;
  platform: 'linkedin' | 'facebook' | 'twitter' | 'instagram';
  account_name: string;
  account_id: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  is_active: boolean;
  account_data: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface OrchestratorResult {
  success: boolean;
  message: string;
  posts_processed: number;
  successful_posts: number;
  failed_posts: number;
  errors: Array<{
    post_id: string;
    platform: string;
    error: string;
  }>;
}

export class SocialMediaOrchestrator {
  private supabase: SupabaseClient;
  private contentPublishingService: ContentPublishingService;
  private linkedinService: LinkedInService | null = null;
  private isRunning: boolean = false;
  private scheduledJob: any = null;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    linkedinConfig?: { clientId: string; clientSecret: string },
    contentPublishingService?: ContentPublishingService
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Reuse existing ContentPublishingService if provided, otherwise create new one
    this.contentPublishingService = contentPublishingService || new ContentPublishingService(supabaseUrl, supabaseKey);

    // Initialize LinkedIn service if config provided
    if (linkedinConfig) {
      this.linkedinService = new LinkedInService(linkedinConfig);
    }
  }

  async initialize(): Promise<boolean> {
    try {
      // Only initialize content publishing service if it's not already initialized
      if (!this.contentPublishingService.isReady()) {
        const contentServiceReady = await this.contentPublishingService.initialize();
        if (!contentServiceReady) {
          console.error('❌ Failed to initialize ContentPublishingService');
          return false;
        }
      }

      console.log('✅ SocialMediaOrchestrator initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize SocialMediaOrchestrator:', error);
      return false;
    }
  }

  /**
   * Start the scheduler to process pending social media posts
   */
  startScheduler(): void {
    if (this.isRunning) {
      console.log('⚠️  SocialMediaOrchestrator scheduler is already running');
      return;
    }

    // Run every 5 minutes to check for posts to publish
    this.scheduledJob = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.processPendingPosts();
      } catch (error) {
        console.error('❌ Error in scheduler processing:', error);
      }
    });

    this.scheduledJob.start();
    this.isRunning = true;
    console.log('⏰ SocialMediaOrchestrator scheduler started (every 5 minutes)');
  }

  /**
   * Stop the scheduler
   */
  stopScheduler(): void {
    if (this.scheduledJob) {
      this.scheduledJob.stop();
      this.scheduledJob = null;
    }
    this.isRunning = false;
    console.log('⏹️  SocialMediaOrchestrator scheduler stopped');
  }

  /**
   * Process all pending social media posts
   */
  async processPendingPosts(): Promise<OrchestratorResult> {
    console.log('🔄 Processing pending social media posts...');

    try {
      // Get pending posts that are ready to be published
      const pendingPosts = await this.contentPublishingService.getPendingPosts();
      
      if (pendingPosts.length === 0) {
        console.log('✅ No pending posts to process');
        return {
          success: true,
          message: 'No pending posts to process',
          posts_processed: 0,
          successful_posts: 0,
          failed_posts: 0,
          errors: []
        };
      }

      console.log(`📝 Found ${pendingPosts.length} pending posts to process`);

      let successfulPosts = 0;
      let failedPosts = 0;
      const errors: Array<{ post_id: string; platform: string; error: string }> = [];

      // Process each pending post
      for (const post of pendingPosts) {
        try {
          const result = await this.publishSocialPost(post);
          if (result.success) {
            successfulPosts++;
            console.log(`✅ Successfully published ${post.platform} post: ${post.id}`);
          } else {
            failedPosts++;
            errors.push({
              post_id: post.id,
              platform: post.platform,
              error: result.error || 'Unknown error'
            });
            console.error(`❌ Failed to publish ${post.platform} post: ${post.id} - ${result.error}`);
          }
        } catch (error) {
          failedPosts++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({
            post_id: post.id,
            platform: post.platform,
            error: errorMessage
          });
          console.error(`❌ Exception publishing ${post.platform} post: ${post.id}`, error);
        }
      }

      const result: OrchestratorResult = {
        success: true,
        message: `Processed ${pendingPosts.length} posts: ${successfulPosts} successful, ${failedPosts} failed`,
        posts_processed: pendingPosts.length,
        successful_posts: successfulPosts,
        failed_posts: failedPosts,
        errors
      };

      console.log(`📊 Processing summary: ${result.message}`);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error in processPendingPosts:', error);
      
      return {
        success: false,
        message: `Failed to process pending posts: ${errorMessage}`,
        posts_processed: 0,
        successful_posts: 0,
        failed_posts: 0,
        errors: [{ post_id: 'system', platform: 'system', error: errorMessage }]
      };
    }
  }

  /**
   * Publish a single social media post
   */
  private async publishSocialPost(post: SocialPost): Promise<{ success: boolean; error?: string; post_id?: string }> {
    try {
      // Get the social account for this post
      const { data: account, error: accountError } = await this.supabase
        .from('social_accounts')
        .select('*')
        .eq('id', post.account_id)
        .eq('is_active', true)
        .single();

      if (accountError || !account) {
        const error = `Social account not found or inactive: ${post.account_id}`;
        await this.contentPublishingService.updateSocialPostStatus(post.id, 'failed', {
          error_message: error
        });
        return { success: false, error };
      }

      // Route to appropriate platform service
      switch (post.platform) {
        case 'linkedin':
          return await this.publishToLinkedIn(post, account);
        
        case 'facebook':
          // TODO: Implement Facebook publishing
          const fbError = 'Facebook publishing not yet implemented';
          await this.contentPublishingService.updateSocialPostStatus(post.id, 'failed', {
            error_message: fbError
          });
          return { success: false, error: fbError };
        
        case 'twitter':
          // TODO: Implement Twitter publishing
          const twitterError = 'Twitter publishing not yet implemented';
          await this.contentPublishingService.updateSocialPostStatus(post.id, 'failed', {
            error_message: twitterError
          });
          return { success: false, error: twitterError };

        case 'instagram':
          // TODO: Implement Instagram publishing
          const instaError = 'Instagram publishing not yet implemented';
          await this.contentPublishingService.updateSocialPostStatus(post.id, 'failed', {
            error_message: instaError
          });
          return { success: false, error: instaError };

        default:
          const unknownError = `Unknown platform: ${post.platform}`;
          await this.contentPublishingService.updateSocialPostStatus(post.id, 'failed', {
            error_message: unknownError
          });
          return { success: false, error: unknownError };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.contentPublishingService.updateSocialPostStatus(post.id, 'failed', {
        error_message: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Publish to LinkedIn using LinkedInService
   */
  private async publishToLinkedIn(post: SocialPost, account: SocialAccount): Promise<{ success: boolean; error?: string; post_id?: string }> {
    try {
      if (!this.linkedinService) {
        // Initialize LinkedIn service on-demand
        const linkedinConfig = {
          clientId: process.env.LINKEDIN_CLIENT_ID || '',
          clientSecret: process.env.LINKEDIN_CLIENT_SECRET || ''
        };

        if (!linkedinConfig.clientId || !linkedinConfig.clientSecret) {
          const error = 'LinkedIn service not configured - missing client credentials';
          await this.contentPublishingService.updateSocialPostStatus(post.id, 'failed', {
            error_message: error
          });
          return { success: false, error };
        }

        this.linkedinService = new LinkedInService(linkedinConfig);
      }

      // Set the access token for this account
      this.linkedinService.setAccessToken(account.access_token);

      // Determine if posting as organization (check for organization_urn or organization_id)
      const postAsOrganization = !!(account.account_data?.organization_urn || account.account_data?.organization_id);

      if (postAsOrganization) {
        // Use organization_id (just the numeric ID, LinkedInService will add the urn prefix)
        const orgId = account.account_data?.organization_id;
        if (!orgId) {
          const error = 'Organization ID not found in account data';
          await this.contentPublishingService.updateSocialPostStatus(post.id, 'failed', {
            error_message: error
          });
          return { success: false, error };
        }
        this.linkedinService.setOrganizationUrn(orgId);
        console.log(`🏢 Posting as organization: ${orgId}`);
      } else {
        // Get user profile to set person URN
        const profileResult = await this.linkedinService.getUserProfile();
        if (!profileResult.success) {
          const error = `Failed to get LinkedIn profile: ${profileResult.error?.message}`;
          await this.contentPublishingService.updateSocialPostStatus(post.id, 'failed', {
            error_message: error
          });
          return { success: false, error };
        }
      }

      // Validate post data (type assertion since we control the data structure)
      const linkedInPostData = post.post_data as any as import('./LinkedInService.js').LinkedInPost;
      const validation = this.linkedinService.validatePost(linkedInPostData);
      if (!validation.valid) {
        const error = `LinkedIn post validation failed: ${validation.errors.join(', ')}`;
        await this.contentPublishingService.updateSocialPostStatus(post.id, 'failed', {
          error_message: error
        });
        return { success: false, error };
      }

      // Publish the post
      const publishResult = await this.linkedinService.publishPost(linkedInPostData, postAsOrganization);
      
      if (!publishResult.success) {
        const error = `LinkedIn publishing failed: ${publishResult.error?.message}`;
        
        // Increment retry count if under max retries
        if (post.retry_count < post.max_retries) {
          await this.contentPublishingService.updateSocialPostStatus(post.id, 'scheduled', {
            retry_count: post.retry_count + 1,
            error_message: error,
            scheduled_time: new Date(Date.now() + (5 * 60 * 1000)).toISOString() // Retry in 5 minutes
          });
          return { success: false, error: `${error} (will retry, attempt ${post.retry_count + 1}/${post.max_retries})` };
        } else {
          await this.contentPublishingService.updateSocialPostStatus(post.id, 'failed', {
            error_message: error
          });
          return { success: false, error: `${error} (max retries exceeded)` };
        }
      }

      // Success - update post status
      await this.contentPublishingService.updateSocialPostStatus(post.id, 'published', {
        platform_post_id: publishResult.data?.id || publishResult.data?.urn,
        published_time: new Date().toISOString()
      });

      console.log(`🎉 Successfully published LinkedIn post: ${publishResult.data?.id}`);
      return { 
        success: true, 
        post_id: publishResult.data?.id || publishResult.data?.urn 
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown LinkedIn publishing error';
      
      // Increment retry count if under max retries
      if (post.retry_count < post.max_retries) {
        await this.contentPublishingService.updateSocialPostStatus(post.id, 'scheduled', {
          retry_count: post.retry_count + 1,
          error_message: errorMessage,
          scheduled_time: new Date(Date.now() + (5 * 60 * 1000)).toISOString() // Retry in 5 minutes
        });
        return { success: false, error: `${errorMessage} (will retry, attempt ${post.retry_count + 1}/${post.max_retries})` };
      } else {
        await this.contentPublishingService.updateSocialPostStatus(post.id, 'failed', {
          error_message: errorMessage
        });
        return { success: false, error: `${errorMessage} (max retries exceeded)` };
      }
    }
  }

  /**
   * Manually trigger publishing for a specific post
   */
  async publishPostNow(postId: string): Promise<{ success: boolean; error?: string; post_id?: string }> {
    try {
      // Get the post from database
      const { data: post, error: postError } = await this.supabase
        .from('social_posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (postError || !post) {
        return { success: false, error: `Post not found: ${postId}` };
      }

      if (post.status === 'published') {
        return { success: false, error: 'Post is already published' };
      }

      if (post.status === 'cancelled') {
        return { success: false, error: 'Post has been cancelled' };
      }

      // Publish the post
      return await this.publishSocialPost(post);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Cancel a scheduled post
   */
  async cancelPost(postId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('social_posts')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', postId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Also update content_social_mappings
      await this.supabase
        .from('content_social_mappings')
        .update({ status: 'skipped', updated_at: new Date().toISOString() })
        .eq('social_post_id', postId);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get orchestrator statistics
   */
  async getStats(): Promise<{
    total_posts: number;
    scheduled_posts: number;
    published_posts: number;
    failed_posts: number;
    cancelled_posts: number;
    platforms: Record<string, number>;
  }> {
    try {
      const { data: posts, error } = await this.supabase
        .from('social_posts')
        .select('platform, status');

      if (error) {
        throw new Error(error.message);
      }

      const stats = {
        total_posts: posts?.length || 0,
        scheduled_posts: 0,
        published_posts: 0,
        failed_posts: 0,
        cancelled_posts: 0,
        platforms: {} as Record<string, number>
      };

      posts?.forEach(post => {
        // Count by status
        switch (post.status) {
          case 'scheduled':
            stats.scheduled_posts++;
            break;
          case 'published':
            stats.published_posts++;
            break;
          case 'failed':
            stats.failed_posts++;
            break;
          case 'cancelled':
            stats.cancelled_posts++;
            break;
        }

        // Count by platform
        stats.platforms[post.platform] = (stats.platforms[post.platform] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting orchestrator stats:', error);
      return {
        total_posts: 0,
        scheduled_posts: 0,
        published_posts: 0,
        failed_posts: 0,
        cancelled_posts: 0,
        platforms: {}
      };
    }
  }

  /**
   * Health check for the orchestrator
   */
  isHealthy(): boolean {
    return this.contentPublishingService.isReady();
  }
}