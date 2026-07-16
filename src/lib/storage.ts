import { get, set, del, clear } from 'idb-keyval';

/**
 * Quota-safe storage utility for Pbazar Admin.
 * Uses IndexedDB for large datasets (orders, products) to avoid LocalStorage 5MB limit.
 * Falls back to LocalStorage for small config items if needed.
 */
export const Storage = {
  // Large data sets (IndexedDB)
  async setLarge(key: string, value: any): Promise<void> {
    try {
      await set(key, value);
    } catch (error) {
      console.error(`Error saving ${key} to IndexedDB:`, error);
    }
  },

  async getLarge<T>(key: string): Promise<T | null> {
    try {
      const val = await get(key);
      return val as T || null;
    } catch (error) {
      console.error(`Error reading ${key} from IndexedDB:`, error);
      return null;
    }
  },

  async removeLarge(key: string): Promise<void> {
    await del(key);
  },

  async clearAllLarge(): Promise<void> {
    await clear();
  },

  // Small config (LocalStorage)
  setSmall(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('LocalStorage full, falling back to IndexedDB for small item');
        Storage.setLarge(`small_${key}`, value);
      }
    }
  },

  getSmall<T>(key: string): T | null {
    const item = localStorage.getItem(key);
    if (item) {
      try {
        return JSON.parse(item) as T;
      } catch {
        return item as unknown as T;
      }
    }
    return null;
  },

  removeSmall(key: string): void {
    localStorage.removeItem(key);
  },

  // Background Backup System
  async backupOrders(orders: any[]): Promise<void> {
    if (!orders || orders.length === 0) return;
    
    try {
      const existingBackup = await Storage.getLarge<any[]>('orders_history_backup') || [];
      
      // Merge new orders with existing backup (avoid duplicates by ID)
      const merged = [...existingBackup];
      const existingIds = new Set(existingBackup.map(o => o.id));
      
      orders.forEach(order => {
        if (!existingIds.has(order.id)) {
          merged.push(order);
        } else {
          // Update existing order in backup
          const idx = merged.findIndex(o => o.id === order.id);
          if (idx !== -1) merged[idx] = order;
        }
      });

      // Keep only last 1000 orders in backup to prevent IndexedDB bloat
      const trimmed = merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 1000);
      
      await Storage.setLarge('orders_history_backup', trimmed);
      Storage.setSmall('last_backup_timestamp', new Date().toISOString());
      console.log('Background order backup completed:', trimmed.length, 'orders');
    } catch (error) {
      console.error('Background backup failed:', error);
    }
  },

  async getBackupOrders(): Promise<any[]> {
    return await Storage.getLarge<any[]>('orders_history_backup') || [];
  },

  // Product Backup System
  async backupProducts(products: any[]): Promise<void> {
    if (!products || products.length === 0) return;
    try {
      await Storage.setLarge('products_backup', products);
      Storage.setSmall('last_products_backup', new Date().toISOString());
    } catch (error) {
      console.error('Product backup failed:', error);
    }
  },

  async getBackupProducts(): Promise<any[]> {
    return await Storage.getLarge<any[]>('products_backup') || [];
  }
};
