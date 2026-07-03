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
        this.setLarge(`small_${key}`, value);
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
  }
};
