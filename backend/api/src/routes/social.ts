import express from 'express';
import { SocialMediaService } from '../services/SocialMediaService.js';
import { socialSchedulingService } from '../services/SocialSchedulingService.js';

const router = express.Router();
const socialMediaService = new SocialMediaService();

/**
 * Transform CMS content to social media posts
 * POST /api/v1/social/transform
 */
router.post('/transform', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    // Validate required content fields
    if (!content.title || !content.content) {
      return res.status(400).json({
        success: false,
        error: 'Content must have title and content fields'
      });
    }

    // Transform content for all social platforms
    const socialPosts = await socialMediaService.transformToSocialPosts(content);

    res.json({
      success: true,
      data: {
        original_content: content,
        social_posts: socialPosts,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Social media transformation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to transform content for social media'
    });
  }
});

/**
 * Transform content for a specific platform
 * POST /api/v1/social/transform/:platform
 */
router.post('/transform/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const { content } = req.body;

    const validPlatforms = ['facebook', 'instagram', 'twitter', 'linkedin'];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: `Invalid platform. Supported platforms: ${validPlatforms.join(', ')}`
      });
    }

    if (!content || !content.title || !content.content) {
      return res.status(400).json({
        success: false,
        error: 'Content with title and content fields is required'
      });
    }

    // Transform for specific platform
    const socialPosts = await socialMediaService.transformToSocialPosts(content);
    const platformPost = socialPosts.find(post => post.platform === platform);

    if (!platformPost) {
      return res.status(500).json({
        success: false,
        error: `Failed to generate content for ${platform}`
      });
    }

    res.json({
      success: true,
      data: {
        platform,
        post: platformPost,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`Social media transformation error for ${req.params.platform}:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to transform content for ${req.params.platform}`
    });
  }
});

/**
 * Get social media platform specifications
 * GET /api/v1/social/platforms
 */
router.get('/platforms', (req, res) => {
  const platformSpecs = {
    facebook: {
      name: 'Facebook',
      textLimit: 2200,
      optimalLength: '40-80 characters',
      imageSpecs: {
        recommended: '1200x630px',
        formats: ['JPG', 'PNG'],
        aspectRatio: '1.91:1'
      },
      hashtagStrategy: 'Use 1-2 relevant hashtags',
      bestPostTimes: ['1-3 PM', '8-9 PM'],
      contentTips: [
        'Use engaging questions',
        'Include visual content',
        'Keep text concise',
        'Add clear call-to-action'
      ]
    },
    instagram: {
      name: 'Instagram',
      textLimit: 2200,
      optimalLength: '138-150 characters',
      imageSpecs: {
        feed: '1080x1080px (square) or 1080x1350px (portrait)',
        stories: '1080x1920px',
        reels: '1080x1920px',
        formats: ['JPG', 'PNG', 'MP4']
      },
      hashtagStrategy: 'Use 3-5 relevant hashtags (max 30)',
      bestPostTimes: ['11 AM-1 PM', '7-9 PM'],
      contentTips: [
        'High-quality visual content is essential',
        'Use relevant hashtags',
        'Include location tags when relevant',
        'Post consistently'
      ]
    },
    twitter: {
      name: 'Twitter/X',
      textLimit: 280,
      optimalLength: '71-100 characters',
      imageSpecs: {
        recommended: '1200x675px (16:9) or 1200x1200px (1:1)',
        formats: ['JPG', 'PNG', 'GIF', 'MP4'],
        aspectRatio: '16:9 or 1:1'
      },
      hashtagStrategy: 'Use 1-2 hashtags maximum',
      bestPostTimes: ['8-10 AM', '7-9 PM'],
      contentTips: [
        'Be concise and direct',
        'Use threads for longer content',
        'Engage with trending topics',
        'Include relevant mentions'
      ]
    },
    linkedin: {
      name: 'LinkedIn',
      textLimit: 3000,
      optimalLength: '150-300 characters',
      imageSpecs: {
        recommended: '1200x627px',
        formats: ['JPG', 'PNG'],
        aspectRatio: '1.91:1'
      },
      hashtagStrategy: 'Use 3-5 professional hashtags',
      bestPostTimes: ['8-10 AM', '12-2 PM', '5-6 PM'],
      contentTips: [
        'Professional tone and content',
        'Share industry insights',
        'Use native video when possible',
        'Encourage discussion in comments'
      ]
    }
  };

  res.json({
    success: true,
    data: {
      platforms: platformSpecs,
      supported_platforms: Object.keys(platformSpecs),
      last_updated: '2024-09-25'
    }
  });
});

/**
 * Preview social media post formatting
 * POST /api/v1/social/preview
 */
