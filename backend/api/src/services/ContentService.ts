import { FileStorage } from '../storage/FileStorage.js';

export interface ContentItem {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  author_id?: string;
  content_type_id?: string;
  meta_description?: string;
  featured_image?: string;
  tags?: string[];
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ContentType {
  id: string;
  name: string;
  slug: string;
  description?: string;
  fields: ContentField[];
  created_at: string;
  updated_at: string;
}

export interface ContentField {
  name: string;
  type: 'text' | 'textarea' | 'richtext' | 'number' | 'boolean' | 'date' | 'image' | 'select';
  label: string;
  required: boolean;
  options?: string[];
  validation?: Record<string, any>;
}

export interface MediaFile {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  width?: number;
  height?: number;
  alt_text?: string;
  uploaded_by?: string;
  created_at: string;
}

export interface CreateContentRequest {
  title: string;
  slug?: string;
  content: string;
  status?: ContentItem['status'];
  content_type_id?: string;
  meta_description?: string;
  featured_image?: string;
  tags?: string[];
}

export interface UpdateContentRequest {
  title?: string;
  slug?: string;
  content?: string;
  status?: ContentItem['status'];
  meta_description?: string;
  featured_image?: string;
  tags?: string[];
}

export class ContentService {
  private contentStorage: FileStorage<ContentItem>;
  private contentTypeStorage: FileStorage<ContentType>;
  private mediaStorage: FileStorage<MediaFile>;

  constructor() {
    this.contentStorage = new FileStorage<ContentItem>('content_items');
    this.contentTypeStorage = new FileStorage<ContentType>('content_types');
    this.mediaStorage = new FileStorage<MediaFile>('media_files');
    this.initializeDefaultData();
  }

