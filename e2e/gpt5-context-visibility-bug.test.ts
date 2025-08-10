import { streamText } from 'ai';
import { it, vi, expect, describe } from 'vitest';
import { createOpenRouter } from '../src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('GPT-5 Context Visibility Bug', () => {
  const multiPartTextMessage = [
    {
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: 'projects/web/features/playground/persistence/arti' },
        { type: 'text' as const, text: 'projects/web/features/playground/services/esbuild' },
        { type: 'text' as const, text: 'projects/web/features/playground/stores/chatroom-' },
        { type: 'text' as const, text: 'projects/web/features/playground/state/artifacts/' },
        { type: 'text' as const, text: 'projects/web/features/playground/ui/Artifacts/Art' },
      ],
    },
    {
      role: 'user' as const,
      content: [{ type: 'text' as const, text: 'Can you see the UI components that I\'ve provided you with?' }],
    },
  ];

  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should reproduce GPT-5 context visibility issue', async () => {
    const gpt5Model = openrouter('openai/gpt-5');
    const gpt5Response = await streamText({
      model: gpt5Model,
      messages: multiPartTextMessage,
    });
    
    await gpt5Response.consumeStream();
    const gpt5Text = await gpt5Response.text;
    
    const gpt41Model = openrouter('openai/gpt-4.1');
    const gpt41Response = await streamText({
      model: gpt41Model,
      messages: multiPartTextMessage,
    });
    
    await gpt41Response.consumeStream();
    const gpt41Text = await gpt41Response.text;
    
    const geminiModel = openrouter('google/gemini-2.5-flash-exp');
    const geminiResponse = await streamText({
      model: geminiModel,
      messages: multiPartTextMessage,
    });
    
    await geminiResponse.consumeStream();
    const geminiText = await geminiResponse.text;
    
    console.log('=== GPT-5 Response ===');
    console.log(gpt5Text);
    console.log('\n=== GPT-4.1 Response ===');
    console.log(gpt41Text);
    console.log('\n=== Gemini 2.5 Response ===');
    console.log(geminiText);
    
    const gpt5SeesComponents = gpt5Text.toLowerCase().includes('ui components') || 
                              gpt5Text.toLowerCase().includes('components') ||
                              gpt5Text.toLowerCase().includes('playground') ||
                              gpt5Text.toLowerCase().includes('artifacts') ||
                              gpt5Text.toLowerCase().includes('persistence') ||
                              gpt5Text.toLowerCase().includes('esbuild');
    
    const gpt41SeesComponents = gpt41Text.toLowerCase().includes('ui components') || 
                               gpt41Text.toLowerCase().includes('components') ||
                               gpt41Text.toLowerCase().includes('playground') ||
                               gpt41Text.toLowerCase().includes('artifacts') ||
                               gpt41Text.toLowerCase().includes('persistence') ||
                               gpt41Text.toLowerCase().includes('esbuild');
    
    const geminiSeesComponents = geminiText.toLowerCase().includes('ui components') || 
                                geminiText.toLowerCase().includes('components') ||
                                geminiText.toLowerCase().includes('playground') ||
                                geminiText.toLowerCase().includes('artifacts') ||
                                geminiText.toLowerCase().includes('persistence') ||
                                geminiText.toLowerCase().includes('esbuild');
    
    console.log('\n=== Test Results ===');
    console.log(`GPT-5 sees components: ${gpt5SeesComponents}`);
    console.log(`GPT-4.1 sees components: ${gpt41SeesComponents}`);
    console.log(`Gemini 2.5 sees components: ${geminiSeesComponents}`);
    
    if (!gpt5SeesComponents && (gpt41SeesComponents || geminiSeesComponents)) {
      console.log('\n🐛 BUG REPRODUCED: GPT-5 cannot see context that other models can see');
      
      expect(gpt5SeesComponents).toBe(true);
    } else if (gpt5SeesComponents && gpt41SeesComponents && geminiSeesComponents) {
      console.log('\n✅ All models can see the context - bug may be fixed');
    } else {
      console.log('\n❓ Inconclusive results - may need to adjust test criteria');
    }
  });

  it('should verify message conversion preserves multiple text parts', async () => {
    const { convertToOpenRouterChatMessages } = await import('../src/chat/convert-to-openrouter-chat-messages');
    
    const convertedMessages = convertToOpenRouterChatMessages(multiPartTextMessage);
    
    expect(convertedMessages[0]).toMatchObject({
      role: 'user',
      content: [
        { type: 'text', text: 'projects/web/features/playground/persistence/arti' },
        { type: 'text', text: 'projects/web/features/playground/services/esbuild' },
        { type: 'text', text: 'projects/web/features/playground/stores/chatroom-' },
        { type: 'text', text: 'projects/web/features/playground/state/artifacts/' },
        { type: 'text', text: 'projects/web/features/playground/ui/Artifacts/Art' },
      ],
    });
    
    expect(convertedMessages[1]).toMatchObject({
      role: 'user',
      content: 'Can you see the UI components that I\'ve provided you with?',
    });
    
    console.log('✅ Message conversion correctly preserves multiple text parts');
  });
});
