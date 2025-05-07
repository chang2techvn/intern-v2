import { 
  SecretsManagerClient, 
  GetSecretValueCommand,
  GetSecretValueCommandOutput
} from "@aws-sdk/client-secrets-manager";

/**
 * AWS Secrets Manager utility class for retrieving and caching secrets
 */
export class SecretsManager {
  private static instance: SecretsManager;
  private client: SecretsManagerClient;
  private cache: Map<string, { value: any, timestamp: number }> = new Map();
  private cacheTTL: number = 60 * 60 * 1000; // Default cache TTL: 1 hour

  /**
   * Create a SecretsManager instance with AWS region
   */
  private constructor(region: string = 'us-east-1') {
    this.client = new SecretsManagerClient({ region });
  }

  /**
   * Get the singleton instance of SecretsManager
   */
  public static getInstance(region?: string): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager(region);
    }
    return SecretsManager.instance;
  }

  /**
   * Set the TTL for cached secrets
   * @param ttlMs Time to live in milliseconds
   */
  public setCacheTTL(ttlMs: number): void {
    this.cacheTTL = ttlMs;
  }

  /**
   * Get a secret value by name
   * @param secretName The name or ARN of the secret
   * @param forceRefresh Force refresh from AWS (bypass cache)
   * @returns The secret value
   */
  public async getSecret(secretName: string, forceRefresh: boolean = false): Promise<any> {
    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedItem = this.cache.get(secretName);
      if (cachedItem && (Date.now() - cachedItem.timestamp < this.cacheTTL)) {
        console.log(`Using cached secret for: ${secretName}`);
        return cachedItem.value;
      }
    }

    try {
      // Retrieve from AWS Secrets Manager
      console.log(`Retrieving secret from AWS Secrets Manager: ${secretName}`);
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response: GetSecretValueCommandOutput = await this.client.send(command);
      
      let secretValue: any;
      if (response.SecretString) {
        try {
          // Try parsing as JSON
          secretValue = JSON.parse(response.SecretString);
        } catch (e) {
          // If not JSON, return as string
          secretValue = response.SecretString;
        }
      } else if (response.SecretBinary) {
        // Handle binary secret
        secretValue = response.SecretBinary;
      }

      // Update the cache
      this.cache.set(secretName, {
        value: secretValue,
        timestamp: Date.now()
      });

      return secretValue;
    } catch (error) {
      console.error(`Error retrieving secret ${secretName}:`, error);
      throw error;
    }
  }

  /**
   * Clear the entire secrets cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Remove a specific secret from the cache
   * @param secretName The name or ARN of the secret to remove from cache
   */
  public invalidateSecret(secretName: string): void {
    this.cache.delete(secretName);
  }
}

// Export a default instance
export default SecretsManager.getInstance();