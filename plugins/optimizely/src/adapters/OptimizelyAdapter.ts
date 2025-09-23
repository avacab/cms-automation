import { EventEmitter } from 'events';
import { OptimizelyAuthService } from '../services/OptimizelyAuthService.js';
import { OptimizelyContentService } from '../services/OptimizelyContentService.js';

interface OptimizelyConfig {
  clientId: string;
  clientSecret: string;
  apiEndpoint: string;
  cmsEndpoint: string;
  timeout?: number;
  retries?: number;
  syncDirection?: 'cms_to_optimizely' | 'optimizely_to_cms' | 'bidirectional';
  syncBatch?: number;
  enableExperiments?: boolean;
  enablePersonalization?: boolean;
}

interface SyncQueueItem {
  operation: 'create' | 'update' | 'delete' | 'publish' | 'experiment';
  data: any;
  timestamp: number;
  retries: number;
  priority?: number;
}

interface ContentSyncResult {
  success: boolean;
  contentId?: number;
  optimizelyId?: number;
  url?: string;
  error?: string;
  warnings?: string[];
}

interface OptimizelyStats {
  queue_length: number;
  is_processing: boolean;
  total_synced: number;
  failed_syncs: number;
  last_sync: string | null;
  config: {
    sync_direction: string;
    api_endpoint: string;
    cms_endpoint: string;
    batch_size: number;
    experiments_enabled: boolean;
    personalization_enabled: boolean;
  };
}

export class OptimizelyAdapter extends EventEmitter {
  private config: OptimizelyConfig;
  private authService: OptimizelyAuthService;
  private contentService: OptimizelyContentService;
  private syncQueue: SyncQueueItem[] = [];
  private isProcessing: boolean = false;
  private stats: {
    totalSynced: number;
    failedSyncs: number;
    lastSync: Date | null;
  } = {
    totalSynced: 0,
    failedSyncs: 0,
    lastSync: null
  };

  constructor(config: OptimizelyConfig) {
    super();
    this.config = {
      timeout: 30000,
      retries: 3,
      syncDirection: 'cms_to_optimizely',
      syncBatch: 5,
      enableExperiments: true,
      enablePersonalization: true,
      ...config
    };

    // Initialize services
    this.authService = new OptimizelyAuthService();
    this.contentService = new OptimizelyContentService(this.authService, config.cmsEndpoint);

    this.setupEventListeners();
    this.startQueueProcessor();
  }

