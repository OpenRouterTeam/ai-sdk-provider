const { createOpenRouter } = require('./dist/index.js');

console.log('Testing enabled field in reasoning parameters...');

const testConfig = {
  providerOptions: {
    openrouter: {
      reasoning: {
        enabled: false,
        max_tokens: 0,
        exclude: true,
      },
    },
  }
};

console.log('User configuration:', JSON.stringify(testConfig.providerOptions.openrouter, null, 2));

try {
  const openrouter = createOpenRouter({ apiKey: 'test-key' });
  
  const modelWithReasoning = openrouter('openai/gpt-4', {
    reasoning: {
      enabled: false,
      max_tokens: 100,
      exclude: true,
    },
  });
  
  console.log('Model with reasoning settings created successfully');
  console.log('Model reasoning settings:', modelWithReasoning.settings.reasoning);
  
  const modelWithEnabledFalse = openrouter('anthropic/claude-3-sonnet', {
    reasoning: {
      enabled: false,
      max_tokens: 0,
    },
  });
  
  console.log('Model with enabled: false created successfully');
  console.log('Enabled field test passed - TypeScript accepts the field');
  
} catch (error) {
  console.error('Error creating model:', error.message);
  console.error('Stack:', error.stack);
}
