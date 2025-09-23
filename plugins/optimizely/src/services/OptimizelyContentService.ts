import { EventEmitter } from 'events';
import { OptimizelyAuthService } from './OptimizelyAuthService.js';
import axios, { AxiosInstance } from 'axios';

interface ContentType {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  properties: ContentProperty[];
}

interface ContentProperty {
  name: string;
  type: string;
  displayName: string;
  required?: boolean;
  defaultValue?: any;
  settings?: Record<string, any>;
}

interface ContentItem {
  contentLink: {
    id: number;
    workId: number;
    guidValue: string;
  };
  name: string;
  language: {
    displayName: string;
    name: string;
  };
  existingLanguages: Array<{
    displayName: string;
    name: string;
  }>;
  masterLanguage: {
    displayName: string;
    name: string;
  };
  contentType: string[];
  parentLink: {
    id: number;
    workId: number;
    guidValue: string;
  };
  routeSegment?: string;
  url?: string;
  changed: string;
  created: string;
  startPublish?: string;
  stopPublish?: string;
  saved: string;
  status: string;
  [key: string]: any; // Dynamic properties based on content type
}

interface CreateContentRequest {
  name: string;
  contentType: string;
  parentId?: number;
  language?: string;
  properties: Record<string, any>;
  publishImmediately?: boolean;
}

interface UpdateContentRequest {
  contentId: number;
  properties: Record<string, any>;
  publishImmediately?: boolean;
}

interface ContentSearchOptions {
  query?: string;
  contentTypes?: string[];
  language?: string;
  status?: 'published' | 'draft' | 'all';
  pageSize?: number;
  pageIndex?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

interface ContentOperationResult {
  success: boolean;
  contentId?: number;
  contentLink?: any;
  url?: string;
  error?: string;
  warnings?: string[];
}

export class OptimizelyContentService extends EventEmitter {
  private authService: OptimizelyAuthService;
  private httpClient: AxiosInstance;
  private cmsEndpoint: string;

