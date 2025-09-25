import { SocialMediaPost } from './SocialMediaService.js';

export interface ScheduledPost {
  id: string;
  platform: string;
  content: string;
  hashtags: string[];
  images?: string[];
  scheduled_time: Date;
  status: 'pending' | 'published' | 'failed' | 'cancelled';
  post_id?: string; // ID from social platform after posting
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface SchedulingRule {
  platform: string;
  optimal_times: string[]; // e.g., ['09:00', '13:00', '18:00']
  timezone: string;
  max_posts_per_day: number;
  min_interval_hours: number;
}

export class SocialSchedulingService {
  private scheduledPosts: Map<string, ScheduledPost> = new Map();

  /**
   * Schedule social media posts with optimal timing
   */
  async schedulePosts(
    socialPosts: SocialMediaPost[],
    schedulingRules?: SchedulingRule[]
  ): Promise<ScheduledPost[]> {
    const scheduled: ScheduledPost[] = [];

    for (const post of socialPosts) {
      try {
        const rule = schedulingRules?.find(r => r.platform === post.platform);
        const scheduledTime = this.calculateOptimalPostTime(post.platform, rule);
        
        const scheduledPost: ScheduledPost = {
          id: this.generateId(),
          platform: post.platform,
          content: post.content,
          hashtags: post.hashtags,
          images: post.images?.map(img => img.url),
          scheduled_time: scheduledTime,
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date()
        };

        this.scheduledPosts.set(scheduledPost.id, scheduledPost);
        scheduled.push(scheduledPost);

        // Set up actual scheduling (would use a job queue in production)
        this.schedulePostExecution(scheduledPost);

      } catch (error) {
        console.error(`Failed to schedule post for ${post.platform}:`, error);
      }
    }

    return scheduled;
  }

  /**
   * Get optimal posting time based on platform and rules
   */
  private calculateOptimalPostTime(platform: string, rule?: SchedulingRule): Date {
    const now = new Date();
    const defaultTimes = this.getDefaultOptimalTimes(platform);
    const optimalTimes = rule?.optimal_times || defaultTimes;

    // Find next optimal time
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    for (const timeStr of optimalTimes) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const optimalTime = new Date(today);
      optimalTime.setHours(hours, minutes, 0, 0);

      // If this time hasn't passed today, use it
      if (optimalTime > now) {
        return this.adjustForConflicts(optimalTime, platform, rule);
      }
    }

    // All times have passed today, use first time tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [hours, minutes] = optimalTimes[0].split(':').map(Number);
    tomorrow.setHours(hours, minutes, 0, 0);

    return this.adjustForConflicts(tomorrow, platform, rule);
  }

  /**
   * Adjust scheduled time to avoid conflicts
   */
  private adjustForConflicts(
    proposedTime: Date, 
    platform: string, 
    rule?: SchedulingRule
  ): Date {
    const minInterval = (rule?.min_interval_hours || 2) * 60 * 60 * 1000; // Convert to milliseconds
    const existingPosts = Array.from(this.scheduledPosts.values())
      .filter(p => p.platform === platform && p.status === 'pending')
      .sort((a, b) => a.scheduled_time.getTime() - b.scheduled_time.getTime());

    let adjustedTime = new Date(proposedTime);

    for (const existingPost of existingPosts) {
      const timeDiff = Math.abs(adjustedTime.getTime() - existingPost.scheduled_time.getTime());
      
      if (timeDiff < minInterval) {
        // Move to after the existing post + minimum interval
        adjustedTime = new Date(existingPost.scheduled_time.getTime() + minInterval);
      }
    }

    return adjustedTime;
  }

  /**
   * Get default optimal posting times for each platform
   */
  private getDefaultOptimalTimes(platform: string): string[] {
    const defaultTimes: Record<string, string[]> = {
      facebook: ['13:00', '15:00', '20:00'],
      instagram: ['11:00', '13:00', '17:00', '19:00'],
      twitter: ['08:00', '12:00', '17:00', '19:00'],
      linkedin: ['08:00', '12:00', '17:00']
    };

    return defaultTimes[platform] || ['12:00', '18:00'];
  }

  /**
   * Execute scheduled post (integrate with actual social media APIs)
   */
  private schedulePostExecution(scheduledPost: ScheduledPost): void {
    const delay = scheduledPost.scheduled_time.getTime() - Date.now();
    
    if (delay > 0) {
      setTimeout(async () => {
        await this.executePost(scheduledPost);
      }, delay);
    } else {
      // Past due, execute immediately
      this.executePost(scheduledPost);
    }
  }

  /**
   * Execute the actual posting to social media
   */
  private async executePost(scheduledPost: ScheduledPost): Promise<void> {
    try {
      console.log(`Executing post for ${scheduledPost.platform}:`, scheduledPost.content);
      
      // This is where you'd integrate with actual social media APIs
      // For now, we'll simulate successful posting
      const simulatedPostId = `${scheduledPost.platform}_${Date.now()}`;
      
      scheduledPost.status = 'published';
      scheduledPost.post_id = simulatedPostId;
      scheduledPost.updated_at = new Date();

      console.log(`✅ Successfully posted to ${scheduledPost.platform}: ${simulatedPostId}`);

    } catch (error) {
      console.error(`❌ Failed to post to ${scheduledPost.platform}:`, error);
      
      scheduledPost.status = 'failed';
      scheduledPost.error_message = error instanceof Error ? error.message : 'Unknown error';
      scheduledPost.updated_at = new Date();
    }
  }

  /**
   * Get scheduled posts
   */
  getScheduledPosts(filters?: {
    platform?: string;
    status?: string;
    date_range?: { start: Date; end: Date };
  }): ScheduledPost[] {
    let posts = Array.from(this.scheduledPosts.values());

    if (filters?.platform) {
      posts = posts.filter(p => p.platform === filters.platform);
    }

    if (filters?.status) {
      posts = posts.filter(p => p.status === filters.status);
    }

    if (filters?.date_range) {
      posts = posts.filter(p => 
        p.scheduled_time >= filters.date_range!.start &&
        p.scheduled_time <= filters.date_range!.end
      );
    }

    return posts.sort((a, b) => a.scheduled_time.getTime() - b.scheduled_time.getTime());
  }

  /**
   * Cancel a scheduled post
   */
  cancelScheduledPost(postId: string): boolean {
    const post = this.scheduledPosts.get(postId);
    if (post && post.status === 'pending') {
      post.status = 'cancelled';
      post.updated_at = new Date();
      return true;
    }
    return false;
  }

  /**
   * Get posting analytics
   */
  getAnalytics(platform?: string): {
    total_scheduled: number;
    published: number;
    failed: number;
    pending: number;
    success_rate: number;
  } {
    const posts = platform 
      ? Array.from(this.scheduledPosts.values()).filter(p => p.platform === platform)
      : Array.from(this.scheduledPosts.values());

    const total_scheduled = posts.length;
    const published = posts.filter(p => p.status === 'published').length;
    const failed = posts.filter(p => p.status === 'failed').length;
    const pending = posts.filter(p => p.status === 'pending').length;
    const success_rate = total_scheduled > 0 ? (published / total_scheduled) * 100 : 0;

    return {
      total_scheduled,
      published,
      failed,
      pending,
      success_rate: Math.round(success_rate * 100) / 100
    };
  }

  /**
   * Utility function to generate unique IDs
   */
  private generateId(): string {
    return `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Singleton instance for global use
 */
export const socialSchedulingService = new SocialSchedulingService();