import axios from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Types
export interface ContentItem {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: 'published' | 'draft' | 'archived';
  created_at: string;
  updated_at: string;
  published_at?: string;
  content_type_id?: string;
  meta_description?: string;
  featured_image?: string;
  tags?: string[];
}

export interface ContentType {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  // Support both legacy fields array and new schema object structure
  fields?: Array<{
    name: string;
    type: 'text' | 'textarea' | 'richtext' | 'number' | 'boolean' | 'date' | 'image' | 'select';
    label: string;
    required: boolean;
    options?: string[];
    validation?: Record<string, any>;
  }>;
  schema?: Record<string, {
    type: string;
    required?: boolean;
    [key: string]: any;
  }>;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  status: 'active' | 'inactive' | 'error';
  type: 'integration' | 'authentication' | 'storage' | 'workflow' | 'utility';
  features?: string[];
  config_url?: string;
  installed_at?: string;
  endpoints?: Array<{
    method: string;
    path: string;
    description: string;
  }>;
  dependencies?: string[];
  settings?: Record<string, any>;
}

export interface ApiResponse<T> {
  message: string;
  data: T;
}

// API Services
export const contentService = {
  // Get all content items
  async getContent(): Promise<ContentItem[]> {
    const response = await api.get<ApiResponse<ContentItem[]>>('/api/v1/content');
    return response.data.data;
  },

  // Get content types
  async getContentTypes(): Promise<ContentType[]> {
    const response = await api.get<ApiResponse<ContentType[]>>('/api/v1/content-types');
    return response.data.data;
  },

  // Get single content item by ID
  async getContentItem(id: string): Promise<ContentItem> {
    const response = await api.get<ApiResponse<ContentItem>>(`/api/v1/content/${id}`);
    return response.data.data;
  },

  // Create content item
  async createContent(contentData: Partial<ContentItem>): Promise<ContentItem> {
    const response = await api.post<ApiResponse<ContentItem>>('/api/v1/content', {
      content: contentData
    });
    return response.data.data;
  },

  // Update content item
  async updateContent(id: string, contentData: Partial<ContentItem>): Promise<ContentItem> {
    const response = await api.put<ApiResponse<ContentItem>>(`/api/v1/content/${id}`, {
      content: contentData
    });
    return response.data.data;
  },

  // Delete content item
  async deleteContent(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<ApiResponse<{ success: boolean; message: string }>>(`/api/v1/content/${id}`);
    return response.data.data;
  },

  // Health check
  async healthCheck(): Promise<any> {
    const response = await api.get('/health');
    return response.data;
  },
};

