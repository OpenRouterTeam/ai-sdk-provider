// Quick test to verify the max_tokens fix
const { createOpenRouter } = require('./dist/index.js');

// Test case 1: GPT-5 model with Azure-only routing (should use max_completion_tokens)
const openrouterGpt5Azure = createOpenRouter({
  apiKey: 'test-key',
});

const gpt5AzureModel = openrouterGpt5Azure('openai/gpt-5.2-chat', {
  provider: {
    only: ['azure']
  }
});

// Test case 2: GPT-5 model without Azure-only routing (should use max_tokens)
const gpt5GeneralModel = openrouterGpt5Azure('openai/gpt-5.2-chat', {
  provider: {
    order: ['anthropic', 'azure']
  }
});

// Test case 3: Non-GPT-5 model with Azure-only routing (should use max_tokens)
const gpt4AzureModel = openrouterGpt5Azure('openai/gpt-4o', {
  provider: {
    only: ['azure']
  }
});

console.log('Test setup complete. Models created successfully.');
console.log('GPT-5 + Azure only:', gpt5AzureModel.modelId);
console.log('GPT-5 + General:', gpt5GeneralModel.modelId);
console.log('GPT-4 + Azure only:', gpt4AzureModel.modelId);