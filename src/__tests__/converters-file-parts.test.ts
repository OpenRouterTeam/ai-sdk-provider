/**
 * Unit tests for file part converters.
 */

import type { LanguageModelV2FilePart } from '@ai-sdk/provider';

import { describe, expect, it } from 'vitest';
import {
  convertFilePartToChatItem,
  convertFilePartToResponsesItem,
} from '../converters/file-parts';

describe('convertFilePartToChatItem', () => {
  describe('image files', () => {
    it('converts image URL to image_url content', () => {
      const part: LanguageModelV2FilePart = {
        type: 'file',
        mediaType: 'image/png',
        data: 'https://example.com/image.png',
      };

      const result = convertFilePartToChatItem(part);

      expect(result).toEqual({
        type: 'image_url',
        imageUrl: {
          url: 'https://example.com/image.png',
          detail: 'auto',
        },
      });
    });

    it('converts base64 image to data URL', () => {
      const part: LanguageModelV2FilePart = {
        type: 'file',
        mediaType: 'image/jpeg',
        data: 'abc123base64data',
      };

      const result = convertFilePartToChatItem(part);

      expect(result).toEqual({
        type: 'image_url',
        imageUrl: {
          url: 'data:image/jpeg;base64,abc123base64data',
          detail: 'auto',
        },
      });
    });

    it('converts Uint8Array image to data URL', () => {
      const imageData = new Uint8Array([
        0x89,
        0x50,
        0x4e,
        0x47,
      ]); // PNG magic bytes
      const part: LanguageModelV2FilePart = {
        type: 'file',
        mediaType: 'image/png',
        data: imageData,
      };

      const result = convertFilePartToChatItem(part);

      expect(result).toEqual({
        type: 'image_url',
        imageUrl: {
          url: 'data:image/png;base64,iVBORw==',
          detail: 'auto',
        },
      });
    });
  });

  describe('non-image files', () => {
    it('converts base64 PDF to file content', () => {
      const part: LanguageModelV2FilePart = {
        type: 'file',
        mediaType: 'application/pdf',
        data: 'JVBERi0xLjQ=', // Base64 for "%PDF-1.4"
        filename: 'document.pdf',
      };

      const result = convertFilePartToChatItem(part);

      expect(result).toEqual({
        type: 'file',
        file: {
          fileData: 'JVBERi0xLjQ=',
          filename: 'document.pdf',
        },
      });
    });

    it('converts Uint8Array PDF to file content', () => {
      const pdfData = new Uint8Array([
        0x25,
        0x50,
        0x44,
        0x46,
      ]); // %PDF
      const part: LanguageModelV2FilePart = {
        type: 'file',
        mediaType: 'application/pdf',
        data: pdfData,
        filename: 'doc.pdf',
      };

      const result = convertFilePartToChatItem(part);

      expect(result).toEqual({
        type: 'file',
        file: {
          fileData: Buffer.from(pdfData).toString('base64'),
          filename: 'doc.pdf',
        },
      });
    });

    it('converts URL file to text placeholder', () => {
      const part: LanguageModelV2FilePart = {
        type: 'file',
        mediaType: 'application/pdf',
        data: 'https://example.com/document.pdf',
        filename: 'document.pdf',
      };

      const result = convertFilePartToChatItem(part);

      expect(result).toEqual({
        type: 'text',
        text: '[File: document.pdf - https://example.com/document.pdf]',
      });
    });
  });
});

describe('convertFilePartToResponsesItem', () => {
  describe('image files', () => {
    it('converts image URL to input_image', () => {
      const part: LanguageModelV2FilePart = {
        type: 'file',
        mediaType: 'image/png',
        data: 'https://example.com/image.png',
      };

      const result = convertFilePartToResponsesItem(part);

      expect(result).toEqual({
        type: 'input_image',
        detail: 'auto',
        imageUrl: 'https://example.com/image.png',
      });
    });

    it('converts base64 image to input_image with data URL', () => {
      const part: LanguageModelV2FilePart = {
        type: 'file',
        mediaType: 'image/gif',
        data: 'R0lGODlh', // GIF magic bytes in base64
      };

      const result = convertFilePartToResponsesItem(part);

      expect(result).toEqual({
        type: 'input_image',
        detail: 'auto',
        imageUrl: 'data:image/gif;base64,R0lGODlh',
      });
    });
  });

  describe('non-image files', () => {
    it('converts base64 file to input_file with fileData', () => {
      const part: LanguageModelV2FilePart = {
        type: 'file',
        mediaType: 'application/pdf',
        data: 'JVBERi0xLjQ=',
        filename: 'document.pdf',
      };

      const result = convertFilePartToResponsesItem(part);

      expect(result).toEqual({
        type: 'input_file',
        filename: 'document.pdf',
        fileData: 'JVBERi0xLjQ=',
      });
    });

    it('converts URL file to input_file with fileUrl', () => {
      const part: LanguageModelV2FilePart = {
        type: 'file',
        mediaType: 'application/pdf',
        data: 'https://example.com/document.pdf',
        filename: 'document.pdf',
      };

      const result = convertFilePartToResponsesItem(part);

      expect(result).toEqual({
        type: 'input_file',
        filename: 'document.pdf',
        fileUrl: 'https://example.com/document.pdf',
      });
    });

    it('converts Uint8Array file to input_file with fileData', () => {
      const fileData = new Uint8Array([
        1,
        2,
        3,
        4,
        5,
      ]);
      const part: LanguageModelV2FilePart = {
        type: 'file',
        mediaType: 'application/octet-stream',
        data: fileData,
        filename: 'data.bin',
      };

      const result = convertFilePartToResponsesItem(part);

      expect(result).toEqual({
        type: 'input_file',
        filename: 'data.bin',
        fileData: Buffer.from(fileData).toString('base64'),
      });
    });
  });
});
