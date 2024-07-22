# openrouter-ai-provider examples

To test the examples:

```bash
# Clone the repository
git clone <repository-url>
cd ai-sdk-provider/examples

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Edit the .env.local file based on .env.local.example to set the OpenRouter API key.

Then open [http://localhost:3000/api/test?modelName=openai/gpt-4o](http://localhost:3000/api/test?modelName=openai/gpt-4o) to see the examples.

# Test with different models

- [http://localhost:3000/api/test?modelName=openai/gpt-4o](http://localhost:3000/api/test?modelName=openai/gpt-4o)
- [http://localhost:3000/api/test?modelName=anthropic/claude-3.5-sonnet](http://localhost:3000/api/test?modelName=anthropic/claude-3.5-sonnet)
- [http://localhost:3000/api/test?modelName=mistralai/mixtral-8x7b-instruct](http://localhost:3000/api/test?modelName=mistralai/mixtral-8x7b-instruct)

# Test [tool calling](https://openrouter.ai/docs/requests#tool-calls)

- [http://localhost:3000/api/test-tool-calling?modelName=openai/gpt-4o](http://localhost:3000/api/test-tool-calling?modelName=openai/gpt-4o)
- [http://localhost:3000/api/test-tool-calling?modelName=anthropic/claude-3.5-sonnet](http://localhost:3000/api/test-tool-calling?modelName=anthropic/claude-3.5-sonnet)