router.post('/preview', async (req, res) => {
  try {
    const { content, platforms } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    const targetPlatforms = platforms || ['facebook', 'instagram', 'twitter', 'linkedin'];
    const socialPosts = await socialMediaService.transformToSocialPosts(content);
    
    // Filter to requested platforms
    const filteredPosts = socialPosts.filter(post => 
      targetPlatforms.includes(post.platform)
    );

    // Add preview formatting
    const previews = filteredPosts.map(post => ({
      ...post,
      preview: {
        character_count: post.content.length,
        hashtag_count: post.hashtags.length,
        estimated_engagement: getEstimatedEngagement(post.platform, post.content),
        suggestions: getContentSuggestions(post.platform, post.content)
      }
    }));

    res.json({
      success: true,
      data: {
        previews,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Social media preview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate social media preview'
    });
  }
});

/**
 * Helper functions for preview functionality
 */
function getEstimatedEngagement(platform: string, content: string): string {
  // Simple engagement estimation based on content characteristics
  const hasQuestion = content.includes('?');
  const hasCallToAction = /\b(check out|read more|learn more|click|visit|share)\b/i.test(content);
  const hasEmoji = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(content);

  let score = 'Medium';
  let factors = 0;

  if (hasQuestion) factors++;
  if (hasCallToAction) factors++;
  if (hasEmoji) factors++;

  if (factors >= 2) score = 'High';
  else if (factors === 0) score = 'Low';

  return score;
}

function getContentSuggestions(platform: string, content: string): string[] {
  const suggestions: string[] = [];

  // Generic suggestions
  if (!content.includes('?') && platform !== 'linkedin') {
    suggestions.push('Consider adding a question to increase engagement');
  }

  if (!/\b(check out|read more|learn more|click|visit|share)\b/i.test(content)) {
    suggestions.push('Add a clear call-to-action');
  }

  // Platform-specific suggestions
  switch (platform) {
    case 'instagram':
      if (!/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(content)) {
        suggestions.push('Consider adding relevant emojis for Instagram');
      }
      break;
    
    case 'twitter':
      if (content.length > 200) {
        suggestions.push('Consider breaking into a thread for better engagement');
      }
      break;
    
    case 'linkedin':
      if (content.length < 100) {
        suggestions.push('LinkedIn posts often perform better with more detailed content');
      }
      break;
  }

  return suggestions;
}

/**
 * Schedule social media posts
 * POST /api/v1/social/schedule
 */
router.post('/schedule', async (req, res) => {
  try {
    const { content, scheduling_rules } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    // Transform content to social posts
    const socialPosts = await socialMediaService.transformToSocialPosts(content);

    // Schedule the posts
    const scheduledPosts = await socialSchedulingService.schedulePosts(socialPosts, scheduling_rules);

    res.json({
      success: true,
      data: {
        scheduled_posts: scheduledPosts,
        total_scheduled: scheduledPosts.length,
        scheduled_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Social media scheduling error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule social media posts'
    });
  }
});

/**
 * Get scheduled posts
 * GET /api/v1/social/scheduled
 */
router.get('/scheduled', (req, res) => {
  try {
    const { platform, status, start_date, end_date } = req.query;

    const filters: any = {};
    if (platform) filters.platform = platform;
    if (status) filters.status = status;
    if (start_date && end_date) {
      filters.date_range = {
        start: new Date(start_date as string),
        end: new Date(end_date as string)
      };
    }

    const scheduledPosts = socialSchedulingService.getScheduledPosts(filters);

    res.json({
      success: true,
      data: {
        scheduled_posts: scheduledPosts,
        total_count: scheduledPosts.length,
        filters_applied: filters
      }
    });

  } catch (error) {
    console.error('Error fetching scheduled posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduled posts'
    });
  }
});

/**
 * Cancel a scheduled post
 * DELETE /api/v1/social/scheduled/:postId
 */
router.delete('/scheduled/:postId', (req, res) => {
  try {
    const { postId } = req.params;
    const cancelled = socialSchedulingService.cancelScheduledPost(postId);

    if (cancelled) {
      res.json({
        success: true,
        message: 'Scheduled post cancelled successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Scheduled post not found or cannot be cancelled'
      });
    }

  } catch (error) {
    console.error('Error cancelling scheduled post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel scheduled post'
    });
  }
});

/**
 * Get social media analytics
 * GET /api/v1/social/analytics
 */
router.get('/analytics', (req, res) => {
  try {
    const { platform } = req.query;
    const analytics = socialSchedulingService.getAnalytics(platform as string);

    res.json({
      success: true,
      data: {
        platform: platform || 'all',
        analytics,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching social media analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

export default router;