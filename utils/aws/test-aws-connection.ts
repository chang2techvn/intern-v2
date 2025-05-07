import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * A simple test to check if we can connect to AWS Secrets Manager
 */
async function testAwsSecretsManagerConnection() {
  console.log('============================================');
  console.log('Testing AWS Secrets Manager Connection');
  console.log('============================================');
  
  // Check if AWS credentials are set
  const hasAwsCredentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
  console.log(`AWS credentials found: ${hasAwsCredentials ? 'Yes' : 'No'}`);
  
  if (!hasAwsCredentials) {
    console.error('❌ AWS credentials not found in environment variables.');
    console.error('Please make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set.');
    return;
  }
  
  // Create a secrets manager client with region from env or default to us-east-1
  const region = process.env.AWS_REGION || 'us-east-1';
  console.log(`Using AWS region: ${region}`);
  
  const client = new SecretsManagerClient({ region });
  
  // Use the actual DB_SECRET_NAME from environment variables
  const secretName = process.env.DB_SECRET_NAME;
  
  if (!secretName) {
    console.error('\n❌ DB_SECRET_NAME is not defined in environment variables');
    console.error('   Please check your .env file and make sure DB_SECRET_NAME is set');
    return;
  }
  
  console.log(`\nAttempting to connect to AWS Secrets Manager and retrieve secret: ${secretName}`);
  console.log('This will verify if the connection to AWS Secrets Manager is working...');
  
  try {
    // Try to get a secret to test the connection
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);
    
    console.log('\n✅ Successfully connected to AWS Secrets Manager!');
    console.log('   Connection test passed.');
    
    if (response.SecretString) {
      console.log('   Secret was retrieved successfully.');
      
      try {
        // Try to parse the secret as JSON
        const secretValue = JSON.parse(response.SecretString);
        console.log('   Secret contains the following keys:', Object.keys(secretValue).join(', '));
        
        // Check if it contains database credentials
        const hasDbCredentials = secretValue.username && secretValue.password && secretValue.host;
        console.log(`   Contains valid database credentials: ${hasDbCredentials ? 'Yes' : 'No'}`);
        
        if (!hasDbCredentials) {
          console.warn('   ⚠️ Secret does not contain complete database credentials.');
          console.warn('   Required fields: username, password, host');
        }
      } catch (e) {
        console.log('   Secret is not in JSON format.');
      }
    } else if (response.SecretBinary) {
      console.log('   Binary secret was retrieved successfully.');
    }
  } catch (error: any) {
    console.error('\n❌ Failed to connect to AWS Secrets Manager');
    
    if (error.name === 'ResourceNotFoundException') {
      console.error(`   Secret "${secretName}" was not found.`);
      console.error('   Please check that the secret name is correct.');
    } else if (error.name === 'AccessDeniedException') {
      console.error('   Access denied. Check your AWS credentials and permissions.');
      console.error('   Make sure your IAM user/role has secretsmanager:GetSecretValue permission.');
    } else if (error.name === 'UnrecognizedClientException') {
      console.error('   Invalid AWS credentials. Check your access key and secret key.');
    } else {
      console.error('   Error details:', error.message);
    }
  }
  
  console.log('\n============================================');
}

// Run the test
testAwsSecretsManagerConnection()
  .then(() => console.log('Test completed.'))
  .catch((error) => console.error('Test failed with unexpected error:', error));