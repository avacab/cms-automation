import { OpenAIService } from './OpenAIService.js';

export interface SocialMediaPost {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin';
  content: string;
  hashtags: string[];
  images?: {
    url: string;
    alt: string;
    dimensions: string;
  }[];
  scheduledTime?: Date;
  link?: {
    url: string;
    title: string;
    description: string;
  };
}

export interface CMSContentInput {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  featured_image?: {
    url: string;
    alt: string;
  };
  tags?: string[];
  published_at: string;
}

export class SocialMediaService {
  private openAIService: OpenAIService;

  constructor() {
    this.openAIService = new OpenAIService();
  }

  /**
   * Transform CMS content to social media posts for all platforms
   */
  async transformToSocialPosts(cmsContent: CMSContentInput): Promise<SocialMediaPost[]> {
    const platforms = ['facebook', 'instagram', 'twitter', 'linkedin'] as const;
    const posts: SocialMediaPost[] = [];

    for (const platform of platforms) {
      try {
        const post = await this.transformForPlatform(cmsContent, platform);
        posts.push(post);
      } catch (error) {
        console.error(`Failed to transform content for ${platform}:`, error);
      }
    }

    return posts;
  }

  /**
   * Transform content for a specific platform
   */
  private async transformForPlatform(
    cmsContent: CMSContentInput, 
    platform: typeof platforms[number]
  ): Promise<SocialMediaPost> {
    const config = this.getPlatformConfig(platform);
    
    // Generate platform-specific content using AI
    const socialContent = await this.generateSocialContent(cmsContent, config);
    
    // Generate hashtags
    const hashtags = await this.generateHashtags(cmsContent, config);
    
    // Optimize images
    const images = cmsContent.featured_image ? 
      await this.optimizeImageForPlatform(cmsContent.featured_image, config) : 
      undefined;

    return {
      platform,
      content: socialContent,
      hashtags,
      images,
      link: {
        url: `https://yoursite.com/posts/${cmsContent.id}`,
        title: cmsContent.title,
        description: cmsContent.excerpt || this.truncateText(cmsContent.content, 160)
      }
    };
  }

  /**
   * Generate platform-optimized content using AI
   */
  private async generateSocialContent(
    cmsContent: CMSContentInput,
    config: PlatformConfig
  ): Promise<string> {
    if (!this.openAIService.isReady()) {
      // Fallback to manual transformation
      return this.manualContentTransform(cmsContent, config);
    }

    const prompt = `Transform this content for ${config.platform}:
    
Title: ${cmsContent.title}
Content: ${this.truncateText(cmsContent.content, 500)}

Requirements:
- Keep within ${config.textLimit} characters
- Use ${config.contentTone} tone
- Make it engaging for ${config.platform} audience
- Include a call-to-action
- Don't include hashtags (handled separately)
`;

    try {
      const result = await this.openAIService.generateContent({
        type: 'adapt',
        context: {
          prompt: prompt,
          targetFormat: `${config.platform}-post`,
          maxLength: config.textLimit
        },
        options: {
          maxTokens: Math.min(config.textLimit * 2, 500),
          temperature: 0.7
        }
      });

      if (result.success) {
        return this.truncateText(result.data.content, config.textLimit - 50); // Reserve space for link
      }
    } catch (error) {
      console.error('AI content generation failed:', error);
    }

    // Fallback to manual transformation
    return this.manualContentTransform(cmsContent, config);
  }