  /**
   * Initialize the adapter with authentication
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    try {
      this.emit('adapter_initializing');

      // Authenticate with Optimizely
      const authResult = await this.authService.authenticate({
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        apiEndpoint: this.config.apiEndpoint,
        cmsEndpoint: this.config.cmsEndpoint
      });

      if (!authResult.success) {
        throw new Error(authResult.error || 'Authentication failed');
      }

      // Test connection
      const connectionTest = await this.testConnection();
      if (!connectionTest.success) {
        throw new Error(connectionTest.error || 'Connection test failed');
      }

      this.emit('adapter_initialized', {
        endpoint: this.config.cmsEndpoint,
        experimentsEnabled: this.config.enableExperiments,
        personalizationEnabled: this.config.enablePersonalization
      });

      return { success: true };

    } catch (error) {
      this.emit('adapter_initialization_error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Test connection to Optimizely
   */
  async testConnection(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const connectionResult = await this.authService.testConnection();
      
      if (connectionResult.success) {
        this.emit('connection_tested', { result: 'success', data: connectionResult.user });
        return {
          success: true,
          data: {
            authenticated: true,
            site: connectionResult.user?.site,
            version: connectionResult.user?.version,
            timestamp: new Date().toISOString()
          }
        };
      } else {
        return { success: false, error: connectionResult.error };
      }

    } catch (error) {
      this.emit('connection_test_error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send content to Optimizely CMS
   */
  async sendContentToOptimizely(cmsContent: any): Promise<ContentSyncResult> {
    try {
      this.emit('content_sync_started', { 
        contentId: cmsContent.id, 
        title: cmsContent.title,
        type: cmsContent.type 
      });

      // Transform CMS content to Optimizely format
      const optimizelyContent = this.transformCMSToOptimizely(cmsContent);
      
      // Check if content already exists in Optimizely
      const existingContent = await this.findOptimizelyContent(cmsContent.id);
      
      let result: ContentSyncResult;
      
      if (existingContent) {
        // Update existing content
        const updateResult = await this.contentService.updateContent({
          contentId: existingContent.contentId,
          properties: optimizelyContent,
          publishImmediately: cmsContent.status === 'published'
        });
        
        result = {
          success: updateResult.success,
          contentId: cmsContent.id,
          optimizelyId: updateResult.contentId,
          url: updateResult.url,
          error: updateResult.error
        };
      } else {
        // Create new content
        const createResult = await this.contentService.createContent({
          name: optimizelyContent.name,
          contentType: optimizelyContent.contentType,
          properties: {
            ...optimizelyContent,
            _cmsSourceId: cmsContent.id.toString() // Track original CMS ID
          },
          publishImmediately: cmsContent.status === 'published'
        });
        
        result = {
          success: createResult.success,
          contentId: cmsContent.id,
          optimizelyId: createResult.contentId,
          url: createResult.url,
          error: createResult.error
        };
      }

      if (result.success) {
        this.stats.totalSynced++;
        this.stats.lastSync = new Date();
        
        this.emit('content_synced', {
          cms_id: cmsContent.id,
          optimizely_id: result.optimizelyId,
          action: existingContent ? 'update' : 'create',
          url: result.url
        });
      } else {
        this.stats.failedSyncs++;
        this.emit('sync_error', {
          cms_id: cmsContent.id,
          error: result.error,
          action: 'send_to_optimizely'
        });
      }
      
      return result;

    } catch (error) {
      this.stats.failedSyncs++;
      this.emit('sync_error', {
        cms_id: cmsContent.id,
        error: error.message,
        action: 'send_to_optimizely'
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Create A/B test experiment for content
   */
  async createContentExperiment(contentId: number, variations: any[]): Promise<{ success: boolean; experimentId?: string; error?: string }> {
    try {
      if (!this.config.enableExperiments) {
        return { success: false, error: 'Experiments are disabled' };
      }

      this.emit('experiment_creation_started', { contentId, variationCount: variations.length });

      // For Phase 1, we'll create content variations manually
      // In Phase 2, we'll integrate with Optimizely Experimentation API
      const experimentResults = [];

      for (let i = 0; i < variations.length; i++) {
        const variation = variations[i];
        
        // Create content variation
        const createResult = await this.contentService.createContent({
          name: `${variation.name} (Variation ${String.fromCharCode(65 + i)})`,
          contentType: variation.contentType || 'BlogPost',
          properties: {
            ...variation.properties,
            _experimentId: `exp_${contentId}_${Date.now()}`,
            _variationIndex: i,
            _parentContentId: contentId
          }
        });

        if (createResult.success) {
          experimentResults.push({
            variationId: createResult.contentId,
            index: i,
            name: variation.name
          });
        }
      }

      if (experimentResults.length > 0) {
        const experimentId = `exp_${contentId}_${Date.now()}`;
        
        this.emit('experiment_created', {
          experimentId,
          contentId,
          variations: experimentResults
        });

        return { success: true, experimentId };
      } else {
        return { success: false, error: 'Failed to create experiment variations' };
      }

    } catch (error) {
      this.emit('experiment_creation_error', { error: error.message, contentId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Queue sync operation
   */
  queueSync(operation: SyncQueueItem['operation'], data: any, priority: number = 1): void {
    this.syncQueue.push({
      operation,
      data,
      timestamp: Date.now(),
      retries: 0,
      priority
    });

    // Sort queue by priority (higher priority first)
    this.syncQueue.sort((a, b) => (b.priority || 1) - (a.priority || 1));

    this.emit('sync_queued', { operation, dataId: data.id, queueLength: this.syncQueue.length });
  }

  /**
   * Process sync queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.syncQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.emit('queue_processing_started', { queueLength: this.syncQueue.length });

    const batch = this.syncQueue.splice(0, this.config.syncBatch!);
    
    for (const item of batch) {
      try {
        await this.processQueueItem(item);
      } catch (error) {
        // Handle retry logic
        if (item.retries < this.config.retries!) {
          item.retries++;
          item.timestamp = Date.now(); // Update timestamp for retry
          this.syncQueue.unshift(item); // Add back to front of queue
          
          this.emit('sync_retry', {
            operation: item.operation,
            retryCount: item.retries,
            maxRetries: this.config.retries
          });
        } else {
          this.stats.failedSyncs++;
          this.emit('sync_failed', {
            operation: item.operation,
            data: item.data,
            error: error.message,
            retries: item.retries
          });
        }
      }
    }

    this.isProcessing = false;
    this.emit('queue_processing_completed');
  }

  /**
   * Process individual queue item
   */
  private async processQueueItem(item: SyncQueueItem): Promise<void> {
    switch (item.operation) {
      case 'create':
      case 'update':
        await this.sendContentToOptimizely(item.data);
        break;
        
      case 'delete':
        if (item.data.optimizelyId) {
          await this.contentService.deleteContent(item.data.optimizelyId);
        }
        break;
        
      case 'publish':
        if (item.data.optimizelyId) {
          await this.contentService.publishContent(item.data.optimizelyId);
        }
        break;
        
      case 'experiment':
        await this.createContentExperiment(item.data.contentId, item.data.variations);
        break;
    }
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue().catch(error => {
        this.emit('queue_processing_error', { error: error.message });
      });
    }, 5000); // Process queue every 5 seconds
  }

  /**
   * Handle CMS content events
   */
  onContentEvent(event: string, content: any): void {
    if (this.config.syncDirection === 'optimizely_to_cms') {
      return; // Only sync Optimizely to CMS
    }

    switch (event) {
      case 'content.created':
      case 'content.updated':
        if (this.config.syncDirection === 'cms_to_optimizely' || this.config.syncDirection === 'bidirectional') {
          this.queueSync('update', content, 2);
        }
        break;
        
      case 'content.published':
        if (this.config.syncDirection === 'cms_to_optimizely' || this.config.syncDirection === 'bidirectional') {
          this.queueSync('publish', content, 3);
        }
        break;
        
      case 'content.deleted':
        if (this.config.syncDirection === 'cms_to_optimizely' || this.config.syncDirection === 'bidirectional') {
          this.queueSync('delete', { optimizelyId: content.optimizelyId }, 1);
        }
        break;
    }
  }

  /**
   * Bulk sync content from CMS to Optimizely
   */
  async bulkSyncToOptimizely(contents: any[]): Promise<ContentSyncResult[]> {
    const results: ContentSyncResult[] = [];
    
    this.emit('bulk_sync_started', { contentCount: contents.length });
    
    for (const content of contents) {
      try {
        const result = await this.sendContentToOptimizely(content);
        results.push({
          success: result.success,
          contentId: content.id,
          optimizelyId: result.optimizelyId,
          url: result.url,
          error: result.error
        });
      } catch (error) {
        results.push({
          success: false,
          contentId: content.id,
          error: error.message
        });
      }
    }
    
    this.emit('bulk_sync_completed', { 
      total: contents.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });
    
    return results;
  }

  /**
   * Get adapter statistics
   */
  getStats(): OptimizelyStats {
    return {
      queue_length: this.syncQueue.length,
      is_processing: this.isProcessing,
      total_synced: this.stats.totalSynced,
      failed_syncs: this.stats.failedSyncs,
      last_sync: this.stats.lastSync?.toISOString() || null,
      config: {
        sync_direction: this.config.syncDirection!,
        api_endpoint: this.config.apiEndpoint,
        cms_endpoint: this.config.cmsEndpoint,
        batch_size: this.config.syncBatch!,
        experiments_enabled: this.config.enableExperiments!,
        personalization_enabled: this.config.enablePersonalization!
      }
    };
  }

  /**
   * Update adapter configuration
   */
  updateConfig(newConfig: Partial<OptimizelyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config_updated', { newConfig });
  }

  /**
   * Shutdown adapter
   */
  async shutdown(): Promise<void> {
    this.emit('adapter_shutting_down');
    
    // Process remaining queue items
    while (this.syncQueue.length > 0 && !this.isProcessing) {
      await this.processQueue();
    }
    
    // Logout from Optimizely
    await this.authService.logout();
    
    this.emit('adapter_shutdown');
  }

  // Private helper methods

  private setupEventListeners(): void {
    // Forward auth service events
    this.authService.on('auth_success', (data) => this.emit('auth_success', data));
    this.authService.on('auth_error', (data) => this.emit('auth_error', data));
    this.authService.on('token_refreshed', (data) => this.emit('token_refreshed', data));
    
    // Forward content service events
    this.contentService.on('content_created', (data) => this.emit('optimizely_content_created', data));
    this.contentService.on('content_updated', (data) => this.emit('optimizely_content_updated', data));
    this.contentService.on('content_published', (data) => this.emit('optimizely_content_published', data));
    this.contentService.on('api_error', (data) => this.emit('optimizely_api_error', data));
  }

  private transformCMSToOptimizely(cmsContent: any): any {
    return {
      name: cmsContent.title || cmsContent.name,
      contentType: this.mapCMSTypeToOptimizely(cmsContent.type),
      heading: cmsContent.title,
      mainBody: cmsContent.content,
      metaDescription: cmsContent.excerpt || cmsContent.description,
      routeSegment: cmsContent.slug,
      startPublish: cmsContent.publishDate || new Date().toISOString(),
      stopPublish: cmsContent.unpublishDate,
      categories: cmsContent.categories?.map((cat: any) => cat.name).join(', '),
      tags: cmsContent.tags?.map((tag: any) => tag.name).join(', ')
    };
  }

  private mapCMSTypeToOptimizely(cmsType: string): string {
    const typeMap: Record<string, string> = {
      'blog_post': 'BlogPost',
      'article': 'ArticlePage',
      'page': 'StandardPage',
      'product': 'ProductPage',
      'news': 'NewsArticle'
    };
    
    return typeMap[cmsType] || 'StandardPage';
  }

  private async findOptimizelyContent(cmsId: string): Promise<{ contentId: number } | null> {
    try {
      const searchResult = await this.contentService.searchContent({
        query: `_cmsSourceId:"${cmsId}"`,
        pageSize: 1
      });
      
      if (searchResult.success && searchResult.results && searchResult.results.length > 0) {
        return { contentId: searchResult.results[0].contentLink.id };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}