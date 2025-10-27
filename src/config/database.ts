import { Pool, PoolConfig, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration with production-ready settings
const config: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hotel_booking_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  
  // Connection pool optimization
  max: parseInt(process.env.DB_POOL_MAX || '50'), // Max connections
  min: parseInt(process.env.DB_POOL_MIN || '10'), // Min connections
  idleTimeoutMillis: 30000, // Close idle clients after 30s
  connectionTimeoutMillis: 5000, // Connection timeout
  maxUses: 7500, // Max uses before recycling connection
  
  // Performance optimizations
  allowExitOnIdle: false,
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false,
    ca: process.env.DB_SSL_CA,
  } : false,
  
  // Query timeout
  statement_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
};

// Create connection pool
const pool = new Pool(config);

// Pool event handlers
pool.on('connect', (client: PoolClient) => {
  console.log('✅ New database client connected');
  
  // Set session parameters for performance
  client.query(`
    SET statement_timeout = '30s';
    SET idle_in_transaction_session_timeout = '60s';
    SET lock_timeout = '10s';
  `).catch((err: any) => console.error('Error setting session params:', err));
});

pool.on('acquire', () => {
  console.log('📊 Client acquired from pool');
});

pool.on('remove', () => {
  console.log('🔄 Client removed from pool');
});

pool.on('error', (err: Error, client: PoolClient) => {
  console.error('❌ Unexpected database error:', err);
  // Don't exit process, let error handler manage it
});

// Query execution with retry logic
export const query = async (text: string, params?: any[], retries = 3): Promise<any> => {
  const start = Date.now();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries
      if (duration > 1000) {
        console.warn('⚠️ Slow query detected:', {
          duration: `${duration}ms`,
          query: text.substring(0, 100),
          rows: res.rowCount
        });
      }
      
      return res;
    } catch (error: any) {
      console.error(`Query attempt ${attempt}/${retries} failed:`, error.message);
      
      // Retry on connection errors
      if (attempt < retries && (
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        error.code === '57P01' // Connection terminated
      )) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      throw error;
    }
  }
};

// Get client with automatic release
export const getClient = async (): Promise<PoolClient> => {
  const client = await pool.connect();
  
  // Wrap release to ensure it's called
  const originalRelease = client.release.bind(client);
  let released = false;
  
  // Replace release with a safe wrapper that only releases once
  client.release = (() => {
    return () => {
      if (!released) {
        released = true;
        originalRelease();
      }
    };
  })() as any;
  
  return client;
};

// Transaction wrapper with automatic rollback
export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Batch query execution for bulk operations
export const batchQuery = async (queries: Array<{ text: string; params?: any[] }>) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const results = [];
    for (const q of queries) {
      const result = await client.query(q.text, q.params);
      results.push(result);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Health check with detailed info
export const testConnection = async (): Promise<boolean> => {
  try {
    const result = await query('SELECT NOW(), version(), current_database()');
    console.log('✅ Database connection successful:', {
      timestamp: result.rows[0].now,
      database: result.rows[0].current_database,
      poolSize: pool.totalCount,
      idleClients: pool.idleCount,
      waitingClients: pool.waitingCount
    });
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

// Get pool statistics
export const getPoolStats = () => ({
  totalCount: pool.totalCount,
  idleCount: pool.idleCount,
  waitingCount: pool.waitingCount,
});

// Graceful shutdown with connection draining
export const closePool = async (timeout: number = 10000): Promise<void> => {
  console.log('🔌 Closing database pool...');
  
  const drainPromise = pool.end();
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Pool drain timeout')), timeout)
  );
  
  try {
    await Promise.race([drainPromise, timeoutPromise]);
    console.log('✅ Database pool closed successfully');
  } catch (error) {
    console.error('⚠️ Error closing pool:', error);
    // Force close remaining connections
    pool.removeAllListeners();
  }
};

// Prepared statement cache for frequently used queries
const preparedStatements: Map<string, string> = new Map();

export const prepareStatement = (name: string, query: string) => {
  preparedStatements.set(name, query);
};

export const executePrepared = async (name: string, params?: any[]) => {
  const queryText = preparedStatements.get(name);
  if (!queryText) {
    throw new Error(`Prepared statement '${name}' not found`);
  }
  return query(queryText, params);
};

export default pool;