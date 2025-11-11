import type { OpenRouterChatCompletionsInput } from '../types/openrouter-chat-completions-input';
import { convertToNvidiaMessages } from './convert-to-nvidia-messages';

describe('convertToNvidiaMessages', () => {
  describe('video conversion', () => {
    it('should convert file parts with video media types to video_url format', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this video' },
            {
              type: 'file',
              file: {
                filename: 'sample.mp4',
                file_data: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t',
              },
            },
          ],
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this video' },
            {
              type: 'video_url',
              video_url: {
                url: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t',
              },
            },
          ],
        },
      ]);
    });

    it('should convert file parts with video/webm media type to video_url format', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'sample.webm',
                file_data: 'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC',
              },
            },
          ],
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'video_url',
              video_url: {
                url: 'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC',
              },
            },
          ],
        },
      ]);
    });

    it('should convert file parts with video/mov media type to video_url format', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'sample.mov',
                file_data: 'data:video/mov;base64,AAAAHGZ0eXBxdA==',
              },
            },
          ],
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'video_url',
              video_url: {
                url: 'data:video/mov;base64,AAAAHGZ0eXBxdA==',
              },
            },
          ],
        },
      ]);
    });

    it('should preserve cache_control when converting video files', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'sample.mp4',
                file_data: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t',
              },
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'video_url',
              video_url: {
                url: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t',
              },
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ]);
    });
  });

  describe('image pass-through', () => {
    it('should pass through image_url parts unchanged', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image' },
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              },
            },
          ],
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image' },
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              },
            },
          ],
        },
      ]);
    });

    it('should preserve cache_control on image_url parts', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
              },
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
              },
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ]);
    });
  });

  describe('text pass-through', () => {
    it('should pass through text parts unchanged', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello, world!' },
          ],
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello, world!' },
          ],
        },
      ]);
    });

    it('should preserve cache_control on text parts', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Hello, world!',
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Hello, world!',
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ]);
    });
  });

  describe('unsupported file types', () => {
    it('should convert non-video file parts to text with unsupported message', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'document.pdf',
                file_data: 'data:application/pdf;base64,JVBERi0xLjQK',
              },
            },
          ],
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '[Unsupported file type: document.pdf]',
            },
          ],
        },
      ]);
    });

    it('should preserve cache_control when converting unsupported files to text', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'data.csv',
                file_data: 'data:text/csv;base64,bmFtZSxhZ2UK',
              },
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '[Unsupported file type: data.csv]',
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ]);
    });
  });

  describe('mixed content', () => {
    it('should handle mixed text, image, and video content', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Compare these media files' },
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/png;base64,iVBORw0KGgo=',
              },
            },
            {
              type: 'file',
              file: {
                filename: 'video.mp4',
                file_data: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t',
              },
            },
          ],
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Compare these media files' },
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/png;base64,iVBORw0KGgo=',
              },
            },
            {
              type: 'video_url',
              video_url: {
                url: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t',
              },
            },
          ],
        },
      ]);
    });
  });

  describe('non-user messages', () => {
    it('should pass through system messages unchanged', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'system',
          content: 'You are a helpful assistant.',
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'system',
          content: 'You are a helpful assistant.',
        },
      ]);
    });

    it('should pass through assistant messages unchanged', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'assistant',
          content: 'I can help you with that.',
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: 'I can help you with that.',
        },
      ]);
    });

    it('should pass through tool messages unchanged', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'tool',
          tool_call_id: 'call-123',
          content: 'Tool result',
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'tool',
          tool_call_id: 'call-123',
          content: 'Tool result',
        },
      ]);
    });

    it('should pass through user messages with string content unchanged', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'user',
          content: 'Hello',
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'user',
          content: 'Hello',
        },
      ]);
    });
  });

  describe('multiple messages', () => {
    it('should handle multiple messages with different content types', () => {
      const input: OpenRouterChatCompletionsInput = [
        {
          role: 'system',
          content: 'You are a video analysis assistant.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this video' },
            {
              type: 'file',
              file: {
                filename: 'sample.mp4',
                file_data: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t',
              },
            },
          ],
        },
        {
          role: 'assistant',
          content: 'I can see the video.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What about this image?' },
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/png;base64,iVBORw0KGgo=',
              },
            },
          ],
        },
      ];

      const result = convertToNvidiaMessages(input);

      expect(result).toEqual([
        {
          role: 'system',
          content: 'You are a video analysis assistant.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this video' },
            {
              type: 'video_url',
              video_url: {
                url: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t',
              },
            },
          ],
        },
        {
          role: 'assistant',
          content: 'I can see the video.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What about this image?' },
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/png;base64,iVBORw0KGgo=',
              },
            },
          ],
        },
      ]);
    });
  });
});
