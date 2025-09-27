# OpenRouter AI SDK Provider Examples

This directory contains example usage of the OpenRouter AI SDK Provider with various models and configurations.

## 0G Compute Network Examples

### `0g-compute-example.ts`

Basic introduction to using the 0G Compute Network models through the OpenRouter provider:

- **0G Llama 3.3 70B Instruct**: State-of-the-art 70B parameter model for general AI tasks
- **0G DeepSeek R1 70B**: Advanced reasoning model optimized for complex problem solving

### `text-generation-0g.ts`

Comprehensive text generation examples showcasing the full capabilities of 0G Compute models:

- **Creative Writing**: Short stories, poetry, dialogue generation
- **Technical Explanations**: Complex concepts explained simply
- **Code Generation**: Python, JavaScript, and other programming languages
- **Reasoning & Problem Solving**: Mathematical problems, logic puzzles, code debugging
- **Streaming Generation**: Real-time text streaming
- **Multi-turn Conversations**: Context-aware dialogue

Both models run on the 0G Compute Network and provide verified AI inference through Trusted Execution Environments (TEE).

### Running the Examples

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set your OpenRouter API key:

   ```bash
   export OPENROUTER_API_KEY="your-api-key-here"
   ```

3. Run the examples:

   ```bash
   # Basic 0G Compute example
   npx tsx examples/0g-compute-example.ts
   
   # Comprehensive text generation examples
   npx tsx examples/text-generation-0g.ts
   ```

### About 0G Compute Network

The 0G Compute Network is a decentralized AI inference network that provides:

- **Verified Computation**: All inference runs in Trusted Execution Environments (TEE)
- **Decentralized Infrastructure**: Distributed across multiple providers
- **Cost-Effective**: Competitive pricing through decentralized competition
- **High Performance**: State-of-the-art models with fast inference

Learn more at [0G Compute Documentation](https://docs.0g.ai/0g-compute/for-developers/inference-sdk).
