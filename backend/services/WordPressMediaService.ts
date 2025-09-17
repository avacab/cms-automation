import { WordPressAuthService } from './WordPressAuthService.js';
import { EventEmitter } from 'events';
import FormData from 'form-data';
import fetch from 'node-fetch';

interface MediaUploadResult {
  success: boolean;
  mediaId?: number;
  url?: string;
  error?: string;
  metadata?: {
    width?: number;
    height?: number;
    fileSize?: number;
    mimeType?: string;
  };
}

interface MediaItem {
  id: number;
  url: string;
  title: string;
  caption: string;
  altText: string;
  mimeType: string;
  width?: number;
  height?: number;
  fileSize?: number;
  uploadDate: string;
}

interface ImageGenerationRequest {
  prompt: string;
  style?: 'realistic' | 'artistic' | 'illustration' | 'photo';
  size?: '256x256' | '512x512' | '1024x1024';
  quality?: 'standard' | 'hd';
}

export class WordPressMediaService extends EventEmitter {
  private authService: WordPressAuthService;
  private openaiApiKey?: string;

  constructor(authService: WordPressAuthService, openaiApiKey?: string) {
    super();
    this.authService = authService;
    this.openaiApiKey = openaiApiKey;
  }

  /**
   * Upload media file to WordPress
   */
  async uploadMedia(
    siteUrl: string,
    file: Buffer,
    filename: string,
    mimeType: string,
    altText?: string,
    caption?: string
  ): Promise<MediaUploadResult> {
    try {
      if (!this.authService.isAuthenticated(siteUrl)) {
        return { success: false, error: 'Site not authenticated' };
      }

      const headers = this.authService.getAuthHeaders(siteUrl);
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file, {
        filename,
        contentType: mimeType
      });
      
      if (altText) {
        formData.append('alt_text', altText);
      }
      
      if (caption) {
        formData.append('caption', caption);
      }

      const response = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
        method: 'POST',
        headers: {
          ...headers,
          ...formData.getHeaders()
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: `Media upload failed: ${errorData.message || response.statusText}`
        };
      }

      const mediaData = await response.json();
      
      this.emit('media_uploaded', {
        siteUrl,
        mediaId: mediaData.id,
        url: mediaData.source_url,
        filename
      });

