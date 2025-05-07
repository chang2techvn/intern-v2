import type { Pool as PoolType, PoolClient } from 'pg';
import { createDatabaseSpan } from '../observability/middleware';
import { recordError } from '../observability/metrics';
import { getAwsSecretDatabaseConfig, getEnvDatabaseConfig } from '../utils/aws/database-config';

// Import the pg module using ESM import instead of require
import pg from 'pg';
const { Pool } = pg;

// Load dotenv to ensure environment variables are loaded correctly
import dotenv from 'dotenv';
dotenv.config();

// Secret name for AWS Secrets Manager
const DB_SECRET_NAME = process.env.DB_SECRET_NAME || 'mission-brief/database';
const USE_AWS_SECRETS = process.env.USE_AWS_SECRETS === 'true';

// Default database configuration from environment variables
let dbConfig = getEnvDatabaseConfig();

// Pool will be initialized asynchronously
// Using 'any' as a temporary solution to avoid TypeScript errors
let pool: any;

/**
 * Initialize the database pool with configuration from AWS Secrets Manager or environment variables
 */
export async function initializeDatabase() {
    try {
        // Check if we should use AWS Secrets Manager
        if (USE_AWS_SECRETS) {
            console.log('Retrieving database configuration from AWS Secrets Manager');
            console.log(`Using secret name: ${DB_SECRET_NAME}`);
            try {
                // Get database config from AWS Secrets Manager
                dbConfig = await getAwsSecretDatabaseConfig(DB_SECRET_NAME);
                console.log('Successfully retrieved configuration from AWS Secrets Manager');
            } catch (secretError) {
                console.error('Error retrieving from AWS Secrets Manager:', secretError);
                console.warn('Falling back to environment variables for database configuration.');
            }
        } else {
            console.log('Using database configuration from environment variables');
        }

        // Log sanitized configuration
        console.log('Database connection config:', {
            ...dbConfig,
            password: '******'
        });

        // Create the connection pool
        pool = new Pool(dbConfig);

        // Set up event handlers
        pool.on('connect', () => {
            console.log('Connected to PostgreSQL database');
        });

        pool.on('error', (err: Error) => {
            console.error('Unexpected error on idle client', err);
            recordError('database', 'connection_failure');
            process.exit(-1);
        });

        // Extend the default query method to add tracing
        const originalQuery = pool.query.bind(pool);
        pool.query = function tracedQuery(text: any, params?: any) {
            // Extract operation type and table if possible from the query
            const operation = text.trim().split(' ')[0]?.toUpperCase() || 'QUERY';
            // Try to extract table name from query
            let table = 'unknown';
            if (typeof text === 'string') {
                const tableMatch = text.match(/FROM\s+(\w+)/i);
                if (tableMatch && tableMatch[1]) {
                    table = tableMatch[1];
                } else {
                    // Try other patterns
                    const insertMatch = text.match(/INTO\s+(\w+)/i);
                    if (insertMatch && insertMatch[1]) {
                        table = insertMatch[1];
                    }
                    const updateMatch = text.match(/UPDATE\s+(\w+)/i);
                    if (updateMatch && updateMatch[1]) {
                        table = updateMatch[1];
                    }
                }
            }

            // Create a span for this database operation
            const dbSpan = createDatabaseSpan(operation, table, typeof text === 'string' ? text : text.text);
            
            // Call the original query method
            const result = originalQuery(text, params);
            
            // Handle both promise and callback styles
            if (result && typeof result.then === 'function') {
                return result.then((value: any) => {
                    dbSpan.end('success');
                    return value;
                }).catch((err: Error) => {
                    dbSpan.end('error');
                    recordError('database', `${operation}_error`);
                    throw err;
                });
            }
            
            return result;
        };

        // Test the connection
        const client = await pool.connect();
        console.log('Successfully connected to database');
        client.release();
        
        return pool;
    } catch (error) {
        console.error('Failed to initialize database:', error);
        recordError('database', 'initialization_failure');
        throw error;
    }
}

// Create a temporary pool that will be replaced once initialization is complete
pool = new Pool(dbConfig);

// Set up the same event handlers and query tracing for the temporary pool
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database (temporary pool)');
});

pool.on('error', (err: Error) => {
    console.error('Unexpected error on idle client', err);
    recordError('database', 'connection_failure');
    process.exit(-1);
});

// Extend the default query method to add tracing
const originalQuery = pool.query.bind(pool);
pool.query = function tracedQuery(text: any, params?: any) {
    // Extract operation type and table if possible from the query
    const operation = text.trim().split(' ')[0]?.toUpperCase() || 'QUERY';
    // Try to extract table name from query
    let table = 'unknown';
    if (typeof text === 'string') {
        const tableMatch = text.match(/FROM\s+(\w+)/i);
        if (tableMatch && tableMatch[1]) {
            table = tableMatch[1];
        } else {
            // Try other patterns
            const insertMatch = text.match(/INTO\s+(\w+)/i);
            if (insertMatch && insertMatch[1]) {
                table = insertMatch[1];
            }
            const updateMatch = text.match(/UPDATE\s+(\w+)/i);
            if (updateMatch && updateMatch[1]) {
                table = updateMatch[1];
            }
        }
    }

    // Create a span for this database operation
    const dbSpan = createDatabaseSpan(operation, table, typeof text === 'string' ? text : text.text);
    
    // Call the original query method
    const result = originalQuery(text, params);
    
    // Handle both promise and callback styles
    if (result && typeof result.then === 'function') {
        return result.then((value: any) => {
            dbSpan.end('success');
            return value;
        }).catch((err: Error) => {
            dbSpan.end('error');
            recordError('database', `${operation}_error`);
            throw err;
        });
    }
    
    return result;
};

// Utility function to set workspace context for RLS
export async function withWorkspaceContext(workspaceId: string, callback: (client: PoolClient) => Promise<any>) {
    const client = await pool.connect();
    try {
        await client.query(`SET LOCAL app.workspace_id = $1`, [workspaceId]);
        return await callback(client);
    } catch (err) {
        recordError('database', 'workspace_context_error');
        throw err;
    } finally {
        client.release();
    }
}

// Initialize database immediately (not with setTimeout) if not in test environment
// This ensures the AWS Secrets Manager connection is established before any operations
if (process.env.NODE_ENV !== 'test') {
    (async () => {
        try {
            console.log('Initializing database connection...');
            pool = await initializeDatabase();
            console.log('Database initialization completed successfully');
        } catch (err) {
            console.error('Failed to initialize database with AWS Secrets Manager:', err);
            console.warn('Using fallback database configuration from environment variables');
        }
    })();
}

export default pool;
