/**
 * Example usage of 0G Compute Network models with OpenRouter AI SDK Provider
 * 
 * This example demonstrates how to use the 0G Compute Network models
 * through the OpenRouter provider for the Vercel AI SDK.
 */

import { openrouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

async function main() {
  // Example 1: Using Llama 3.3 70B Instruct model from 0G Compute Network
  console.log('🦙 Testing 0G Llama 3.3 70B Instruct model...');
  
  try {
    const { text } = await generateText({
      model: openrouter('0g/llama-3.3-70b-instruct'),
      prompt: 'Explain quantum computing in simple terms for a beginner.',
    });
    
    console.log('Response from 0G Llama 3.3 70B:');
    console.log(text);
    console.log('\n' + '='.repeat(80) + '\n');
  } catch (error) {
    console.error('Error with 0G Llama model:', error);
  }

  // Example 2: Using DeepSeek R1 70B reasoning model from 0G Compute Network
  console.log('🧠 Testing 0G DeepSeek R1 70B reasoning model...');
  
  try {
    const { text } = await generateText({
      model: openrouter('0g/deepseek-r1-70b'),
      prompt: 'Solve this step by step: If a train travels 120 km in 2 hours, what is its average speed in km/h and m/s?',
    });
    
    console.log('Response from 0G DeepSeek R1 70B:');
    console.log(text);
    console.log('\n' + '='.repeat(80) + '\n');
  } catch (error) {
    console.error('Error with 0G DeepSeek model:', error);
  }

  // Example 3: Using 0G models with custom settings
  console.log('⚙️  Testing 0G model with custom settings...');
  
  try {
    const { text } = await generateText({
      model: openrouter('0g/llama-3.3-70b-instruct', {
        temperature: 0.7,
        maxTokens: 150,
      }),
      prompt: 'Write a short poem about artificial intelligence and decentralization.',
    });
    
    console.log('Response from 0G Llama with custom settings:');
    console.log(text);
  } catch (error) {
    console.error('Error with custom settings:', error);
  }
}

// Run the examples
if (require.main === module) {
  main().catch(console.error);
}

export { main };
