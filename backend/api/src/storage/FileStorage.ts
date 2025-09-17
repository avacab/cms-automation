import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface StorageItem {
  id: string;
  [key: string]: any;
}

interface QueryOptions {
  where?: Record<string, any>;
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
}

export class FileStorage<T extends StorageItem> {
  private filePath: string;
  private data: T[] = [];
  private isLoaded: boolean = false;

  constructor(fileName: string) {
    const storageDir = path.join(process.cwd(), 'data');
    this.filePath = path.join(storageDir, `${fileName}.json`);
    this.ensureStorageDir();
  }

  private async ensureStorageDir(): Promise<void> {
    const storageDir = path.dirname(this.filePath);
    try {
      await fs.access(storageDir);
    } catch {
      await fs.mkdir(storageDir, { recursive: true });
    }
  }

  private async loadData(): Promise<void> {
    if (this.isLoaded) return;

    try {
      const fileContent = await fs.readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(fileContent) || [];
    } catch (error) {
      // File doesn't exist or is invalid, start with empty array
      this.data = [];
      await this.saveData();
    }
    this.isLoaded = true;
  }

  private async saveData(): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
  }

  private generateId(): string {
    return uuidv4();
  }

  private matchesQuery(item: T, where: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(where)) {
      if (key.includes('.')) {
        // Handle nested properties like 'content.title'
        const keys = key.split('.');
        let current: any = item;
        for (const k of keys) {
          if (current && typeof current === 'object') {
            current = current[k];
          } else {
            current = undefined;
            break;
          }
        }
        if (current !== value) return false;
      } else {
        if (item[key] !== value) return false;
      }
    }
    return true;
  }

  async create(data: Omit<T, 'id'> & Partial<Pick<T, 'id'>>): Promise<T> {
    await this.loadData();
    
    const item: T = {
      ...data,
      id: data.id || this.generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as unknown as T;

    this.data.push(item);
    await this.saveData();
    
    return item;
  }

  async findById(id: string): Promise<T | null> {
    await this.loadData();
    return this.data.find(item => item.id === id) || null;
  }

  async findAll(options: QueryOptions = {}): Promise<T[]> {
    await this.loadData();
    let results = [...this.data];

    // Apply where clause
    if (options.where) {
      results = results.filter(item => this.matchesQuery(item, options.where!));
    }

    // Apply ordering
    if (options.orderBy) {
      const { field, direction } = options.orderBy;
      results.sort((a, b) => {
        const aVal = field.includes('.') ? this.getNestedValue(a, field) : a[field];
        const bVal = field.includes('.') ? this.getNestedValue(b, field) : b[field];
        
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply pagination
    if (options.offset) {
      results = results.slice(options.offset);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async findOne(options: QueryOptions = {}): Promise<T | null> {
    const results = await this.findAll({ ...options, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  async update(id: string, data: Partial<Omit<T, 'id'>>): Promise<T | null> {
    await this.loadData();
    
    const index = this.data.findIndex(item => item.id === id);
    if (index === -1) return null;

    const updatedItem: T = {
      ...this.data[index],
      ...data,
      id, // Ensure ID doesn't change
      updated_at: new Date().toISOString()
    } as T;

    this.data[index] = updatedItem;
    await this.saveData();
    
    return updatedItem;
  }

  async delete(id: string): Promise<boolean> {
    await this.loadData();
    
    const index = this.data.findIndex(item => item.id === id);
    if (index === -1) return false;

    this.data.splice(index, 1);
    await this.saveData();
    
    return true;
  }

  async count(options: QueryOptions = {}): Promise<number> {
    const results = await this.findAll(options);
    return results.length;
  }

  async exists(id: string): Promise<boolean> {
    const item = await this.findById(id);
    return item !== null;
  }

  async clear(): Promise<void> {
    this.data = [];
    await this.saveData();
  }

  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current && typeof current === 'object') {
        current = current[key];
      } else {
        return undefined;
      }
    }
    return current;
  }

  // Backup and restore functionality
  async backup(backupPath?: string): Promise<string> {
    await this.loadData();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultBackupPath = path.join(
      path.dirname(this.filePath),
      'backups',
      `${path.basename(this.filePath, '.json')}_backup_${timestamp}.json`
    );
    
    const targetPath = backupPath || defaultBackupPath;
    
    // Ensure backup directory exists
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    
    // Copy current data to backup
    await fs.writeFile(targetPath, JSON.stringify(this.data, null, 2));
    
    return targetPath;
  }

  async restore(backupPath: string): Promise<void> {
    try {
      const backupContent = await fs.readFile(backupPath, 'utf-8');
      this.data = JSON.parse(backupContent);
      await this.saveData();
      this.isLoaded = true;
    } catch (error) {
      throw new Error(`Failed to restore from backup: ${(error as Error).message}`);
    }
  }

  // Advanced query methods
  async search(searchTerm: string, fields: string[] = []): Promise<T[]> {
    await this.loadData();
    
    return this.data.filter(item => {
      const searchFields = fields.length > 0 ? fields : Object.keys(item);
      
      return searchFields.some(field => {
        const value = field.includes('.') ? this.getNestedValue(item, field) : item[field];
        return value && 
               typeof value === 'string' && 
               value.toLowerCase().includes(searchTerm.toLowerCase());
      });
    });
  }

  async aggregate(groupBy: string): Promise<Record<string, T[]>> {
    await this.loadData();
    
    const groups: Record<string, T[]> = {};
    
    for (const item of this.data) {
      const key = groupBy.includes('.') ? this.getNestedValue(item, groupBy) : item[groupBy];
      const groupKey = String(key || 'null');
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    }
    
    return groups;
  }

  // Transaction-like batch operations
  async batch(operations: Array<{
    type: 'create' | 'update' | 'delete';
    id?: string;
    data?: any;
  }>): Promise<{ success: boolean; results: any[]; errors: string[] }> {
    await this.loadData();
    
    const results: any[] = [];
    const errors: string[] = [];
    const originalData = JSON.parse(JSON.stringify(this.data)); // Deep copy for rollback
    
    try {
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        
        switch (op.type) {
          case 'create':
            if (!op.data) {
              errors.push(`Operation ${i}: Missing data for create operation`);
              continue;
            }
            const created = await this.create(op.data);
            results.push({ type: 'create', result: created });
            break;
            
          case 'update':
            if (!op.id || !op.data) {
              errors.push(`Operation ${i}: Missing id or data for update operation`);
              continue;
            }
            const updated = await this.update(op.id, op.data);
            results.push({ type: 'update', result: updated });
            break;
            
          case 'delete':
            if (!op.id) {
              errors.push(`Operation ${i}: Missing id for delete operation`);
              continue;
            }
            const deleted = await this.delete(op.id);
            results.push({ type: 'delete', result: deleted });
            break;
            
          default:
            errors.push(`Operation ${i}: Unknown operation type ${op.type}`);
        }
      }
      
      if (errors.length === 0) {
        return { success: true, results, errors: [] };
      } else {
        // Rollback on any errors
        this.data = originalData;
        await this.saveData();
        return { success: false, results: [], errors };
      }
      
    } catch (error) {
      // Rollback on exception
      this.data = originalData;
      await this.saveData();
      return { success: false, results: [], errors: [(error as Error).message] };
    }
  }

  // Get storage statistics
  async getStats(): Promise<{
    totalItems: number;
    fileSize: string;
    lastModified: string;
    filePath: string;
  }> {
    await this.loadData();
    
    try {
      const stats = await fs.stat(this.filePath);
      return {
        totalItems: this.data.length,
        fileSize: `${(stats.size / 1024).toFixed(2)} KB`,
        lastModified: stats.mtime.toISOString(),
        filePath: this.filePath
      };
    } catch (error) {
      return {
        totalItems: this.data.length,
        fileSize: '0 KB',
        lastModified: new Date().toISOString(),
        filePath: this.filePath
      };
    }
  }
}