  /**
   * Generate platform-appropriate hashtags
   */
  private async generateHashtags(
    cmsContent: CMSContentInput,
    config: PlatformConfig
  ): Promise<string[]> {
    // Use existing tags as base
    const baseTags = cmsContent.tags || [];
    
    // Generate additional relevant hashtags using AI
    if (this.openAIService.isReady()) {
      try {
        const prompt = `Generate ${config.hashtagCount} relevant hashtags for this content:
        
Title: ${cmsContent.title}
Existing tags: ${baseTags.join(', ')}
Platform: ${config.platform}

Return only hashtags, one per line, including the # symbol.`;

        const result = await this.openAIService.generateContent({
          type: 'complete',
          context: {
            prompt: prompt
          },
          options: {
            maxTokens: 100,
            temperature: 0.5
          }
        });

        if (result.success) {
          const aiHashtags = result.data.content
            .split('\n')
            .map(tag => tag.trim())
            .filter(tag => tag.startsWith('#'))
            .slice(0, config.hashtagCount);

          return aiHashtags;
        }
      } catch (error) {
        console.error('AI hashtag generation failed:', error);
      }
    }

    // Fallback: Convert existing tags to hashtags
    return baseTags
      .slice(0, config.hashtagCount)
      .map(tag => `#${tag.replace(/\s+/g, '').toLowerCase()}`);
  }

  /**
   * Manual content transformation fallback
   */
  private manualContentTransform(
    cmsContent: CMSContentInput, 
    config: PlatformConfig
  ): string {
    const baseContent = cmsContent.excerpt || cmsContent.content;
    const cleanContent = this.stripHtml(baseContent);
    
    let socialPost = '';

    switch (config.platform) {
      case 'twitter':
        socialPost = `${cmsContent.title}\n\n${this.truncateText(cleanContent, 200)}...`;
        break;
      
      case 'facebook':
        socialPost = `${cmsContent.title}\n\n${this.truncateText(cleanContent, 300)}\n\nRead more:`;
        break;
      
      case 'instagram':
        socialPost = `${cmsContent.title} ✨\n\n${this.truncateText(cleanContent, 400)}`;
        break;
      
      case 'linkedin':
        socialPost = `${cmsContent.title}\n\n${this.truncateText(cleanContent, 500)}\n\nThoughts? Share your experience in the comments.`;
        break;
    }

    return this.truncateText(socialPost, config.textLimit - 50);
  }

  /**
   * Optimize image for specific platform
   */
  private async optimizeImageForPlatform(
    image: { url: string; alt: string },
    config: PlatformConfig
  ) {
    // This would integrate with an image processing service
    // For now, return basic image info
    return [{
      url: image.url, // In production, this would be the optimized URL
      alt: image.alt,
      dimensions: `${config.imageSpecs.width}x${config.imageSpecs.height}`
    }];
  }

  /**
   * Get platform-specific configuration
   */
  private getPlatformConfig(platform: string): PlatformConfig {
    const configs: Record<string, PlatformConfig> = {
      facebook: {
        platform: 'facebook',
        textLimit: 2200,
        optimalLength: 80,
        imageSpecs: { width: 1200, height: 630, format: ['jpg', 'png'] },
        hashtagCount: 2,
        contentTone: 'engaging'
      },
      instagram: {
        platform: 'instagram',
        textLimit: 2200,
        optimalLength: 150,
        imageSpecs: { width: 1080, height: 1080, format: ['jpg', 'png'] },
        hashtagCount: 5,
        contentTone: 'casual'
      },
      twitter: {
        platform: 'twitter',
        textLimit: 280,
        optimalLength: 100,
        imageSpecs: { width: 1200, height: 675, format: ['jpg', 'png'] },
        hashtagCount: 2,
        contentTone: 'engaging'
      },
      linkedin: {
        platform: 'linkedin',
        textLimit: 3000,
        optimalLength: 200,
        imageSpecs: { width: 1200, height: 627, format: ['jpg', 'png'] },
        hashtagCount: 3,
        contentTone: 'professional'
      }
    };

    return configs[platform];
  }

  /**
   * Utility functions
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3).trim() + '...';
  }
}

interface PlatformConfig {
  platform: string;
  textLimit: number;
  optimalLength: number;
  imageSpecs: {
    width: number;
    height: number;
    format: string[];
  };
  hashtagCount: number;
  contentTone: 'casual' | 'professional' | 'engaging';
}