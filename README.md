# Dreams Router Provider for Vercel AI SDK

Dreams Router is an AI language model router that enables payment-integrated access to large language models through the [Vercel AI SDK](https://sdk.vercel.ai/docs). Built with x402 payment protocol support, it allows seamless micropayments within API requests, creating a foundation for intelligent microservices.

## 🌟 Key Features

- **Payment-Integrated AI**: Send USDC payments directly within API requests using the x402 protocol
- **Multiple Authentication Methods**: Use JWT, API Key, or inline payments
- **LLM Router**: Access various AI models through a unified interface
- **Account Management**: Create and manage your account at [router.daydreams.systems](https://router.daydreams.systems)

## 📋 Prerequisites

Before using Dreams Router, you need:
- An account at [router.daydreams.systems](https://router.daydreams.systems)
- Either:
  - USDC for payment-based requests
  - Account credit
  - An API key for traditional authentication

## 📦 Installation

```bash
npm install @daydreamsai/ai-sdk-provider viem x402
```

## 🚀 Quick Start

### Payment-Based Authentication (x402)

Use x402 payments to access AI models without traditional API keys:

```typescript
import {
  createDreamsRouterAuth,
  generateX402Payment,
} from '@daydreamsai/ai-sdk-provider';
import { generateText } from 'ai';
import { privateKeyToAccount } from 'viem/accounts';

// Create a wallet account
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

// Generate payment (minimum amount varies by model complexity)
const payment = await generateX402Payment(account, {
  amount: '100000', // $0.10 USDC - adjust based on model requirements
  network: 'base-sepolia',
});

// Create authenticated router instance
const { dreamsRouter, user } = await createDreamsRouterAuth(account, {
  payment,
});

// Make AI requests
const { text } = await generateText({
  model: dreamsRouter('openai/gpt-4o'),
  prompt: 'Hello, Dreams Router!',
});
```

### API Key Authentication

For traditional authentication using API keys:

```typescript
import { createDreamsRouter } from '@daydreamsai/ai-sdk-provider';
import { generateText } from 'ai';

// Create router with API key
const dreamsRouter = createDreamsRouter({
  apiKey: process.env.DREAMSROUTER_API_KEY
});

// Make AI requests
const { text } = await generateText({
  model: dreamsRouter('openai/gpt-4o'),
  prompt: 'Hello, Dreams Router!',
});
```

## 🔐 Authentication Methods

Dreams Router supports three authentication methods:

1. **x402 Payment**: Send USDC payments directly in requests
2. **API Key**: Traditional API key authentication
3. **JWT**: JSON Web Token authentication

## 💡 When to Use Dreams Router

Dreams Router is ideal for:

- **Microservice Architecture**: Build intelligent microservices that handle their own payments
- **Pay-per-Use AI**: Create applications where users pay directly for AI usage
- **Decentralized Applications**: Integrate AI capabilities without centralized billing
- **x402 Protocol Applications**: Leverage the [x402 protocol](https://github.com/x402) for payment-integrated services

## 🔧 Configuration

### Environment Variables

```bash
# For API key authentication
DREAMSROUTER_API_KEY=your-api-key-here

# For wallet-based authentication
PRIVATE_KEY=0x... # Your wallet private key
```

## 📚 Advanced Usage

### Custom Payment Configuration

```typescript
const payment = await generateX402Payment(account, {
  amount: '500000', // $0.50 USDC for more complex operations
  network: 'base-sepolia',
});
```

### Model Selection

Dreams Router supports various AI models. Check the [router.daydreams.systems](https://router.daydreams.systems) dashboard for available models and their pricing.

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Dreams Router Dashboard](https://router.daydreams.systems)
- [x402 Protocol](https://github.com/x402)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
