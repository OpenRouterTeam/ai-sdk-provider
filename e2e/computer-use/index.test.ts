import { generateText } from 'ai';
import { writeFile } from 'fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';
import {
  clickAtTool,
  dragAndDropTool,
  goBackTool,
  goForwardTool,
  hoverAtTool,
  keyCombinationTool,
  navigateTool,
  openWebBrowserTool,
  scrollAtTool,
  scrollDocumentTool,
  searchTool,
  typeTextAtTool,
  wait5SecondsTool,
} from './tools';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Computer Use E2E Tests', () => {
  it('should handle computer use tools with Claude (preparing for Google Gemini Computer Use)', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = openrouter('anthropic/claude-3.5-sonnet', {
      usage: {
        include: true,
      },
    });

    const response = await generateText({
      model,
      system:
        'You are a browser automation assistant. You can control a web browser using various UI actions like clicking, typing, scrolling, and navigating. When given a task, use the appropriate tools to complete it.',
      messages: [
        {
          role: 'user',
          content:
            'Open a web browser, navigate to google.com, and search for "OpenRouter AI".',
        },
      ],
      tools: {
        open_web_browser: openWebBrowserTool,
        wait_5_seconds: wait5SecondsTool,
        go_back: goBackTool,
        go_forward: goForwardTool,
        search: searchTool,
        navigate: navigateTool,
        click_at: clickAtTool,
        hover_at: hoverAtTool,
        type_text_at: typeTextAtTool,
        key_combination: keyCombinationTool,
        scroll_document: scrollDocumentTool,
        scroll_at: scrollAtTool,
        drag_and_drop: dragAndDropTool,
      },
    });

    expect(response.text).toBeDefined();
    expect(response.toolCalls).toBeDefined();
    expect(response.toolCalls.length).toBeGreaterThan(0);

    const toolCallNames = response.toolCalls.map((call) => call.toolName);
    expect(toolCallNames).toContain('open_web_browser');

    expect(response.usage).toBeDefined();

    const providerMetadata = response.providerMetadata;
    expect(providerMetadata?.openrouter).toMatchObject({
      usage: expect.objectContaining({
        promptTokens: expect.any(Number),
        completionTokens: expect.any(Number),
        totalTokens: expect.any(Number),
      }),
    });

    await writeFile(
      new URL('./output.ignore.json', import.meta.url),
      JSON.stringify(
        {
          text: response.text,
          toolCalls: response.toolCalls,
          usage: response.usage,
          providerMetadata: response.providerMetadata,
        },
        null,
        2,
      ),
    );
  });

  it('should handle multi-step computer use interactions with Claude', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = openrouter('anthropic/claude-3.5-sonnet', {
      usage: {
        include: true,
      },
    });

    const response = await generateText({
      model,
      system:
        'You are a browser automation assistant. You can control a web browser using various UI actions. Complete tasks step by step.',
      messages: [
        {
          role: 'user',
          content:
            'Navigate to example.com, scroll down the page, and click on a link.',
        },
      ],
      tools: {
        open_web_browser: openWebBrowserTool,
        wait_5_seconds: wait5SecondsTool,
        go_back: goBackTool,
        go_forward: goForwardTool,
        search: searchTool,
        navigate: navigateTool,
        click_at: clickAtTool,
        hover_at: hoverAtTool,
        type_text_at: typeTextAtTool,
        key_combination: keyCombinationTool,
        scroll_document: scrollDocumentTool,
        scroll_at: scrollAtTool,
        drag_and_drop: dragAndDropTool,
      },
    });

    expect(response.text).toBeDefined();
    expect(response.toolCalls).toBeDefined();
    expect(response.toolCalls.length).toBeGreaterThan(0);

    const toolCallNames = response.toolCalls.map((call) => call.toolName);
    expect(toolCallNames).toContain('navigate');

    await writeFile(
      new URL('./output-multi-step.ignore.json', import.meta.url),
      JSON.stringify(
        {
          text: response.text,
          toolCalls: response.toolCalls,
          usage: response.usage,
        },
        null,
        2,
      ),
    );
  });
});
