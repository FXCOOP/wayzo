// Simple in-memory cache system
// In production, this would be replaced with Redis

class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttl = new Map(); // Time to live
    this.maxSize = 1000; // Maximum cache entries
  }

  // Set cache with TTL
  set(key, value, ttlSeconds = 300) {
    // Clean up expired entries
    this.cleanup();
    
    // Check cache size
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    this.cache.set(key, value);
    this.ttl.set(key, Date.now() + (ttlSeconds * 1000));
  }

  // Get cache value
  get(key) {
    const expiry = this.ttl.get(key);
    if (!expiry || Date.now() > expiry) {
      this.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  // Delete cache entry
  delete(key) {
    this.cache.delete(key);
    this.ttl.delete(key);
  }

  // Clear all cache
  clear() {
    this.cache.clear();
    this.ttl.clear();
  }

  // Get cache size
  size() {
    return this.cache.size;
  }

  // Check if key exists
  has(key) {
    const expiry = this.ttl.get(key);
    if (!expiry || Date.now() > expiry) {
      this.delete(key);
      return false;
    }
    return this.cache.has(key);
  }

  // Cleanup expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, expiry] of this.ttl.entries()) {
      if (now > expiry) {
        this.delete(key);
      }
    }
  }

  // Evict oldest entries
  evictOldest() {
    const entries = Array.from(this.ttl.entries());
    entries.sort((a, b) => a[1] - b[1]);
    
    const toDelete = Math.floor(this.maxSize * 0.1); // Delete 10% of oldest entries
    for (let i = 0; i < toDelete && i < entries.length; i++) {
      this.delete(entries[i][0]);
    }
  }

  // Get cache statistics
  getStats() {
    this.cleanup();
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize) * 100
    };
  }
}

// Cache middleware for Express
export function cacheMiddleware(ttlSeconds = 300) {
  return (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `${req.method}:${req.originalUrl}`;
    const cachedResponse = cache.get(cacheKey);
    
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    // Store original send method
    const originalSend = res.json;
    
    // Override send method to cache response
    res.json = function(data) {
      cache.set(cacheKey, data, ttlSeconds);
      return originalSend.call(this, data);
    };

    next();
  };
}

// Cache decorator for functions
export function cached(ttlSeconds = 300) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
      const cachedResult = cache.get(cacheKey);
      
      if (cachedResult) {
        return cachedResult;
      }
      
      const result = await originalMethod.apply(this, args);
      cache.set(cacheKey, result, ttlSeconds);
      return result;
    };
    
    return descriptor;
  };
}

// Initialize cache instance
export const cache = new CacheService();

// Cache invalidation helpers
export function invalidateCache(pattern) {
  const keys = Array.from(cache.cache.keys());
  const regex = new RegExp(pattern);
  
  for (const key of keys) {
    if (regex.test(key)) {
      cache.delete(key);
    }
  }
}

export function invalidateUserCache(userId) {
  invalidateCache(`.*user.*${userId}.*`);
  invalidateCache(`.*profile.*${userId}.*`);
  invalidateCache(`.*plans.*${userId}.*`);
}

export function invalidatePlanCache(planId) {
  invalidateCache(`.*plan.*${planId}.*`);
  invalidateCache(`.*plans.*`);
}

// Cache warming
export async function warmCache() {
  console.log('Warming cache...');
  
  // Warm popular destinations cache
  try {
    const popularDestinations = await db.prepare(`
      SELECT 
        json_extract(payload, '$.data.destination') as destination,
        COUNT(*) as count
      FROM plans
      WHERE json_extract(payload, '$.data.destination') IS NOT NULL
      GROUP BY destination
      ORDER BY count DESC
      LIMIT 10
    `).all();
    
    cache.set('popular_destinations', popularDestinations, 3600); // 1 hour
  } catch (error) {
    console.error('Failed to warm popular destinations cache:', error);
  }
  
  // Warm system stats cache
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE status = "active"').get();
    const planCount = db.prepare('SELECT COUNT(*) as count FROM plans').get();
    
    cache.set('system_stats', {
      users: userCount.count,
      plans: planCount.count,
      timestamp: new Date().toISOString()
    }, 1800); // 30 minutes
  } catch (error) {
    console.error('Failed to warm system stats cache:', error);
  }
  
  console.log('Cache warming completed');
}

// Scheduled cache cleanup
setInterval(() => {
  cache.cleanup();
}, 60000); // Clean up every minute

// Export cache instance and utilities
export default cache;