// Plugin Services
export const pluginService = {
  // Get all plugins
  async getPlugins(): Promise<Plugin[]> {
    try {
      const response = await api.get<ApiResponse<Plugin[]>>('/api/v1/plugins');
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch plugins from API:', error);
      throw error;
    }
  },

  // Get single plugin by ID
  async getPlugin(id: string): Promise<Plugin> {
    try {
      const response = await api.get<ApiResponse<Plugin>>(`/api/v1/plugins/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`Failed to fetch plugin ${id} from API:`, error);
      throw error;
    }
  },

  // Activate plugin
  async activatePlugin(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/api/v1/plugins/${id}/activate`);
    return response.data;
  },

  // Deactivate plugin
  async deactivatePlugin(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/api/v1/plugins/${id}/deactivate`);
    return response.data;
  },

  // Configure plugin
  async configurePlugin(id: string, settings: Record<string, any>): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.put(`/api/v1/plugins/${id}/config`, settings);
      return response.data;
    } catch (error) {
      return { success: false, message: 'Plugin configuration not implemented yet' };
    }
  },

  // Get mock plugin data for development
  getMockPlugins(): Plugin[] {
    return [
      {
        id: 'wordpress-bridge',
        name: 'WordPress Integration Bridge',
        version: '1.0.0',
        description: 'Bidirectional content synchronization between WordPress and headless CMS with webhook support, authentication, and real-time sync capabilities.',
        author: 'CMS Automation Team',
        status: 'active',
        type: 'integration',
        features: [
          'Bidirectional Sync',
          'Webhook Handling', 
          'API Authentication',
          'Content Transformation',
          'Real-time Updates',
          'Error Logging'
        ],
        config_url: '/admin/plugins/wordpress-bridge/config',
        installed_at: '2025-08-23T10:00:00Z',
        endpoints: [
          {
            method: 'POST',
            path: '/wp-json/wp-headless-cms-bridge/v1/webhook/content',
            description: 'Content webhook endpoint'
          },
          {
            method: 'POST', 
            path: '/wp-json/wp-headless-cms-bridge/v1/webhook/media',
            description: 'Media webhook endpoint'
          },
          {
            method: 'GET',
            path: '/wp-json/wp-headless-cms-bridge/v1/webhook/health',
            description: 'Health check endpoint'
          }
        ],
        dependencies: ['axios', 'crypto'],
        settings: {
          wordpress_url: 'http://localhost:8080',
          sync_enabled: true,
          sync_direction: 'bidirectional',
          webhook_secret: '••••••••••••••••'
        }
      },
      {
        id: 'shopify-bridge',
        name: 'Shopify Integration Bridge',
        version: '1.0.0',
        description: 'Modern GraphQL-first integration with Shopify for real-time product, order, and customer synchronization using OAuth 2.0 and event-driven architecture.',
        author: 'CMS Automation Team',
        status: 'active',
        type: 'integration',
        features: [
          'GraphQL Admin API',
          'OAuth 2.0 Authentication',
          'Real-time Webhooks',
          'Product/Order/Customer Sync',
          'Event-Driven Architecture',
          'Bulk Operations',
          'Circuit Breaker Patterns'
        ],
        config_url: '/admin/plugins/shopify-bridge/config',
        installed_at: '2025-08-23T12:00:00Z',
        endpoints: [
          {
            method: 'GET',
            path: '/health',
            description: 'Health check endpoint'
          },
          {
            method: 'POST',
            path: '/api/sync/products',
            description: 'Trigger product synchronization'
          },
          {
            method: 'POST',
            path: '/api/sync/orders',
            description: 'Trigger order synchronization'
          },
          {
            method: 'POST',
            path: '/api/sync/customers',
            description: 'Trigger customer synchronization'
          }
        ],
        dependencies: ['@shopify/shopify-api', '@shopify/shopify-app-express', 'axios', 'crypto'],
        settings: {
          shopify_api_key: '••••••••••••••••',
          shopify_api_secret: '••••••••••••••••',
          webhook_secret: '••••••••••••••••',
          cms_api_url: 'http://localhost:5000',
          sync_direction: 'bidirectional',
          scopes: 'read_products,write_products,read_orders,read_customers'
        }
      },
      {
        id: 'drupal-bridge',
        name: 'Drupal Integration Bridge',
        version: '1.0.0',
        description: 'Service container-based integration with Drupal using modern event subscribers, dependency injection, and comprehensive entity synchronization.',
        author: 'CMS Automation Team',
        status: 'active',
        type: 'integration',
        features: [
          'Service Container Architecture',
          'Event-Driven Sync',
          'Entity Transformation',
          'REST API Endpoints',
          'Queue Processing',
          'PHPUnit Testing',
          'Webhook Security'
        ],
        config_url: '/admin/plugins/drupal-bridge/config',
        installed_at: '2025-08-23T12:30:00Z',
        endpoints: [
          {
            method: 'GET',
            path: '/headless-cms-bridge/status',
            description: 'Status and health check'
          },
          {
            method: 'POST',
            path: '/headless-cms-bridge/webhook/node/create',
            description: 'Node creation webhook'
          },
          {
            method: 'POST',
            path: '/headless-cms-bridge/webhook/user/update',
            description: 'User update webhook'
          },
          {
            method: 'POST',
            path: '/headless-cms-bridge/webhook/taxonomy_term/delete',
            description: 'Taxonomy term deletion webhook'
          }
        ],
        dependencies: ['drupal/core', 'symfony/event-dispatcher', 'guzzlehttp/guzzle'],
        settings: {
          api_url: 'http://localhost:5000',
          api_key: '••••••••••••••••',
          webhook_secret: '••••••••••••••••',
          sync_direction: 'bidirectional',
          enabled_entity_types: ['node', 'user', 'taxonomy_term'],
          sync_mode: 'immediate'
        }
      },
      {
        id: 'auth-manager',
        name: 'Authentication Manager',
        version: '1.2.0',
        description: 'Comprehensive authentication system with JWT tokens, API keys, OAuth flows, and advanced security features.',
        author: 'Security Team',
        status: 'active',
        type: 'authentication',
        features: [
          'JWT Authentication',
          'API Key Management',
          'OAuth Integration',
          'Rate Limiting',
          'Session Management',
          'Security Logging'
        ],
        config_url: '/admin/plugins/auth-manager/config',
        installed_at: '2025-08-20T14:30:00Z',
        endpoints: [
          {
            method: 'POST',
            path: '/api/v1/auth/login',
            description: 'User authentication'
          },
          {
            method: 'POST',
            path: '/api/v1/auth/refresh',
            description: 'Token refresh'
          },
          {
            method: 'GET',
            path: '/api/v1/auth/me',
            description: 'Get current user'
          }
        ],
        dependencies: ['jsonwebtoken', 'bcrypt', 'passport'],
        settings: {
          jwt_expiry: '24h',
          enable_oauth: true,
          rate_limit: 100,
          session_timeout: 3600
        }
      },
      {
        id: 'media-optimizer',
        name: 'Media Optimizer',
        version: '2.1.3',
        description: 'Automatic image optimization, resizing, format conversion, and CDN integration for improved performance.',
        author: 'Performance Team',
        status: 'inactive',
        type: 'utility',
        features: [
          'Image Compression',
          'Format Conversion',
          'Responsive Images',
          'CDN Integration',
          'Lazy Loading',
          'WebP Support'
        ],
        config_url: '/admin/plugins/media-optimizer/config',
        installed_at: '2025-08-18T09:15:00Z',
        dependencies: ['sharp', 'imagemin'],
        settings: {
          quality: 80,
          formats: ['webp', 'avif', 'jpeg'],
          cdn_enabled: false,
          lazy_loading: true
        }
      },
      {
        id: 'analytics-tracker',
        name: 'Analytics Tracker',
        version: '1.5.2',
        description: 'Comprehensive analytics and tracking system with custom events, user behavior analysis, and reporting.',
        author: 'Analytics Team',
        status: 'active',
        type: 'utility',
        features: [
          'Event Tracking',
          'User Analytics',
          'Performance Metrics',
          'Custom Reports',
          'Real-time Dashboard',
          'Privacy Compliance'
        ],
        config_url: '/admin/plugins/analytics-tracker/config',
        installed_at: '2025-08-22T16:45:00Z',
        endpoints: [
          {
            method: 'POST',
            path: '/api/v1/analytics/event',
            description: 'Track custom events'
          },
          {
            method: 'GET',
            path: '/api/v1/analytics/reports',
            description: 'Get analytics reports'
          }
        ],
        dependencies: ['google-analytics', 'mixpanel'],
        settings: {
          ga_tracking_id: 'GA-XXXXXXXXX',
          enable_events: true,
          privacy_mode: true,
          retention_days: 90
        }
      },
      {
        id: 'backup-manager',
        name: 'Backup Manager',
        version: '3.0.1',
        description: 'Automated backup system with cloud storage integration, scheduling, and disaster recovery capabilities.',
        author: 'Infrastructure Team',
        status: 'error',
        type: 'storage',
        features: [
          'Automated Backups',
          'Cloud Storage',
          'Incremental Backups',
          'Disaster Recovery',
          'Scheduled Backups',
          'Backup Verification'
        ],
        config_url: '/admin/plugins/backup-manager/config',
        installed_at: '2025-08-15T11:20:00Z',
        dependencies: ['aws-sdk', 'cron'],
        settings: {
          schedule: '0 2 * * *',
          storage_provider: 'aws-s3',
          retention_policy: '30d',
          compression: true
        }
      },
      {
        id: 'workflow-engine',
        name: 'Workflow Automation Engine',
        version: '2.3.0',
        description: 'Advanced workflow automation with custom triggers, actions, conditions, and visual workflow builder.',
        author: 'Automation Team',
        status: 'inactive',
        type: 'workflow',
        features: [
          'Visual Workflow Builder',
          'Custom Triggers',
          'Conditional Logic',
          'Multi-step Actions',
          'Workflow Templates',
          'Performance Monitoring'
        ],
        config_url: '/admin/plugins/workflow-engine/config',
        installed_at: '2025-08-19T13:10:00Z',
        endpoints: [
          {
            method: 'POST',
            path: '/api/v1/workflows/trigger',
            description: 'Trigger workflow execution'
          },
          {
            method: 'GET',
            path: '/api/v1/workflows/status',
            description: 'Check workflow status'
          }
        ],
        dependencies: ['bull', 'redis'],
        settings: {
          max_concurrent: 5,
          retry_attempts: 3,
          timeout: 300000,
          enable_notifications: true
        }
      },
      {
        id: 'wix-ai-plugin',
        name: 'Wix AI Writing Assistant',
        version: '1.0.0',
        description: 'AI-powered writing assistant plugin for Wix websites. Provides content generation, real-time suggestions, and brand voice consistency directly in Wix Editor.',
        author: 'CMS Automation Team',
        status: 'active',
        type: 'integration',
        features: [
          'AI Content Generation',
          'Real-time Writing Suggestions',
          'Brand Voice Consistency',
          'Multi-format Adaptation',
          'One-click Enhancement',
          'Batch Processing',
          'Setup Wizard',
          'Wix Velo Integration'
        ],
        config_url: '/admin/plugins/wix-ai-plugin/config',
        installed_at: '2025-09-09T10:00:00Z',
        endpoints: [
          {
            method: 'POST',
            path: '/api/v1/generate',
            description: 'Generate AI content'
          },
          {
            method: 'POST',
            path: '/api/v1/suggestions',
            description: 'Get writing suggestions'
          },
          {
            method: 'POST',
            path: '/api/v1/adapt',
            description: 'Adapt content for different formats'
          },
          {
            method: 'GET',
            path: '/api/v1/adapt/formats',
            description: 'Get available adaptation formats'
          }
        ],
        dependencies: ['wix-data', 'wix-storage', 'wix-location', 'axios'],
        settings: {
          api_base_url: 'http://localhost:5000/api/v1/ai',
          api_key: '••••••••••••••••',
          brand_voice_id: '',
          enable_suggestions: true,
          enable_generation: true,
          enable_adaptation: true,
          rate_limits: {
            suggestions: 30,
            generation: 10
          }
        }
      }
    ];
  }
};

export default api;