      return {
        success: true,
        mediaId: mediaData.id,
        url: mediaData.source_url,
        metadata: {
          width: mediaData.media_details?.width,
          height: mediaData.media_details?.height,
          fileSize: mediaData.media_details?.filesize,
          mimeType: mediaData.mime_type
        }
      };

    } catch (error) {
      this.emit('media_upload_error', { siteUrl, error: error.message, filename });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate image using AI and upload to WordPress
   */
  async generateAndUploadImage(
    siteUrl: string,
    request: ImageGenerationRequest,
    altText?: string
  ): Promise<MediaUploadResult> {
    try {
      if (!this.openaiApiKey) {
        return { success: false, error: 'OpenAI API key not configured' };
      }

      // Generate image using DALL-E
      const imageBuffer = await this.generateImage(request);
      
      if (!imageBuffer) {
        return { success: false, error: 'Failed to generate image' };
      }

      // Upload generated image
      const filename = `ai-generated-${Date.now()}.png`;
      const result = await this.uploadMedia(
        siteUrl,
        imageBuffer,
        filename,
        'image/png',
        altText || request.prompt,
        `AI generated image: ${request.prompt}`
      );

      if (result.success) {
        this.emit('ai_image_created', {
          siteUrl,
          prompt: request.prompt,
          mediaId: result.mediaId,
          url: result.url
        });
      }

      return result;

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get media library from WordPress
   */
  async getMediaLibrary(
    siteUrl: string,
    options: {
      page?: number;
      perPage?: number;
      mediaType?: 'image' | 'video' | 'audio' | 'document';
      search?: string;
    } = {}
  ): Promise<{ success: boolean; media?: MediaItem[]; total?: number; error?: string }> {
    try {
      const headers = this.authService.getAuthHeaders(siteUrl);
      
      const params = new URLSearchParams({
        page: (options.page || 1).toString(),
        per_page: (options.perPage || 20).toString()
      });

      if (options.mediaType) {
        params.append('media_type', options.mediaType);
      }

      if (options.search) {
        params.append('search', options.search);
      }

      const response = await fetch(`${siteUrl}/wp-json/wp/v2/media?${params}`, {
        headers
      });

      if (!response.ok) {
        return { success: false, error: 'Failed to fetch media library' };
      }

      const mediaData = await response.json();
      const total = parseInt(response.headers.get('x-wp-total') || '0');

      const media: MediaItem[] = mediaData.map((item: any) => ({
        id: item.id,
        url: item.source_url,
        title: item.title.rendered,
        caption: item.caption.rendered,
        altText: item.alt_text,
        mimeType: item.mime_type,
        width: item.media_details?.width,
        height: item.media_details?.height,
        fileSize: item.media_details?.filesize,
        uploadDate: item.date
      }));

      return { success: true, media, total };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update media item metadata
   */
  async updateMediaMetadata(
    siteUrl: string,
    mediaId: number,
    updates: {
      title?: string;
      caption?: string;
      altText?: string;
      description?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = this.authService.getAuthHeaders(siteUrl);
      
      const updateData: any = {};
      
      if (updates.title) {
        updateData.title = updates.title;
      }
      
      if (updates.caption) {
        updateData.caption = updates.caption;
      }
      
      if (updates.altText) {
        updateData.alt_text = updates.altText;
      }
      
      if (updates.description) {
        updateData.description = updates.description;
      }

      const response = await fetch(`${siteUrl}/wp-json/wp/v2/media/${mediaId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.message || response.statusText };
      }

      this.emit('media_updated', { siteUrl, mediaId, updates });
      
      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete media item from WordPress
   */
  async deleteMedia(
    siteUrl: string,
    mediaId: number,
    force: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = this.authService.getAuthHeaders(siteUrl);
      
      const params = force ? '?force=true' : '';
      const response = await fetch(`${siteUrl}/wp-json/wp/v2/media/${mediaId}${params}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.message || response.statusText };
      }

      this.emit('media_deleted', { siteUrl, mediaId });
      
      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Suggest relevant images based on content
   */
  async suggestImagesForContent(
    content: string,
    maxSuggestions: number = 5
  ): Promise<string[]> {
    try {
      // Extract key topics and themes from content
      const topics = this.extractImageTopics(content);
      
      // Generate image prompts based on content
      const prompts = topics.slice(0, maxSuggestions).map(topic => 
        `Professional illustration of ${topic}, clean design, suitable for blog post`
      );

      return prompts;

    } catch (error) {
      console.error('Error suggesting images:', error);
      return [];
    }
  }

  /**
   * Optimize image for web (resize, compress)
   */
  async optimizeImage(
    imageBuffer: Buffer,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    } = {}
  ): Promise<Buffer> {
    // In a real implementation, this would use image processing libraries like Sharp
    // For now, return the original buffer
    // TODO: Implement image optimization using Sharp or similar library
    return imageBuffer;
  }

  // Private methods

  private async generateImage(request: ImageGenerationRequest): Promise<Buffer | null> {
    try {
      if (!this.openaiApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: request.prompt,
          size: request.size || '1024x1024',
          quality: request.quality || 'standard',
          n: 1
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Image generation failed: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const imageUrl = data.data[0]?.url;

      if (!imageUrl) {
        throw new Error('No image URL returned from API');
      }

      // Download the generated image
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error('Failed to download generated image');
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);

    } catch (error) {
      console.error('Error generating image:', error);
      this.emit('image_generation_error', { error: error.message, request });
      return null;
    }
  }

  private extractImageTopics(content: string): string[] {
    // Simple topic extraction for image suggestions
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const topics: string[] = [];

    sentences.forEach(sentence => {
      // Look for nouns and concepts that might make good images
      const words = sentence.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3);

      // Simple heuristic to find potential image subjects
      const imageWords = words.filter(word => 
        !this.isCommonWord(word) && 
        (this.isNoun(word) || this.isConcept(word))
      );

      topics.push(...imageWords);
    });

    // Remove duplicates and return top topics
    const uniqueTopics = [...new Set(topics)];
    return uniqueTopics.slice(0, 10);
  }

  private isCommonWord(word: string): boolean {
    const commonWords = [
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 
      'after', 'above', 'below', 'between', 'among', 'this', 'that', 'these', 
      'those', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 
      'can', 'have', 'has', 'had', 'do', 'does', 'did', 'get', 'got', 'make', 
      'made', 'take', 'took', 'come', 'came', 'go', 'went', 'see', 'saw', 
      'know', 'knew', 'think', 'thought', 'say', 'said', 'tell', 'told'
    ];
    return commonWords.includes(word);
  }

  private isNoun(word: string): boolean {
    // Simple heuristic for nouns (words that might represent visual concepts)
    const nounEndings = ['tion', 'sion', 'ness', 'ment', 'ity', 'ty', 'er', 'or', 'ist'];
    return nounEndings.some(ending => word.endsWith(ending)) || word.length >= 5;
  }

  private isConcept(word: string): boolean {
    // Words that might represent concepts suitable for illustration
    const concepts = [
      'business', 'technology', 'innovation', 'growth', 'success', 'strategy', 
      'leadership', 'teamwork', 'collaboration', 'communication', 'planning', 
      'development', 'design', 'creativity', 'solution', 'process', 'system',
      'network', 'connection', 'integration', 'automation', 'efficiency'
    ];
    return concepts.includes(word);
  }
}