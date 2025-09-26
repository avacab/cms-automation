import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

export interface FacebookConfig {
  appId: string;
  appSecret: string;
  accessToken?: string;
  pageId?: string;
  apiVersion?: string;
}

export interface FacebookPost {
  message?: string;
  link?: string;
  picture?: string;
  name?: string;
  caption?: string;
  description?: string;
  scheduled_publish_time?: number;
  published?: boolean;
}

export interface FacebookPostResponse {
  id: string;
  post_id?: string;
}

export interface FacebookPageInfo {
  id: string;
  name: string;
  access_token: string;
  category: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

export interface FacebookAuthUrl {
  authUrl: string;
  state: string;
}

export interface FacebookServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export class FacebookService {
  private client: AxiosInstance;
  private config: FacebookConfig;
  private readonly baseUrl = 'https://graph.facebook.com';

  constructor(config: FacebookConfig) {
    this.config = {
      apiVersion: 'v18.0',
      ...config
    };

    this.client = axios.create({
      baseURL: `${this.baseUrl}/${this.config.apiVersion}`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Facebook API Error:', error.response?.data || error.message);
        throw this.formatError(error);
      }
    );
  }

  /**
   * Generate Facebook OAuth URL for user authorization
   */
  generateAuthUrl(redirectUri: string, scopes: string[] = ['pages_manage_posts', 'pages_read_engagement']): FacebookAuthUrl {
    const state = crypto.randomBytes(16).toString('hex');
    
    const params = new URLSearchParams({
      client_id: this.config.appId,
      redirect_uri: redirectUri,
      scope: scopes.join(','),
      response_type: 'code',
      state: state
    });

    const authUrl = `https://www.facebook.com/v${this.config.apiVersion}/dialog/oauth?${params.toString()}`;
    
    return { authUrl, state };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<FacebookServiceResult<{ access_token: string; token_type: string; expires_in?: number }>> {
    try {
      const params = {
        client_id: this.config.appId,
        client_secret: this.config.appSecret,
        redirect_uri: redirectUri,
        code: code
      };

      const response = await axios.get(`${this.baseUrl}/oauth/access_token`, { params });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Get long-lived access token from short-lived token
   */
  async getLongLivedToken(shortLivedToken: string): Promise<FacebookServiceResult<{ access_token: string; token_type: string; expires_in: number }>> {
    try {
      const params = {
        grant_type: 'fb_exchange_token',
        client_id: this.config.appId,
        client_secret: this.config.appSecret,
        fb_exchange_token: shortLivedToken
      };

      const response = await axios.get(`${this.baseUrl}/oauth/access_token`, { params });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Get user's Facebook pages with manage_posts permission
   */
  async getUserPages(accessToken: string): Promise<FacebookServiceResult<FacebookPageInfo[]>> {
    try {
      const response = await axios.get(`${this.baseUrl}/${this.config.apiVersion}/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,access_token,category,picture'
        }
      });

      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Set page access token for publishing
   */
  setPageAccessToken(pageAccessToken: string, pageId: string): void {
    this.config.accessToken = pageAccessToken;
    this.config.pageId = pageId;
  }

  /**
   * Publish a post to Facebook page
   */
  async publishPost(postData: FacebookPost): Promise<FacebookServiceResult<FacebookPostResponse>> {
    try {
      if (!this.config.accessToken || !this.config.pageId) {
        throw new Error('Page access token and page ID must be set before publishing');
      }

      const endpoint = `/${this.config.pageId}/feed`;
      const data = {
        ...postData,
        access_token: this.config.accessToken
      };

      const response = await this.client.post(endpoint, data);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Schedule a post for later publishing
   */
  async schedulePost(postData: FacebookPost, publishTime: Date): Promise<FacebookServiceResult<FacebookPostResponse>> {
    const scheduledPost = {
      ...postData,
      scheduled_publish_time: Math.floor(publishTime.getTime() / 1000),
      published: false
    };

    return this.publishPost(scheduledPost);
  }

  /**
   * Upload media (photo/video) to Facebook
   */
  async uploadMedia(mediaUrl: string, type: 'photo' | 'video' = 'photo'): Promise<FacebookServiceResult<{ id: string }>> {
    try {
      if (!this.config.accessToken || !this.config.pageId) {
        throw new Error('Page access token and page ID must be set before uploading media');
      }

      const endpoint = `/${this.config.pageId}/${type}s`;
      const data = {
        url: mediaUrl,
        published: false,
        access_token: this.config.accessToken
      };

      const response = await this.client.post(endpoint, data);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Get post insights and engagement data
   */
  async getPostInsights(postId: string): Promise<FacebookServiceResult<any>> {
    try {
      if (!this.config.accessToken) {
        throw new Error('Access token must be set to get post insights');
      }

      const response = await this.client.get(`/${postId}/insights`, {
        params: {
          access_token: this.config.accessToken,
          metric: 'post_impressions,post_engaged_users,post_reactions_total'
        }
      });
      
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Get published posts from a page
   */
  async getPagePosts(limit: number = 25): Promise<FacebookServiceResult<any[]>> {
    try {
      if (!this.config.accessToken || !this.config.pageId) {
        throw new Error('Page access token and page ID must be set to get posts');
      }

      const response = await this.client.get(`/${this.config.pageId}/posts`, {
        params: {
          access_token: this.config.accessToken,
          limit: limit,
          fields: 'id,message,created_time,permalink_url,engagement'
        }
      });
      
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Delete a Facebook post
   */
  async deletePost(postId: string): Promise<FacebookServiceResult<{ success: boolean }>> {
    try {
      if (!this.config.accessToken) {
        throw new Error('Access token must be set to delete posts');
      }

      await this.client.delete(`/${postId}`, {
        params: {
          access_token: this.config.accessToken
        }
      });
      
      return {
        success: true,
        data: { success: true }
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Verify webhook signature from Facebook
   */
  static verifyWebhookSignature(payload: string, signature: string, appSecret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('hex');
    
    const receivedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  }

  /**
   * Test API connection and permissions
   */
  async testConnection(): Promise<FacebookServiceResult<{ valid: boolean; permissions: string[] }>> {
    try {
      if (!this.config.accessToken) {
        throw new Error('Access token must be set to test connection');
      }

      const response = await this.client.get('/me/permissions', {
        params: {
          access_token: this.config.accessToken
        }
      });

      const permissions = response.data.data
        .filter((perm: any) => perm.status === 'granted')
        .map((perm: any) => perm.permission);
      
      return {
        success: true,
        data: {
          valid: true,
          permissions
        }
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Format error response
   */
  private formatError(error: any): { code: string; message: string; details?: any } {
    if (error.response?.data?.error) {
      const fbError = error.response.data.error;
      return {
        code: fbError.code?.toString() || 'FACEBOOK_API_ERROR',
        message: fbError.message || 'Facebook API error occurred',
        details: fbError
      };
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return {
        code: 'NETWORK_ERROR',
        message: 'Network connection failed'
      };
    }

    if (error.code === 'ECONNABORTED') {
      return {
        code: 'TIMEOUT_ERROR',
        message: 'Request timeout - Facebook API took too long to respond'
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      details: error
    };
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.config.appId && this.config.appSecret);
  }

  /**
   * Check if service is ready for publishing
   */
  isReadyForPublishing(): boolean {
    return !!(this.config.appId && this.config.appSecret && this.config.accessToken && this.config.pageId);
  }
}