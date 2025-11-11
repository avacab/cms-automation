import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ContentItem } from './SupabaseService.js';

export interface SocialMediaMapping {
  id: string;
  content_item_id: string;
  social_post_id: string;
  platform: 'linkedin' | 'facebook' | 'twitter' | 'instagram';
  auto_publish: boolean;
  publish_immediately: boolean;
  custom_message?: string;
  hashtags?: string[];
  status: 'pending' | 'published' | 'failed' | 'skipped';
  published_at?: string;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SocialPost {
  id: string;
  content_id?: string;
  platform: 'linkedin' | 'facebook' | 'twitter' | 'instagram';
  account_id: string;
  status: 'scheduled' | 'published' | 'failed' | 'cancelled';
  scheduled_time?: string;
  published_time?: string;
  post_data: Record<string, any>;
  platform_post_id?: string;
  retry_count: number;
  max_retries: number;
  error_message?: string;
  analytics_data: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface LinkedInPostData {
  text: string;
  url?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
}

export interface ContentPublishingResult {
  success: boolean;
  message: string;
  social_post_id?: string;
  mapping_id?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export class ContentPublishingService {
  private supabase: SupabaseClient;
  private isConnected: boolean = false;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async initialize(): Promise<boolean> {
    try {
      // Test connection by querying social_accounts
      const { error } = await this.supabase
        .from('social_accounts')
        .select('id')
        .limit(1);

      if (error && error.code === 'PGRST116') {
        console.log('ℹ️  Social media tables not yet created in Supabase');
        this.isConnected = false;
        return false;
      } else if (error) {
        console.error('❌ ContentPublishingService connection error:', error);
        this.isConnected = false;
        return false;
      }

      this.isConnected = true;
      console.log('✅ ContentPublishingService successfully connected to Supabase');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize ContentPublishingService:', error);
      this.isConnected = false;
      return false;
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Monitor content_items for status changes and trigger social media publishing
   */
  async handleContentPublished(contentItem: ContentItem, scheduleOption?: string, customDateTime?: string): Promise<ContentPublishingResult[]> {
    if (!this.isConnected) {
      throw new Error('ContentPublishingService not initialized');
    }

    console.log(`📝 Processing published content: ${contentItem.title} (${contentItem.id})`);

    try {
      // Get active LinkedIn accounts for auto-publishing
      const { data: linkedinAccounts, error: accountsError } = await this.supabase
        .from('social_accounts')
        .select('*')
        .eq('platform', 'linkedin')
        .eq('is_active', true);

      if (accountsError) {
        throw new Error(`Failed to fetch LinkedIn accounts: ${accountsError.message}`);
      }

      if (!linkedinAccounts || linkedinAccounts.length === 0) {
        console.log('⚠️  No active LinkedIn accounts found for auto-publishing');
        return [{
          success: false,
          message: 'No active LinkedIn accounts configured for auto-publishing'
        }];
      }

      const results: ContentPublishingResult[] = [];

      // Process each LinkedIn account
      for (const account of linkedinAccounts) {
        try {
          const result = await this.createLinkedInPost(contentItem, account, scheduleOption, customDateTime);
          results.push(result);
        } catch (error) {
          console.error(`❌ Failed to create LinkedIn post for account ${account.account_name}:`, error);
          results.push({
            success: false,
            message: `Failed to create LinkedIn post for ${account.account_name}`,
            error: {
              code: 'LINKEDIN_POST_CREATION_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error',
              details: error
            }
          });
        }
      }

      return results;
    } catch (error) {
      console.error('❌ Error in handleContentPublished:', error);
      return [{
        success: false,
        message: 'Failed to process content for social media publishing',
        error: {
          code: 'CONTENT_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error
        }
      }];
    }
  }

  /**
   * Create a LinkedIn post from content item
   */
  private async createLinkedInPost(contentItem: ContentItem, account: any, scheduleOption?: string, customDateTime?: string): Promise<ContentPublishingResult> {
    // Transform content to LinkedIn format
    const linkedinPostData = this.transformContentToLinkedIn(contentItem);

    // Calculate optimal posting time based on user's schedule preference
    const scheduledTime = this.calculateOptimalPostTime(scheduleOption, customDateTime);

    // Create social_posts record
    const socialPostData = {
      content_id: contentItem.id,
      platform: 'linkedin' as const,
      account_id: account.id,
      status: 'scheduled' as const,
      scheduled_time: scheduledTime.toISOString(),
      post_data: linkedinPostData,
      retry_count: 0,
      max_retries: 3,
      analytics_data: {}
    };

    const { data: socialPost, error: postError } = await this.supabase
      .from('social_posts')
      .insert([socialPostData])
      .select()
      .single();

    if (postError) {
      throw new Error(`Failed to create social_posts record: ${postError.message}`);
    }

    // Create content_social_mappings record
    const mappingData = {
      content_item_id: contentItem.id,
      social_post_id: socialPost.id,
      platform: 'linkedin' as const,
      auto_publish: true,
      publish_immediately: false, // Will be scheduled for optimal time
      custom_message: linkedinPostData.text,
      hashtags: this.extractHashtags(linkedinPostData.text),
      status: 'pending' as const
    };

    const { data: mapping, error: mappingError } = await this.supabase
      .from('content_social_mappings')
      .insert([mappingData])
      .select()
      .single();

    if (mappingError) {
      // Clean up social_posts record if mapping failed
      await this.supabase
        .from('social_posts')
        .delete()
        .eq('id', socialPost.id);
      
      throw new Error(`Failed to create content_social_mappings record: ${mappingError.message}`);
    }

    console.log(`✅ Created LinkedIn post schedule for "${contentItem.title}" → ${account.account_name} at ${scheduledTime.toISOString()}`);

    return {
      success: true,
      message: `LinkedIn post scheduled for ${account.account_name} at ${scheduledTime.toLocaleString()}`,
      social_post_id: socialPost.id,
      mapping_id: mapping.id
    };
  }

  /**
   * Transform CMS content to LinkedIn post format
   */
  transformContentToLinkedIn(contentItem: ContentItem, companyBranding: string = 'haidrun'): LinkedInPostData {
    const content = contentItem.content;
    
    // Extract title and content
    const title = contentItem.title;
    const body = this.extractTextFromContent(content);
    
    // Create engaging LinkedIn post text with company branding
    const linkedinText = this.formatLinkedInPost(title, body, companyBranding);
    
    // Extract URL if available
    const url = content.url || content.permalink || undefined;
    
    // Create LinkedIn post data
    const postData: LinkedInPostData = {
      text: linkedinText,
      title: title,
      visibility: 'PUBLIC'
    };

    // Add URL and description if available
    if (url) {
      postData.url = url;
      postData.description = this.createDescription(body);
    }

    // Add featured image if available
    if (content.featured_image || content.image) {
      postData.imageUrl = content.featured_image || content.image;
    }

    return postData;
  }

  /**
   * Transform CMS content to WordPress post format
   */
  transformContentToWordPress(contentItem: ContentItem, companyBranding: string = 'haidrun'): any {
    const content = contentItem.content;
    
    // Extract content body
    const body = this.extractTextFromContent(content);
    
    // Create WordPress post data
    const wordpressData: any = {
      title: contentItem.title,
      content: body,
      slug: contentItem.slug || this.generateSlugFromTitle(contentItem.title),
      status: 'published',
      excerpt: this.createDescription(body),
      meta: {
        source: 'headless_cms',
        cms_id: contentItem.id,
        company: companyBranding,
        published_from_cms: true
      },
      categories: this.getWordPressCategoriesForCompany(companyBranding),
      tags: this.extractKeywordsAsTags(contentItem.title, body)
    };

    // Add featured image if available
    if (content.featured_image || content.image) {
      wordpressData.featured_image_url = content.featured_image || content.image;
    }

    return wordpressData;
  }

  /**
   * Get WordPress categories based on company branding
   */
  private getWordPressCategoriesForCompany(companyBranding: string): string[] {
    const categoryMap: Record<string, string[]> = {
      'haidrun': ['Company News', 'Technology', 'Innovation'],
      'personal': ['Blog', 'Personal']
    };
    
    return categoryMap[companyBranding] || ['Uncategorized'];
  }

  /**
   * Generate slug from title
   */
  private generateSlugFromTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Extract keywords as WordPress tags
   */
  private extractKeywordsAsTags(title: string, body: string): string[] {
    const text = (title + ' ' + body).toLowerCase();
    const keywords: string[] = [];
    
    // Common business/tech keywords
    const keywordPatterns = [
      'innovation', 'technology', 'leadership', 'growth', 'strategy',
      'business', 'development', 'success', 'team', 'company',
      'announcement', 'news', 'update', 'launch', 'partnership'
    ];
    
    keywordPatterns.forEach(keyword => {
      if (text.includes(keyword) && keywords.length < 10) {
        keywords.push(keyword);
      }
    });
    
    return keywords;
  }

  /**
   * Extract plain text from rich content
   */
  private extractTextFromContent(content: Record<string, any>): string {
    // Handle different content formats
    if (typeof content === 'string') {
      return this.stripHtml(content);
    }

    // Check for 'text' property first (our standard format)
    if (content.text) {
      return this.stripHtml(content.text);
    }

    if (content.body) {
      return this.stripHtml(content.body);
    }

    if (content.content) {
      return this.stripHtml(content.content);
    }

    if (content.excerpt) {
      return this.stripHtml(content.excerpt);
    }

    // Try to extract from WordPress-style content
    if (content.post_content) {
      return this.stripHtml(content.post_content);
    }

    return '';
  }

  /**
   * Strip HTML tags and decode entities
   */
  private stripHtml(html: string): string {
    if (!html || typeof html !== 'string') return '';

    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'") // Replace &#39; with '
      .replace(/[^\S\r\n]+/g, ' ') // Replace multiple spaces/tabs with single space, but preserve newlines
      .trim();
  }

  /**
   * Format content for LinkedIn professional audience
   */
  private formatLinkedInPost(title: string, body: string, companyBranding: string = 'haidrun'): string {
    // Truncate body for LinkedIn's 3000 character limit
    const maxBodyLength = 2600; // Leave room for title, formatting, and branding
    let truncatedBody = body;
    
    if (body.length > maxBodyLength) {
      truncatedBody = body.substring(0, maxBodyLength).trim();
      // Find last complete sentence
      const lastPeriod = truncatedBody.lastIndexOf('.');
      const lastExclamation = truncatedBody.lastIndexOf('!');
      const lastQuestion = truncatedBody.lastIndexOf('?');
      const lastSentence = Math.max(lastPeriod, lastExclamation, lastQuestion);
      
      if (lastSentence > maxBodyLength * 0.8) {
        truncatedBody = truncatedBody.substring(0, lastSentence + 1);
      }
      truncatedBody += '...';
    }

    // Create professional LinkedIn post with company branding
    let linkedinPost = '';
    
    // Add company branding header
    if (companyBranding === 'haidrun') {
      linkedinPost += `🚀 ${title}\n\n`;
    } else {
      linkedinPost += `📝 ${title}\n\n`;
    }
    
    if (truncatedBody) {
      linkedinPost += `${truncatedBody}\n\n`;
    }
    
    // Add relevant hashtags with company focus
    linkedinPost += this.generateRelevantHashtags(title, body, companyBranding);
    
    // Add company-specific call to action
    if (companyBranding === 'haidrun') {
      linkedinPost += '\n\n💭 What are your thoughts on this innovation? Share your insights below!';
      linkedinPost += '\n\n#TeamHaidrun #InnovationLeadership';
    } else {
      linkedinPost += '\n\n💭 What are your thoughts? Share your insights in the comments!';
    }
    
    return linkedinPost.trim();
  }

  /**
   * Create description for link preview
   */
  private createDescription(body: string): string {
    const maxLength = 300;
    if (body.length <= maxLength) return body;
    
    const truncated = body.substring(0, maxLength).trim();
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Generate relevant hashtags based on content
   */
  private generateRelevantHashtags(title: string, body: string, companyBranding: string = 'haidrun'): string {
    const text = (title + ' ' + body).toLowerCase();
    const hashtags: string[] = [];
    
    // Company-specific hashtags
    if (companyBranding === 'haidrun') {
      // Haidrun-specific hashtags based on content
      const haidrunHashtagMap = {
        'technology': '#HaidrunTech',
        'innovation': '#HaidrunInnovation',
        'leadership': '#HaidrunLeadership',
        'team': '#HaidrunTeam',
        'announcement': '#HaidrunNews',
        'cfo': '#HaidrunLeadership',
        'financial': '#CorporateFinance',
        'growth': '#BusinessGrowth',
        'appointment': '#NewHire',
        'news': '#CompanyNews'
      };
      
      // Add Haidrun-specific hashtags first
      for (const [keyword, hashtag] of Object.entries(haidrunHashtagMap)) {
        if (text.includes(keyword) && hashtags.length < 3) {
          hashtags.push(hashtag);
        }
      }
    }
    
    // Common professional hashtags based on content
    const hashtagMap = {
      'technology': '#Technology',
      'business': '#Business',
      'marketing': '#Marketing',
      'development': '#Development',
      'design': '#Design',
      'leadership': '#Leadership',
      'innovation': '#Innovation',
      'productivity': '#Productivity',
      'strategy': '#Strategy',
      'growth': '#Growth',
      'ai': '#ArtificialIntelligence',
      'artificial intelligence': '#ArtificialIntelligence',
      'machine learning': '#MachineLearning',
      'data': '#Data',
      'analytics': '#Analytics',
      'cms': '#ContentManagement',
      'content': '#Content',
      'wordpress': '#WordPress',
      'web development': '#WebDevelopment',
      'javascript': '#JavaScript',
      'react': '#React',
      'api': '#API',
      'cfo': '#CFO',
      'chief financial officer': '#CFO',
      'appointment': '#Leadership',
      'executive': '#CLevel'
    };
    
    // Find relevant hashtags (avoid duplicates)
    for (const [keyword, hashtag] of Object.entries(hashtagMap)) {
      if (text.includes(keyword) && hashtags.length < 5 && !hashtags.includes(hashtag)) {
        hashtags.push(hashtag);
      }
    }
    
    // Add default professional hashtags if none found
    if (hashtags.length === 0) {
      if (companyBranding === 'haidrun') {
        hashtags.push('#Haidrun', '#TechInnovation');
      } else {
        hashtags.push('#Professional', '#Content');
      }
    }
    
    return hashtags.join(' ');
  }

  /**
   * Extract hashtags from text
   */
  private extractHashtags(text: string): string[] {
    const hashtagPattern = /#\w+/g;
    const matches = text.match(hashtagPattern);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }

  /**
   * Calculate optimal posting time (12:00 PM UTC or next business day)
   */
  private calculateOptimalPostTime(scheduleOption?: string, customDateTime?: string): Date {
    const now = new Date();

    // Handle custom date/time
    if (scheduleOption === 'custom' && customDateTime) {
      return new Date(customDateTime);
    }

    // Handle immediate publishing
    if (scheduleOption === 'immediate') {
      return now;
    }

    const optimalTime = new Date();

    // Handle preset times
    if (scheduleOption === 'tomorrow_9am') {
      optimalTime.setUTCDate(optimalTime.getUTCDate() + 1);
      optimalTime.setUTCHours(9, 0, 0, 0);
    } else if (scheduleOption === 'tomorrow_5pm') {
      optimalTime.setUTCDate(optimalTime.getUTCDate() + 1);
      optimalTime.setUTCHours(17, 0, 0, 0);
    } else {
      // Default: tomorrow at 12:00 PM UTC (optimal LinkedIn engagement time)
      optimalTime.setUTCHours(12, 0, 0, 0);

      // If it's past 12 PM UTC today, schedule for tomorrow
      if (optimalTime <= now) {
        optimalTime.setUTCDate(optimalTime.getUTCDate() + 1);
      }

      // Avoid weekends - move to Monday if scheduled for weekend
      const dayOfWeek = optimalTime.getUTCDay();
      if (dayOfWeek === 0) { // Sunday
        optimalTime.setUTCDate(optimalTime.getUTCDate() + 1);
      } else if (dayOfWeek === 6) { // Saturday
        optimalTime.setUTCDate(optimalTime.getUTCDate() + 2);
      }
    }

    return optimalTime;
  }

  /**
   * Get pending social posts that need to be published
   */
  async getPendingPosts(): Promise<SocialPost[]> {
    if (!this.isConnected) {
      throw new Error('ContentPublishingService not initialized');
    }

    const now = new Date().toISOString();
    
    const { data, error } = await this.supabase
      .from('social_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_time', now)
      .order('scheduled_time', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch pending posts: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update social post status
   */
  async updateSocialPostStatus(
    postId: string, 
    status: 'scheduled' | 'published' | 'failed' | 'cancelled',
    updates: Partial<SocialPost> = {}
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('ContentPublishingService not initialized');
    }

    const updateData = {
      status,
      updated_at: new Date().toISOString(),
      ...updates
    };

    if (status === 'published') {
      updateData.published_time = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('social_posts')
      .update(updateData)
      .eq('id', postId);

    if (error) {
      throw new Error(`Failed to update social post status: ${error.message}`);
    }

    // Also update corresponding content_social_mappings
    const mappingStatus = status === 'published' ? 'published' : 'failed';
    const mappingUpdate: any = {
      status: mappingStatus,
      updated_at: new Date().toISOString()
    };

    if (status === 'published') {
      mappingUpdate.published_at = new Date().toISOString();
    }

    if (updates.error_message) {
      mappingUpdate.error_message = updates.error_message;
    }

    await this.supabase
      .from('content_social_mappings')
      .update(mappingUpdate)
      .eq('social_post_id', postId);
  }
}