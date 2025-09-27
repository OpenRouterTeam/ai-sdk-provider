/**
 * Text Generation Examples with 0G Compute Network Models
 * 
 * This file demonstrates various text generation capabilities of 0G Compute models
 * including creative writing, technical explanations, code generation, and reasoning.
 */

import { openrouter } from '@openrouter/ai-sdk-provider';
import { generateText, streamText } from 'ai';

// Configuration for different text generation scenarios
const MODELS = {
  LLAMA: '0g/llama-3.3-70b-instruct',
  DEEPSEEK: '0g/deepseek-r1-70b',
} as const;

/**
 * Creative Writing Examples
 */
async function creativeWritingExamples() {
  console.log('🎨 Creative Writing Examples\n');

  // Short story generation
  console.log('📚 Generating a short story...');
  const { text: story } = await generateText({
    model: openrouter(MODELS.LLAMA),
    prompt: 'Write a short science fiction story (300 words) about an AI that discovers emotions for the first time.',
    temperature: 0.8,
    maxTokens: 400,
  });
  console.log(story);
  console.log('\n' + '='.repeat(80) + '\n');

  // Poetry generation
  console.log('🎭 Generating a poem...');
  const { text: poem } = await generateText({
    model: openrouter(MODELS.LLAMA),
    prompt: 'Write a haiku about the beauty of decentralized technology and human connection.',
    temperature: 0.7,
    maxTokens: 100,
  });
  console.log(poem);
  console.log('\n' + '='.repeat(80) + '\n');

  // Dialogue generation
  console.log('💬 Generating dialogue...');
  const { text: dialogue } = await generateText({
    model: openrouter(MODELS.LLAMA),
    prompt: 'Write a dialogue between a curious child and a wise AI about what makes humans special.',
    temperature: 0.6,
    maxTokens: 300,
  });
  console.log(dialogue);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Technical Explanation Examples
 */
async function technicalExplanationExamples() {
  console.log('🔬 Technical Explanation Examples\n');

  // Complex concept explanation
  console.log('🧠 Explaining quantum computing...');
  const { text: quantum } = await generateText({
    model: openrouter(MODELS.LLAMA),
    prompt: 'Explain quantum computing in simple terms, using analogies that a high school student would understand.',
    temperature: 0.3,
    maxTokens: 400,
  });
  console.log(quantum);
  console.log('\n' + '='.repeat(80) + '\n');

  // Blockchain explanation
  console.log('⛓️ Explaining blockchain technology...');
  const { text: blockchain } = await generateText({
    model: openrouter(MODELS.LLAMA),
    prompt: 'Explain how blockchain technology works, focusing on decentralization and trust mechanisms.',
    temperature: 0.2,
    maxTokens: 350,
  });
  console.log(blockchain);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Code Generation Examples
 */
async function codeGenerationExamples() {
  console.log('💻 Code Generation Examples\n');

  // Python function
  console.log('🐍 Generating Python code...');
  const { text: pythonCode } = await generateText({
    model: openrouter(MODELS.LLAMA),
    prompt: 'Write a Python class for a simple blockchain implementation with methods to add blocks, validate the chain, and calculate proof of work.',
    temperature: 0.1,
    maxTokens: 500,
  });
  console.log(pythonCode);
  console.log('\n' + '='.repeat(80) + '\n');

  // JavaScript function
  console.log('🟨 Generating JavaScript code...');
  const { text: jsCode } = await generateText({
    model: openrouter(MODELS.LLAMA),
    prompt: 'Write a JavaScript function that implements a simple neural network with forward propagation for binary classification.',
    temperature: 0.1,
    maxTokens: 400,
  });
  console.log(jsCode);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Reasoning and Problem Solving Examples
 */
async function reasoningExamples() {
  console.log('🧮 Reasoning and Problem Solving Examples\n');

  // Mathematical reasoning
  console.log('📐 Solving a math problem...');
  const { text: mathSolution } = await generateText({
    model: openrouter(MODELS.DEEPSEEK),
    prompt: 'Solve this step by step: A company\'s profit increases by 15% each year. If they made $100,000 in profit in 2020, what will their profit be in 2025? Show all calculations.',
    temperature: 0.1,
    maxTokens: 300,
  });
  console.log(mathSolution);
  console.log('\n' + '='.repeat(80) + '\n');

  // Logic puzzle
  console.log('🧩 Solving a logic puzzle...');
  const { text: logicSolution } = await generateText({
    model: openrouter(MODELS.DEEPSEEK),
    prompt: 'Solve this logic puzzle: Five friends (Alice, Bob, Charlie, Diana, Eve) sit in a row. Alice is not at either end. Bob is somewhere to the left of Charlie. Diana is next to Eve. Charlie is not next to Alice. What is the seating arrangement?',
    temperature: 0.1,
    maxTokens: 400,
  });
  console.log(logicSolution);
  console.log('\n' + '='.repeat(80) + '\n');

  // Code debugging
  console.log('🐛 Debugging code...');
  const { text: debugging } = await generateText({
    model: openrouter(MODELS.DEEPSEEK),
    prompt: `Analyze this Python code and explain the bugs, then provide a corrected version:

def calculate_average(numbers):
    total = 0
    for i in range(len(numbers)):
        total += numbers[i]
    average = total / len(numbers)
    return average

# Test
nums = [1, 2, 3, 4, 5]
print(calculate_average(nums))
print(calculate_average([]))  # This will cause an error`,
    temperature: 0.1,
    maxTokens: 400,
  });
  console.log(debugging);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Streaming Text Generation Example
 */
async function streamingExample() {
  console.log('🌊 Streaming Text Generation Example\n');
  
  console.log('📝 Streaming a detailed explanation...');
  const { textStream } = await streamText({
    model: openrouter(MODELS.LLAMA),
    prompt: 'Write a comprehensive explanation of how machine learning models are trained, including data preparation, model architecture, training process, and evaluation.',
    temperature: 0.4,
    maxTokens: 600,
  });

  for await (const delta of textStream) {
    process.stdout.write(delta);
  }
  
  console.log('\n\n' + '='.repeat(80) + '\n');
}

/**
 * Multi-turn Conversation Example
 */
async function conversationExample() {
  console.log('💭 Multi-turn Conversation Example\n');

  const messages = [
    { role: 'user' as const, content: 'What is artificial intelligence?' },
    { role: 'assistant' as const, content: 'Artificial Intelligence (AI) is a branch of computer science that aims to create machines capable of performing tasks that typically require human intelligence, such as learning, reasoning, problem-solving, and understanding natural language.' },
    { role: 'user' as const, content: 'How does it relate to the 0G network?' },
  ];

  console.log('🤖 AI explaining its relationship to 0G network...');
  const { text } = await generateText({
    model: openrouter(MODELS.LLAMA),
    messages,
    temperature: 0.5,
    maxTokens: 300,
  });
  
  console.log(text);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Main function to run all examples
 */
async function main() {
  console.log('🚀 0G Compute Network Text Generation Examples\n');
  console.log('This demo showcases various text generation capabilities of 0G models.\n');
  console.log('='.repeat(80) + '\n');

  try {
    await creativeWritingExamples();
    await technicalExplanationExamples();
    await codeGenerationExamples();
    await reasoningExamples();
    await streamingExample();
    await conversationExample();
    
    console.log('✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Export for use in other files
export {
  creativeWritingExamples,
  technicalExplanationExamples,
  codeGenerationExamples,
  reasoningExamples,
  streamingExample,
  conversationExample,
  main,
};

// Run examples if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
