import secretsManager from './secrets-manager';

// Define the shape of our database configuration
export interface DatabaseConfig {
  user: string;
  host: string;
  database: string;
  password: string;
  port: number;
}

// Define the expected shape of our database secret
interface DatabaseSecret {
  username: string;
  password: string;
  host: string;
  database?: string;
  port?: number;
}

/**
 * Get database configuration from environment variables
 * @returns Database configuration object
 */
export function getEnvDatabaseConfig(): DatabaseConfig {
  const isInDocker = process.env.DOCKER_CONTAINER === 'true';
  
  return {
    user: process.env.DB_USER || 'mission_brief',
    host: isInDocker ? (process.env.DB_HOST || 'postgres') : (process.env.DB_HOST || 'localhost'),
    database: process.env.DB_NAME || 'mission_brief',
    password: process.env.DB_PASSWORD || 'mission123',
    port: parseInt(process.env.DB_PORT || '5432'),
  };
}

/**
 * Get database configuration from AWS Secrets Manager
 * @param secretName The name or ARN of the secret in AWS Secrets Manager
 * @returns Database configuration object
 */
export async function getAwsSecretDatabaseConfig(secretName: string): Promise<DatabaseConfig> {
  try {
    // Get the secret from AWS Secrets Manager
    const secretData = await secretsManager.getSecret(secretName);
    
    if (!secretData || typeof secretData !== 'object') {
      console.warn('Invalid secret format received from AWS Secrets Manager. Falling back to environment variables.');
      return getEnvDatabaseConfig();
    }

    // Convert to expected format
    const dbSecret = secretData as DatabaseSecret;
    
    // Validate required fields
    if (!dbSecret.username || !dbSecret.password || !dbSecret.host) {
      console.warn('Missing required database credentials in AWS secret. Falling back to environment variables.');
      return getEnvDatabaseConfig();
    }

    // Use values from the secret or fallback to environment variables for optional fields
    const isInDocker = process.env.DOCKER_CONTAINER === 'true';
    
    return {
      user: dbSecret.username,
      password: dbSecret.password,
      host: isInDocker && dbSecret.host === 'localhost' ? 'postgres' : dbSecret.host,
      database: dbSecret.database || process.env.DB_NAME || 'mission_brief',
      port: dbSecret.port || parseInt(process.env.DB_PORT || '5432'),
    };
  } catch (error) {
    console.error('Error retrieving database config from AWS Secrets Manager:', error);
    console.warn('Falling back to environment variables for database configuration.');
    return getEnvDatabaseConfig();
  }
}