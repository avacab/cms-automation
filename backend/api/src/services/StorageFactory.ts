import dotenv from 'dotenv';
// import { ContentService } from './ContentService.js';
import { SupabaseService } from './SupabaseService.js';

// Load environment variables
dotenv.config();

// Load environment-specific config if available
const env = process.env.NODE_ENV || 'development';
if (env === 'supabase-test') {
  dotenv.config({ path: 'config/supabase-test.env' });
}

export class StorageFactory {
  private static instance: StorageFactory;
  // private contentService: ContentService | null = null;
  private supabaseService: SupabaseService | null = null;

  private constructor() {}

  static getInstance(): StorageFactory {
    if (!StorageFactory.instance) {
      StorageFactory.instance = new StorageFactory();
    }
    return StorageFactory.instance;
  }

  async getContentService(): Promise<SupabaseService> {
    const storageType = process.env.STORAGE_TYPE || 'supabase';
    console.log('🔍 StorageFactory using storage type:', storageType);

    if (storageType === 'supabase') {
      return this.getSupabaseService();
    } else {
      throw new Error('Local storage not available in serverless environment');
    }
  }

  private async getSupabaseService(): Promise<SupabaseService> {
    if (!this.supabaseService) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

      console.log('🔍 Supabase config check:', {
        hasUrl: !!supabaseUrl,
        urlPreview: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'missing',
        hasKey: !!supabaseKey,
        keyPreview: supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'missing'
      });

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase configuration - SUPABASE_URL and SUPABASE_SERVICE_KEY required');
      }

      this.supabaseService = new SupabaseService(supabaseUrl, supabaseKey);
      
      const initialized = await this.supabaseService.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize Supabase service');
      }

      console.log('✅ Using Supabase storage');
    }

    return this.supabaseService;
  }

  async getStorageInfo(): Promise<{ type: string; status: string; details?: any }> {
    const storageType = process.env.STORAGE_TYPE || 'supabase';

    try {
      const service = await this.getSupabaseService();
      if (service.isReady()) {
        const stats = await service.getStats();
        return {
          type: 'supabase',
          status: 'connected',
          details: {
            url: process.env.SUPABASE_URL,
            stats
          }
        };
      } else {
        return {
          type: 'supabase',
          status: 'failed',
          details: 'Service initialization failed'
        };
      }
    } catch (error: any) {
      return {
        type: 'supabase',
        status: 'error',
        details: error.message
      };
    }
  }

  // Create a unified interface that works with both services
  createUnifiedService() {
    return {
      getContentTypes: async () => {
        const service = await this.getContentService();
        if (service instanceof SupabaseService) {
          return service.getAllContentTypes();
        }
      },

      getContentItems: async (contentTypeId?: string) => {
        const service = await this.getContentService();
        return service.getAllContentItems(contentTypeId);
      },

      getContentItemById: async (id: string) => {
        const service = await this.getContentService();
        return service.getContentItemById(id);
      },

      createContentItem: async (data: any) => {
        const service = await this.getContentService();
        return service.createContentItem(data);
      },

      updateContentItem: async (id: string, data: any) => {
        const service = await this.getContentService();
        return service.updateContentItem(id, data);
      },

      deleteContentItem: async (id: string) => {
        const service = await this.getContentService();
        return service.deleteContentItem(id);
      }
    };
  }
}