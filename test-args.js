// Test to verify the max_tokens fix by checking the actual arguments generated
const { createOpenRouter } = require('./dist/index.js');

const openrouter = createOpenRouter({
  apiKey: 'test-key',
});

// Test case 1: GPT-5 model with Azure-only routing (should use max_completion_tokens)
const gpt5AzureModel = openrouter('openai/gpt-5.2-chat', {
  provider: {
    only: ['azure']
  }
});

// Test case 2: GPT-5 model without Azure-only routing (should use max_tokens)
const gpt5GeneralModel = openrouter('openai/gpt-5.2-chat');

// Test case 3: Non-GPT-5 model with Azure-only routing (should use max_tokens)
const gpt4AzureModel = openrouter('openai/gpt-4o', {
  provider: {
    only: ['azure']
  }
});

// Access the private getArgs method via reflection to test the logic
function testGetArgs(model, maxOutputTokens = 1000) {
  const options = {
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
    maxOutputTokens,
    temperature: 0.7,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    seed: undefined,
    stopSequences: undefined,
    responseFormat: undefined,
    topK: undefined,
    tools: undefined,
    toolChoice: undefined,
  };
  
  // Call the private getArgs method
  const args = model.getArgs(options);
  return args;
}

try {
  console.log('Testing GPT-5 + Azure only (should have max_completion_tokens):');
  const args1 = testGetArgs(gpt5AzureModel);
  console.log('Has max_tokens:', 'max_tokens' in args1);
  console.log('Has max_completion_tokens:', 'max_completion_tokens' in args1);
  
  console.log('\nTesting GPT-5 + General (should have max_tokens):');
  const args2 = testGetArgs(gpt5GeneralModel);
  console.log('Has max_tokens:', 'max_tokens' in args2);
  console.log('Has max_completion_tokens:', 'max_completion_tokens' in args2);
  
  console.log('\nTesting GPT-4 + Azure only (should have max_tokens):');
  const args3 = testGetArgs(gpt4AzureModel);
  console.log('Has max_tokens:', 'max_tokens' in args3);
  console.log('Has max_completion_tokens:', 'max_completion_tokens' in args3);
  
} catch (error) {
  console.error('Error accessing getArgs method:', error.message);
  console.log('This is expected since getArgs is private. Let me try a different approach...');
}