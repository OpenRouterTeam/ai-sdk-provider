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
  const instructions = missingVars.map((varName) => `  ${varName}=<your-value>`).join('\n');
  throw new Error(
    `E2E TEST SETUP FAILED\n` +
      `========================================\n` +
      `Missing required environment variables: ${missingVars.join(', ')}\n\n` +
      `To run e2e tests, create a .env.e2e file with:\n` +
      `${instructions}\n\n` +
      `Or set them in your environment before running tests.\n` +
      `========================================`,
  );
}

// Validate API key format (basic sanity check)
const apiKey = process.env.OPENROUTER_API_KEY;
if (apiKey && apiKey.length < 10) {
  throw new Error(
    `E2E TEST SETUP FAILED\n` +
      `========================================\n` +
      `OPENROUTER_API_KEY appears to be invalid (too short)\n\n` +
      `Please check your .env.e2e file or environment variables.\n` +
      `========================================`,
  );
}

console.log('E2E test environment validated successfully');
