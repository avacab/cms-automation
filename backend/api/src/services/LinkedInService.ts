import axios, { AxiosInstance } from 'axios';
import { randomBytes } from 'crypto';

export interface LinkedInConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  personUrn?: string;
  organizationUrn?: string;
  apiVersion?: string;
}

export interface LinkedInPost {
  text: string;
  url?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
  scheduleTime?: number;
}

export interface LinkedInPostResponse {
  id: string;
  urn: string;
}

export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  profilePicture?: {
    displayImage: string;
  };
  vanityName?: string;
}

export interface LinkedInOrganization {
  id: string;
  name: string;
  vanityName?: string;
  logoV2?: {
    original: string;
  };
}

export interface LinkedInAuthUrl {
  authUrl: string;
  state: string;
}

export interface LinkedInServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export class LinkedInService {
  private client: AxiosInstance;
  private config: LinkedInConfig;
  private readonly baseUrl = 'https://api.linkedin.com';

  constructor(config: LinkedInConfig) {
    this.config = {
      apiVersion: 'v2',
      ...config
    };

    this.client = axios.create({
      baseURL: `${this.baseUrl}/${this.config.apiVersion}`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('LinkedIn API Error:', error.response?.data || error.message);
        throw this.formatError(error);
      }
    );
  }