  constructor(authService: OptimizelyAuthService, cmsEndpoint: string) {
    super();
    this.authService = authService;
    this.cmsEndpoint = cmsEndpoint;
    
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CMS-Automation-Optimizely/1.0.0'
      }
    });

    this.setupRequestInterceptors();
  }

  /**
   * Get available content types
   */
  async getContentTypes(): Promise<{ success: boolean; contentTypes?: ContentType[]; error?: string }> {
    try {
      const headers = await this.authService.getAuthHeaders();
      
      const response = await this.httpClient.get(
        `${this.cmsEndpoint}/api/episerver/v3.0/contenttypes`,
        { headers }
      );

      const contentTypes: ContentType[] = response.data.map((ct: any) => ({
        id: ct.name,
        name: ct.name,
        displayName: ct.displayName || ct.name,
        description: ct.description,
        properties: ct.properties?.map((prop: any) => ({
          name: prop.name,
          type: prop.dataType,
          displayName: prop.displayName || prop.name,
          required: prop.required || false,
          defaultValue: prop.defaultValue,
          settings: prop.settings
        })) || []
      }));

      return { success: true, contentTypes };

    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.emit('content_types_error', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Create new content item
   */
  async createContent(request: CreateContentRequest): Promise<ContentOperationResult> {
    try {
      this.emit('content_creation_started', { name: request.name, type: request.contentType });

      const headers = await this.authService.getAuthHeaders();
      
      // Prepare content data according to Optimizely CMS API format
      const contentData = {
        name: request.name,
        contentType: [request.contentType],
        language: {
          name: request.language || 'en'
        },
        parentLink: request.parentId ? {
          id: request.parentId
        } : undefined,
        ...request.properties
      };

      const response = await this.httpClient.post(
        `${this.cmsEndpoint}/api/episerver/v3.0/content`,
        contentData,
        { headers }
      );

      const createdContent: ContentItem = response.data;

      // Publish immediately if requested
      if (request.publishImmediately) {
        await this.publishContent(createdContent.contentLink.id);
      }

      this.emit('content_created', {
        contentId: createdContent.contentLink.id,
        name: createdContent.name,
        type: request.contentType,
        url: createdContent.url
      });

      return {
        success: true,
        contentId: createdContent.contentLink.id,
        contentLink: createdContent.contentLink,
        url: createdContent.url
      };

    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.emit('content_creation_error', { 
        error: errorMessage, 
        name: request.name, 
        type: request.contentType 
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update existing content item
   */
  async updateContent(request: UpdateContentRequest): Promise<ContentOperationResult> {
    try {
      this.emit('content_update_started', { contentId: request.contentId });

      const headers = await this.authService.getAuthHeaders();
      
      const response = await this.httpClient.put(
        `${this.cmsEndpoint}/api/episerver/v3.0/content/${request.contentId}`,
        request.properties,
        { headers }
      );

      const updatedContent: ContentItem = response.data;

      // Publish immediately if requested
      if (request.publishImmediately) {
        await this.publishContent(request.contentId);
      }

      this.emit('content_updated', {
        contentId: updatedContent.contentLink.id,
        name: updatedContent.name,
        url: updatedContent.url
      });

      return {
        success: true,
        contentId: updatedContent.contentLink.id,
        contentLink: updatedContent.contentLink,
        url: updatedContent.url
      };

    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.emit('content_update_error', { error: errorMessage, contentId: request.contentId });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get content item by ID
   */
  async getContent(contentId: number, language?: string): Promise<{ success: boolean; content?: ContentItem; error?: string }> {
    try {
      const headers = await this.authService.getAuthHeaders();
      
      const params = language ? { language } : {};
      
      const response = await this.httpClient.get(
        `${this.cmsEndpoint}/api/episerver/v3.0/content/${contentId}`,
        { headers, params }
      );

      return { success: true, content: response.data };

    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Search for content
   */
  async searchContent(options: ContentSearchOptions = {}): Promise<{ success: boolean; results?: ContentItem[]; total?: number; error?: string }> {
    try {
      const headers = await this.authService.getAuthHeaders();
      
      const params: any = {
        query: options.query || '',
        pageSize: options.pageSize || 20,
        pageIndex: options.pageIndex || 0
      };

      if (options.contentTypes?.length) {
        params.contentTypes = options.contentTypes.join(',');
      }

      if (options.language) {
        params.language = options.language;
      }

      if (options.status && options.status !== 'all') {
        params.status = options.status;
      }

      if (options.orderBy) {
        params.orderBy = options.orderBy;
        params.orderDirection = options.orderDirection || 'asc';
      }

      const response = await this.httpClient.get(
        `${this.cmsEndpoint}/api/episerver/v3.0/search/content`,
        { headers, params }
      );

      return {
        success: true,
        results: response.data.results || [],
        total: response.data.totalMatching || 0
      };

    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Publish content item
   */
  async publishContent(contentId: number): Promise<ContentOperationResult> {
    try {
      const headers = await this.authService.getAuthHeaders();
      
      const response = await this.httpClient.post(
        `${this.cmsEndpoint}/api/episerver/v3.0/content/${contentId}/publish`,
        {},
        { headers }
      );

      this.emit('content_published', { contentId });

      return {
        success: true,
        contentId: contentId,
        url: response.data.url
      };

    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.emit('content_publish_error', { error: errorMessage, contentId });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Unpublish content item
   */
  async unpublishContent(contentId: number): Promise<ContentOperationResult> {
    try {
      const headers = await this.authService.getAuthHeaders();
      
      await this.httpClient.delete(
        `${this.cmsEndpoint}/api/episerver/v3.0/content/${contentId}/publish`,
        { headers }
      );

      this.emit('content_unpublished', { contentId });

      return { success: true, contentId };

    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.emit('content_unpublish_error', { error: errorMessage, contentId });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Delete content item
   */
  async deleteContent(contentId: number, force: boolean = false): Promise<ContentOperationResult> {
    try {
      const headers = await this.authService.getAuthHeaders();
      
      const params = force ? { force: 'true' } : {};
      
      await this.httpClient.delete(
        `${this.cmsEndpoint}/api/episerver/v3.0/content/${contentId}`,
        { headers, params }
      );

      this.emit('content_deleted', { contentId, force });

      return { success: true, contentId };

    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.emit('content_delete_error', { error: errorMessage, contentId });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get content ancestors (breadcrumb path)
   */
  async getContentAncestors(contentId: number): Promise<{ success: boolean; ancestors?: ContentItem[]; error?: string }> {
    try {
      const headers = await this.authService.getAuthHeaders();
      
      const response = await this.httpClient.get(
        `${this.cmsEndpoint}/api/episerver/v3.0/content/${contentId}/ancestors`,
        { headers }
      );

      return { success: true, ancestors: response.data };

    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get content children
   */
  async getContentChildren(
    parentId: number,
    options: { language?: string; contentTypes?: string[]; pageSize?: number } = {}
  ): Promise<{ success: boolean; children?: ContentItem[]; error?: string }> {
    try {
      const headers = await this.authService.getAuthHeaders();
      
      const params: any = {
        pageSize: options.pageSize || 50
      };

      if (options.language) {
        params.language = options.language;
      }

      if (options.contentTypes?.length) {
        params.contentTypes = options.contentTypes.join(',');
      }

      const response = await this.httpClient.get(
        `${this.cmsEndpoint}/api/episerver/v3.0/content/${parentId}/children`,
        { headers, params }
      );

      return { success: true, children: response.data };

    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Copy content item
   */
  async copyContent(
    sourceId: number,
    targetParentId: number,
    newName?: string
  ): Promise<ContentOperationResult> {
    try {
      const headers = await this.authService.getAuthHeaders();
      
      const copyData = {
        targetParentId: targetParentId,
        name: newName
      };

      const response = await this.httpClient.post(
        `${this.cmsEndpoint}/api/episerver/v3.0/content/${sourceId}/copy`,
        copyData,
        { headers }
      );

      const copiedContent: ContentItem = response.data;

      this.emit('content_copied', {
        sourceId,
        copiedId: copiedContent.contentLink.id,
        name: copiedContent.name
      });

      return {
        success: true,
        contentId: copiedContent.contentLink.id,
        contentLink: copiedContent.contentLink,
        url: copiedContent.url
      };

    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.emit('content_copy_error', { error: errorMessage, sourceId });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Move content item
   */
  async moveContent(contentId: number, newParentId: number): Promise<ContentOperationResult> {
    try {
      const headers = await this.authService.getAuthHeaders();
      
      const moveData = {
        newParentId: newParentId
      };

      const response = await this.httpClient.put(
        `${this.cmsEndpoint}/api/episerver/v3.0/content/${contentId}/move`,
        moveData,
        { headers }
      );

      this.emit('content_moved', { contentId, newParentId });

      return {
        success: true,
        contentId: contentId,
        url: response.data.url
      };

    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.emit('content_move_error', { error: errorMessage, contentId });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Create language variant of content
   */
  async createLanguageVariant(
    contentId: number,
    targetLanguage: string,
    properties?: Record<string, any>
  ): Promise<ContentOperationResult> {
    try {
      const headers = await this.authService.getAuthHeaders();
      
      const variantData = {
        language: {
          name: targetLanguage
        },
        ...properties
      };

      const response = await this.httpClient.post(
        `${this.cmsEndpoint}/api/episerver/v3.0/content/${contentId}/language/${targetLanguage}`,
        variantData,
        { headers }
      );

      this.emit('language_variant_created', { contentId, language: targetLanguage });

      return {
        success: true,
        contentId: contentId,
        url: response.data.url
      };

    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.emit('language_variant_error', { error: errorMessage, contentId, language: targetLanguage });
      return { success: false, error: errorMessage };
    }
  }

  // Private helper methods

  private setupRequestInterceptors(): void {
    this.httpClient.interceptors.request.use(
      async (config) => {
        // Add authentication headers
        try {
          const authHeaders = await this.authService.getAuthHeaders();
          config.headers = { ...config.headers, ...authHeaders };
        } catch (error) {
          // If auth fails, the request will be rejected
          return Promise.reject(new Error('Authentication failed'));
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        this.emit('api_error', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: this.extractErrorMessage(error)
        });
        return Promise.reject(error);
      }
    );
  }

  private extractErrorMessage(error: any): string {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.response?.data?.error_description) {
      return error.response.data.error_description;
    }
    if (error.response?.data?.errors) {
      return Object.values(error.response.data.errors).flat().join(', ');
    }
    if (error.response?.statusText) {
      return `${error.response.status}: ${error.response.statusText}`;
    }
    return error.message || 'Unknown error';
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ success: boolean; status?: any; error?: string }> {
    try {
      const headers = await this.authService.getAuthHeaders();
      
      const response = await this.httpClient.get(
        `${this.cmsEndpoint}/api/episerver/v3.0/site`,
        { headers }
      );

      return {
        success: true,
        status: {
          connected: true,
          site: response.data.name,
          version: response.data.version,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      return { success: false, error: errorMessage };
    }
  }
}