// src/utils/cache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheRecord<T> = {
  value: T;
  ts: number; // unix ms
  ttlMs: number; // time to live in ms
};

export async function setCache<T>(key: string, value: T, ttlSeconds = 86400) {
  const rec: CacheRecord<T> = { value, ts: Date.now(), ttlMs: ttlSeconds * 1000 };
  try {
    await AsyncStorage.setItem(key, JSON.stringify(rec));
  } catch (e) {
    // ignore cache set errors
    // eslint-disable-next-line no-console
    console.warn('Cache set error', e);
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const rec: CacheRecord<T> = JSON.parse(raw);
    if (!rec || typeof rec !== 'object') return null;
    if (Date.now() - rec.ts > (rec.ttlMs ?? 0)) {
      // expired
      await AsyncStorage.removeItem(key);
      return null;
    }
    return rec.value;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Cache get error', e);
    return null;
  }
}

export async function removeCache(key: string) {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {}
}