  /**
   * Generate LinkedIn OAuth URL for user authorization
   */
  generateAuthUrl(redirectUri: string, scopes: string[] = ['w_member_social', 'r_liteprofile', 'r_organization_social', 'w_organization_social']): LinkedInAuthUrl {
    const state = randomBytes(16).toString('hex');
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      response_type: 'code',
      state: state
    });

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    
    return { authUrl, state };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<LinkedInServiceResult<{ access_token: string; expires_in: number }>> {
    try {
      const data = {
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: redirectUri,
        code: code
      };

      const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
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
   * Set access token for API requests
   */
  setAccessToken(accessToken: string): void {
    this.config.accessToken = accessToken;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  }

  /**
   * Get user profile information
   */
  async getUserProfile(): Promise<LinkedInServiceResult<LinkedInProfile>> {
    try {
      if (!this.config.accessToken) {
        throw new Error('Access token must be set to get user profile');
      }

      const response = await this.client.get('/people/~:(id,firstName,lastName,profilePicture(displayImage~:playableStreams),vanityName)');
      
      const profile = {
        id: response.data.id,
        firstName: response.data.firstName.localized.en_US,
        lastName: response.data.lastName.localized.en_US,
        profilePicture: response.data.profilePicture?.displayImage,
        vanityName: response.data.vanityName
      };

      // Store person URN for posting
      this.config.personUrn = `urn:li:person:${response.data.id}`;
      
      return {
        success: true,
        data: profile
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Get user's organizations (company pages they can post to)
   */
  async getUserOrganizations(): Promise<LinkedInServiceResult<LinkedInOrganization[]>> {
    try {
      if (!this.config.accessToken) {
        throw new Error('Access token must be set to get organizations');
      }

      const response = await this.client.get('/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~:(id,name,vanityName,logoV2)))');
      
      const organizations = response.data.elements.map((element: any) => ({
        id: element.organization.id,
        name: element.organization.name.localized.en_US,
        vanityName: element.organization.vanityName,
        logoV2: element.organization.logoV2
      }));
      
      return {
        success: true,
        data: organizations
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Set organization URN for posting to company page
   */
  setOrganizationUrn(organizationId: string): void {
    this.config.organizationUrn = `urn:li:organization:${organizationId}`;
  }

  /**
   * Post to LinkedIn (personal profile or organization)
   */
  async publishPost(postData: LinkedInPost, postAsOrganization: boolean = false): Promise<LinkedInServiceResult<LinkedInPostResponse>> {
    try {
      if (!this.config.accessToken) {
        throw new Error('Access token must be set before publishing');
      }

      const authorUrn = postAsOrganization 
        ? this.config.organizationUrn 
        : this.config.personUrn;

      if (!authorUrn) {
        throw new Error(`${postAsOrganization ? 'Organization' : 'Person'} URN must be set before publishing`);
      }

      // Build the post payload according to LinkedIn UGC API
      const payload: any = {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: postData.text
            },
            shareMediaCategory: postData.url || postData.imageUrl ? 'ARTICLE' : 'NONE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': postData.visibility || 'PUBLIC'
        }
      };

      // Add link/article content if URL is provided
      if (postData.url) {
        payload.specificContent['com.linkedin.ugc.ShareContent'].media = [{
          status: 'READY',
          description: {
            text: postData.description || ''
          },
          originalUrl: postData.url,
          title: {
            text: postData.title || ''
          }
        }];
      }

      // Add image content if image URL is provided (requires upload first)
      if (postData.imageUrl && !postData.url) {
        // For images, we would need to upload to LinkedIn's media upload API first
        // This is a simplified version - in production, implement media upload
        payload.specificContent['com.linkedin.ugc.ShareContent'].media = [{
          status: 'READY',
          description: {
            text: postData.description || ''
          },
          media: postData.imageUrl,
          title: {
            text: postData.title || ''
          }
        }];
      }

      const response = await this.client.post('/ugcPosts', payload);
      
      return {
        success: true,
        data: {
          id: response.data.id,
          urn: response.headers['x-linkedin-id'] || response.data.id
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
   * Upload media to LinkedIn (for images/videos)
   */
  async uploadMedia(mediaUrl: string, mediaType: 'image' | 'video' = 'image'): Promise<LinkedInServiceResult<{ uploadUrl: string; asset: string }>> {
    try {
      if (!this.config.accessToken) {
        throw new Error('Access token must be set to upload media');
      }

      const authorUrn = this.config.organizationUrn || this.config.personUrn;
      if (!authorUrn) {
        throw new Error('Author URN must be set for media upload');
      }

      // Register upload
      const registerPayload = {
        registerUploadRequest: {
          recipes: [mediaType === 'image' ? 'urn:li:digitalmediaRecipe:feedshare-image' : 'urn:li:digitalmediaRecipe:feedshare-video'],
          owner: authorUrn,
          serviceRelationships: [{
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent'
          }]
        }
      };

      const registerResponse = await this.client.post('/assets?action=registerUpload', registerPayload);
      const uploadUrl = registerResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const asset = registerResponse.data.value.asset;

      // Download media from URL and upload to LinkedIn
      const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
      
      await axios.put(uploadUrl, mediaResponse.data, {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });

      return {
        success: true,
        data: { uploadUrl, asset }
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Get post analytics/insights
   */
  async getPostAnalytics(postUrn: string): Promise<LinkedInServiceResult<any>> {
    try {
      if (!this.config.accessToken) {
        throw new Error('Access token must be set to get analytics');
      }

      // LinkedIn analytics endpoint (simplified - full implementation would require more specific metrics)
      const response = await this.client.get(`/socialActions/${encodeURIComponent(postUrn)}/likes`);
      
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
   * Get user's recent posts
   */
  async getUserPosts(count: number = 20, postAsOrganization: boolean = false): Promise<LinkedInServiceResult<any[]>> {
    try {
      if (!this.config.accessToken) {
        throw new Error('Access token must be set to get posts');
      }

      const authorUrn = postAsOrganization 
        ? this.config.organizationUrn 
        : this.config.personUrn;

      if (!authorUrn) {
        throw new Error('Author URN must be set to get posts');
      }

      const response = await this.client.get(`/ugcPosts?q=authors&authors=${encodeURIComponent(authorUrn)}&sortBy=CREATED&count=${count}`);
      
      return {
        success: true,
        data: response.data.elements || []
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Delete a LinkedIn post
   */
  async deletePost(postUrn: string): Promise<LinkedInServiceResult<{ success: boolean }>> {
    try {
      if (!this.config.accessToken) {
        throw new Error('Access token must be set to delete posts');
      }

      await this.client.delete(`/ugcPosts/${encodeURIComponent(postUrn)}`);
      
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
   * Test API connection and permissions
   */
  async testConnection(): Promise<LinkedInServiceResult<{ valid: boolean; profile?: LinkedInProfile; organizations?: LinkedInOrganization[] }>> {
    try {
      if (!this.config.accessToken) {
        throw new Error('Access token must be set to test connection');
      }

      const profileResult = await this.getUserProfile();
      if (!profileResult.success) {
        return {
          success: false,
          error: profileResult.error
        };
      }

      const organizationsResult = await this.getUserOrganizations();
      
      return {
        success: true,
        data: {
          valid: true,
          profile: profileResult.data,
          organizations: organizationsResult.success ? organizationsResult.data : []
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
    if (error.response?.data) {
      const linkedInError = error.response.data;
      
      // LinkedIn API error format
      if (linkedInError.errorCode || linkedInError.message) {
        return {
          code: linkedInError.errorCode?.toString() || 'LINKEDIN_API_ERROR',
          message: linkedInError.message || 'LinkedIn API error occurred',
          details: linkedInError
        };
      }

      // Generic API error
      if (linkedInError.error) {
        return {
          code: linkedInError.error,
          message: linkedInError.error_description || 'LinkedIn authentication error',
          details: linkedInError
        };
      }
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
        message: 'Request timeout - LinkedIn API took too long to respond'
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
    return !!(this.config.clientId && this.config.clientSecret);
  }

  /**
   * Check if service is ready for publishing
   */
  isReadyForPublishing(): boolean {
    return !!(this.config.clientId && this.config.clientSecret && this.config.accessToken);
  }

  /**
   * Get LinkedIn post character limit
   */
  getCharacterLimit(): number {
    return 3000; // LinkedIn allows up to 3000 characters in posts
  }

  /**
   * Validate post content against LinkedIn requirements
   */
  validatePost(postData: LinkedInPost): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!postData.text || postData.text.trim().length === 0) {
      errors.push('Post text is required');
    }

    if (postData.text && postData.text.length > this.getCharacterLimit()) {
      errors.push(`Post text exceeds ${this.getCharacterLimit()} character limit`);
    }

    if (postData.url && !this.isValidUrl(postData.url)) {
      errors.push('Invalid URL format');
    }

    if (postData.visibility && !['PUBLIC', 'CONNECTIONS'].includes(postData.visibility)) {
      errors.push('Invalid visibility setting');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Helper function to validate URLs
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}