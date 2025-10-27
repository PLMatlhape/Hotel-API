// Simple in-memory cache and lock helper for development / smoke tests
type LockCallback<T> = () => Promise<T>;

const store = new Map<string, { value: any; expiresAt?: number | undefined }>();
export const CachePrefix = {
  BOOKING: 'booking:',
  USER_BOOKINGS: 'user_bookings:',
  AVAILABILITY: 'availability:',
  BOOKING_STATS: 'booking_stats:',
} as const;

export const get = async (key: string) => {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
};

export const set = async (key: string, value: any, ttlSeconds?: number) => {
  store.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
  });
};

export const del = async (key: string) => {
  store.delete(key);
};

export const delPattern = async (pattern: string) => {
  const prefix = pattern.replace('*', '');
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
};

// Simple (non-distributed) lock helper
export const withLock = async <T>(key: string, callback: LockCallback<T>, timeout = 10000): Promise<T> => {
  const lockKey = `__lock__${key}`;
  const start = Date.now();
  while (store.has(lockKey)) {
    if (Date.now() - start > timeout) throw new Error('Lock timeout');
    await new Promise(res => setTimeout(res, 100));
  }
  store.set(lockKey, { value: true });
  try {
    const result = await callback();
    return result;
  } finally {
    store.delete(lockKey);
  }
};

export const Cache = {
  Prefix: CachePrefix,
};

export default {
  get,
  set,
  del,
  delPattern,
  withLock,
  CachePrefix,
};
