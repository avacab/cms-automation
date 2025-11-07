import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface ContentType {
  id: string;
  name: string;
  description?: string;
  schema: Record<string, any>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ContentItem {
  id: string;
  content_type_id: string;
  title: string;
  content: Record<string, any>;
  status: 'draft' | 'published' | 'archived';
  slug?: string;
  featured_image_url?: string;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface MediaFile {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  alt_text?: string;
  caption?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  uploaded_by?: string;
}

export class SupabaseService {
  private supabase: SupabaseClient;
  private isConnected: boolean = false;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async initialize(): Promise<boolean> {
    try {
      // Test connection by querying content_types
      const { error } = await this.supabase
        .from('content_types')
        .select('id')
        .limit(1);

      if (error && error.code === 'PGRST116') {
        console.log('ℹ️  Tables not yet created in Supabase');
        this.isConnected = false;
        return false;
      } else if (error) {
        console.error('❌ Supabase connection error:', error);
        this.isConnected = false;
        return false;
      }

      this.isConnected = true;
      console.log('✅ Successfully connected to Supabase');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Supabase service:', error);
      this.isConnected = false;
      return false;
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }

  // Content Types Methods
  async getAllContentTypes(): Promise<ContentType[]> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    const { data, error } = await this.supabase
      .from('content_types')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch content types: ${error.message}`);
    }

    return data || [];
  }

  async getContentTypeById(id: string): Promise<ContentType | null> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    const { data, error } = await this.supabase
      .from('content_types')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch content type: ${error.message}`);
    }

    return data;
  }

  async createContentType(contentType: Omit<ContentType, 'created_at' | 'updated_at'>): Promise<ContentType> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    const { data, error } = await this.supabase
      .from('content_types')
      .insert([contentType])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create content type: ${error.message}`);
    }

    return data;
  }

  async updateContentType(id: string, updates: Partial<ContentType>): Promise<ContentType> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    const { data, error } = await this.supabase
      .from('content_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update content type: ${error.message}`);
    }

    return data;
  }

  async deleteContentType(id: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    const { error } = await this.supabase
      .from('content_types')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete content type: ${error.message}`);
    }
  }

  // Content Items Methods
  async getAllContentItems(contentTypeId?: string): Promise<ContentItem[]> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    let query = this.supabase
      .from('content_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (contentTypeId) {
      query = query.eq('content_type_id', contentTypeId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch content items: ${error.message}`);
    }

    return data || [];
  }

  async getContentItemById(id: string): Promise<ContentItem | null> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    const { data, error } = await this.supabase
      .from('content_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch content item: ${error.message}`);
    }

    return data;
  }

  async createContentItem(contentItem: Omit<ContentItem, 'created_at' | 'updated_at'>): Promise<ContentItem> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    // Set published_at if status is published and not already set
    const itemToInsert = { ...contentItem };
    if (itemToInsert.status === 'published' && !itemToInsert.published_at) {
      itemToInsert.published_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('content_items')
      .insert([itemToInsert])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create content item: ${error.message}`);
    }

    return data;
  }

  async updateContentItem(id: string, updates: Partial<ContentItem>): Promise<ContentItem> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    // Set published_at if status is being changed to published
    const updatesToApply = { ...updates };
    if (updatesToApply.status === 'published' && !updatesToApply.published_at) {
      updatesToApply.published_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('content_items')
      .update(updatesToApply)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update content item: ${error.message}`);
    }

    return data;
  }

  async deleteContentItem(id: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    const { error } = await this.supabase
      .from('content_items')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete content item: ${error.message}`);
    }
  }

  // Media Files Methods
  async getAllMediaFiles(): Promise<MediaFile[]> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    const { data, error } = await this.supabase
      .from('media_files')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch media files: ${error.message}`);
    }

    return data || [];
  }

  async getMediaFileById(id: string): Promise<MediaFile | null> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    const { data, error } = await this.supabase
      .from('media_files')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch media file: ${error.message}`);
    }

    return data;
  }

  async uploadFile(file: Buffer, filename: string, mimeType: string): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `uploads/${timestamp}-${filename}`;

    const { error: uploadError } = await this.supabase.storage
      .from('cms-media')
      .upload(storagePath, file, {
        contentType: mimeType,
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    return storagePath;
  }

  async createMediaFile(mediaFile: Omit<MediaFile, 'id' | 'created_at'>): Promise<MediaFile> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    const { data, error } = await this.supabase
      .from('media_files')
      .insert([mediaFile])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create media file record: ${error.message}`);
    }

    return data;
  }

  async deleteMediaFile(id: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    // First get the file info to delete from storage
    const mediaFile = await this.getMediaFileById(id);
    if (mediaFile) {
      // Delete from storage
      await this.supabase.storage
        .from('cms-media')
        .remove([mediaFile.storage_path]);
    }

    // Delete from database
    const { error } = await this.supabase
      .from('media_files')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete media file: ${error.message}`);
    }
  }

  // Utility Methods
  async getStats(): Promise<{ contentTypes: number; contentItems: number; mediaFiles: number }> {
    if (!this.isConnected) {
      throw new Error('Supabase service not initialized');
    }

    const [contentTypesResult, contentItemsResult, mediaFilesResult] = await Promise.all([
      this.supabase.from('content_types').select('id', { count: 'exact', head: true }),
      this.supabase.from('content_items').select('id', { count: 'exact', head: true }),
      this.supabase.from('media_files').select('id', { count: 'exact', head: true })
    ]);

    return {
      contentTypes: contentTypesResult.count || 0,
      contentItems: contentItemsResult.count || 0,
      mediaFiles: mediaFilesResult.count || 0
    };
  }
}