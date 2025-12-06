import { config } from 'dotenv';

// Load .env.e2e file
const result = config({
  path: '.env.e2e',
});
console.log(`injecting env (${Object.keys(result.parsed ?? {}).length}) from .env.e2e`);

// Fail fast if required environment variables are missing
const requiredEnvVars = [
  'OPENROUTER_API_KEY',
] as const;

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('\n========================================');
  console.error('E2E TEST SETUP FAILED');
  console.error('========================================');
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('\nTo run e2e tests, create a .env.e2e file with:');
  for (const varName of missingVars) {
    console.error(`  ${varName}=<your-value>`);
  }
  console.error('\nOr set them in your environment before running tests.');
  console.error('========================================\n');
  process.exit(1);
}

// Validate API key format (basic sanity check)
const apiKey = process.env.OPENROUTER_API_KEY;
if (apiKey && apiKey.length < 10) {
  console.error('\n========================================');
  console.error('E2E TEST SETUP FAILED');
  console.error('========================================');
  console.error('OPENROUTER_API_KEY appears to be invalid (too short)');
  console.error('Please check your .env.e2e file or environment variables.');
  console.error('========================================\n');
  process.exit(1);
}

console.log('E2E test environment validated successfully');