  private async initializeDefaultData(): Promise<void> {
    const contentTypeCount = await this.contentTypeStorage.count();
    if (contentTypeCount === 0) {
      await this.contentTypeStorage.create({
        name: 'Page',
        slug: 'page',
        description: 'Basic page content type',
        fields: [
          { name: 'title', type: 'text', label: 'Title', required: true },
          { name: 'content', type: 'richtext', label: 'Content', required: true },
          { name: 'meta_description', type: 'text', label: 'Meta Description', required: false }
        ]
      } as any);

      await this.contentTypeStorage.create({
        name: 'Blog Post',
        slug: 'blog-post',
        description: 'Blog post content type',
        fields: [
          { name: 'title', type: 'text', label: 'Title', required: true },
          { name: 'content', type: 'richtext', label: 'Content', required: true },
          { name: 'excerpt', type: 'textarea', label: 'Excerpt', required: false },
          { name: 'featured_image', type: 'image', label: 'Featured Image', required: false }
        ]
      } as any);
    }

    const contentCount = await this.contentStorage.count();
    if (contentCount === 0) {
      await this.contentStorage.create({
        title: 'Welcome to your CMS',
        slug: 'welcome',
        content: 'This is your first content item.',
        status: 'published'
      } as any);

      await this.contentStorage.create({
        title: 'Getting Started',
        slug: 'getting-started',
        content: 'Learn how to use your headless CMS.',
        status: 'published'
      } as any);
    }
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  async getAllContent(options: {
    status?: ContentItem['status'];
    content_type_id?: string;
    limit?: number;
    offset?: number;
    search?: string;
  } = {}): Promise<ContentItem[]> {
    let queryOptions: any = {};

    if (options.status || options.content_type_id) {
      queryOptions.where = {};
      if (options.status) {
        queryOptions.where.status = options.status;
      }
      if (options.content_type_id) {
        queryOptions.where.content_type_id = options.content_type_id;
      }
    }

    if (options.limit) {
      queryOptions.limit = options.limit;
    }

    if (options.offset) {
      queryOptions.offset = options.offset;
    }

    queryOptions.orderBy = { field: 'created_at', direction: 'desc' as const };

    let results = await this.contentStorage.findAll(queryOptions);

    if (options.search) {
      results = await this.contentStorage.search(options.search, ['title', 'content', 'meta_description']);
    }

    return results;
  }

  async getContentById(id: string): Promise<ContentItem | null> {
    return await this.contentStorage.findById(id);
  }

  async getContentBySlug(slug: string): Promise<ContentItem | null> {
    return await this.contentStorage.findOne({ where: { slug } });
  }

  async createContent(data: CreateContentRequest): Promise<ContentItem> {
    const slug = data.slug || this.generateSlug(data.title);
    
    const existingContent = await this.getContentBySlug(slug);
    if (existingContent) {
      throw new Error(`Content with slug "${slug}" already exists`);
    }

    const contentData: any = {
      title: data.title,
      slug,
      content: data.content,
      status: data.status || 'draft',
      content_type_id: data.content_type_id,
      meta_description: data.meta_description,
      featured_image: data.featured_image,
      tags: data.tags || []
    };

    // Set published_at if status is published
    if (contentData.status === 'published') {
      contentData.published_at = new Date().toISOString();
    }

    return await this.contentStorage.create(contentData);
  }

  async updateContent(id: string, data: UpdateContentRequest): Promise<ContentItem | null> {
    const existingContent = await this.getContentById(id);
    if (!existingContent) {
      return null;
    }

    let updateData: any = { ...data };

    if (data.title && !data.slug) {
      const newSlug = this.generateSlug(data.title);
      if (newSlug !== existingContent.slug) {
        const existingWithSlug = await this.getContentBySlug(newSlug);
        if (existingWithSlug && existingWithSlug.id !== id) {
          throw new Error(`Content with slug "${newSlug}" already exists`);
        }
        updateData.slug = newSlug;
      }
    }

    if (data.status === 'published' && !existingContent.published_at) {
      updateData.published_at = new Date().toISOString();
    }

    return await this.contentStorage.update(id, updateData);
  }

  async deleteContent(id: string): Promise<boolean> {
    return await this.contentStorage.delete(id);
  }

  async getContentTypes(): Promise<ContentType[]> {
    return await this.contentTypeStorage.findAll({
      orderBy: { field: 'name', direction: 'asc' }
    });
  }

  async getContentTypeById(id: string): Promise<ContentType | null> {
    return await this.contentTypeStorage.findById(id);
  }

  async getContentTypeBySlug(slug: string): Promise<ContentType | null> {
    return await this.contentTypeStorage.findOne({ where: { slug } });
  }

  async createContentType(data: {
    name: string;
    slug?: string;
    description?: string;
    fields: ContentField[];
  }): Promise<ContentType> {
    const slug = data.slug || this.generateSlug(data.name);
    
    const existingType = await this.getContentTypeBySlug(slug);
    if (existingType) {
      throw new Error(`Content type with slug "${slug}" already exists`);
    }

    return await this.contentTypeStorage.create({
      name: data.name,
      slug,
      description: data.description,
      fields: data.fields
    } as any);
  }

  async updateContentType(id: string, data: {
    name?: string;
    slug?: string;
    description?: string;
    fields?: ContentField[];
  }): Promise<ContentType | null> {
    return await this.contentTypeStorage.update(id, data);
  }

  async deleteContentType(id: string): Promise<boolean> {
    const contentCount = await this.contentStorage.count({ where: { content_type_id: id } });
    if (contentCount > 0) {
      throw new Error('Cannot delete content type that has content items');
    }
    return await this.contentTypeStorage.delete(id);
  }

  async getMediaFiles(): Promise<MediaFile[]> {
    return await this.mediaStorage.findAll({
      orderBy: { field: 'created_at', direction: 'desc' }
    });
  }

  async getMediaFileById(id: string): Promise<MediaFile | null> {
    return await this.mediaStorage.findById(id);
  }

  async createMediaFile(data: {
    filename: string;
    original_name: string;
    mime_type: string;
    file_size: number;
    width?: number;
    height?: number;
    alt_text?: string;
    uploaded_by?: string;
  }): Promise<MediaFile> {
    return await this.mediaStorage.create(data as any);
  }

  async updateMediaFile(id: string, data: {
    alt_text?: string;
    filename?: string;
  }): Promise<MediaFile | null> {
    return await this.mediaStorage.update(id, data);
  }

  async deleteMediaFile(id: string): Promise<boolean> {
    return await this.mediaStorage.delete(id);
  }

  async searchContent(query: string, options: {
    fields?: string[];
    content_type_id?: string;
    status?: ContentItem['status'];
  } = {}): Promise<ContentItem[]> {
    let results = await this.contentStorage.search(
      query, 
      options.fields || ['title', 'content', 'meta_description']
    );

    if (options.content_type_id || options.status) {
      results = results.filter(item => {
        if (options.content_type_id && item.content_type_id !== options.content_type_id) {
          return false;
        }
        if (options.status && item.status !== options.status) {
          return false;
        }
        return true;
      });
    }

    return results;
  }

  async getContentStats(): Promise<{
    total: number;
    published: number;
    draft: number;
    archived: number;
    contentTypes: number;
    mediaFiles: number;
  }> {
    const [total, published, draft, archived, contentTypes, mediaFiles] = await Promise.all([
      this.contentStorage.count(),
      this.contentStorage.count({ where: { status: 'published' } }),
      this.contentStorage.count({ where: { status: 'draft' } }),
      this.contentStorage.count({ where: { status: 'archived' } }),
      this.contentTypeStorage.count(),
      this.mediaStorage.count()
    ]);

    return {
      total,
      published,
      draft,
      archived,
      contentTypes,
      mediaFiles
    };
  }

  async backupData(): Promise<{
    contentBackup: string;
    contentTypesBackup: string;
    mediaBackup: string;
  }> {
    const [contentBackup, contentTypesBackup, mediaBackup] = await Promise.all([
      this.contentStorage.backup(),
      this.contentTypeStorage.backup(),
      this.mediaStorage.backup()
    ]);

    return {
      contentBackup,
      contentTypesBackup,
      mediaBackup
    };
  }

  async restoreData(backupPaths: {
    contentBackup?: string;
    contentTypesBackup?: string;
    mediaBackup?: string;
  }): Promise<void> {
    const promises: Promise<void>[] = [];

    if (backupPaths.contentBackup) {
      promises.push(this.contentStorage.restore(backupPaths.contentBackup));
    }
    if (backupPaths.contentTypesBackup) {
      promises.push(this.contentTypeStorage.restore(backupPaths.contentTypesBackup));
    }
    if (backupPaths.mediaBackup) {
      promises.push(this.mediaStorage.restore(backupPaths.mediaBackup));
    }

    await Promise.all(promises);
  }
}