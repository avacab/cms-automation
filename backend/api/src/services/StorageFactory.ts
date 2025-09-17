import dotenv from 'dotenv';
import { ContentService } from './ContentService.js';
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
  private contentService: ContentService | null = null;
  private supabaseService: SupabaseService | null = null;

  private constructor() {}

  static getInstance(): StorageFactory {
    if (!StorageFactory.instance) {
      StorageFactory.instance = new StorageFactory();
    }
    return StorageFactory.instance;
  }

  async getContentService(): Promise<ContentService | SupabaseService> {
    const storageType = process.env.STORAGE_TYPE || 'local';

    if (storageType === 'supabase') {
      return this.getSupabaseService();
    } else {
      return this.getLocalContentService();
    }
  }

  private getLocalContentService(): ContentService {
    if (!this.contentService) {
      this.contentService = new ContentService();
      console.log('✅ Using local JSON storage');
    }
    return this.contentService;
  }

  private async getSupabaseService(): Promise<SupabaseService | ContentService> {
    if (!this.supabaseService) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase configuration, falling back to local storage');
        return this.getLocalContentService();
      }

      this.supabaseService = new SupabaseService(supabaseUrl, supabaseKey);
      
      const initialized = await this.supabaseService.initialize();
      if (!initialized) {
        console.error('❌ Failed to initialize Supabase, falling back to local storage');
        return this.getLocalContentService();
      }

      console.log('✅ Using Supabase storage');
    }

    return this.supabaseService;
  }

  async getStorageInfo(): Promise<{ type: string; status: string; details?: any }> {
    const storageType = process.env.STORAGE_TYPE || 'local';

    if (storageType === 'supabase') {
      try {
        const service = await this.getSupabaseService();
        if (service instanceof SupabaseService && service.isReady()) {
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
    } else {
      return {
        type: 'local',
        status: 'active',
        details: 'Using local JSON files'
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
        } else {
          return service.getContentTypes();
        }
      },

      getContentItems: async (contentTypeId?: string) => {
        const service = await this.getContentService();
        if (service instanceof SupabaseService) {
          return service.getAllContentItems(contentTypeId);
        } else {
          return service.getAllContent({});
        }
      },

      getContentItemById: async (id: string) => {
        const service = await this.getContentService();
        if (service instanceof SupabaseService) {
          return service.getContentItemById(id);
        } else {
          return service.getContentById(id);
        }
      },

      createContentItem: async (data: any) => {
        const service = await this.getContentService();
        if (service instanceof SupabaseService) {
          return service.createContentItem(data);
        } else {
          return service.createContent(data);
        }
      },

      updateContentItem: async (id: string, data: any) => {
        const service = await this.getContentService();
        if (service instanceof SupabaseService) {
          return service.updateContentItem(id, data);
        } else {
          return service.updateContent(id, data);
        }
      },

      deleteContentItem: async (id: string) => {
        const service = await this.getContentService();
        if (service instanceof SupabaseService) {
          return service.deleteContentItem(id);
        } else {
          return service.deleteContent(id);
        }
      }
    };
  }
}