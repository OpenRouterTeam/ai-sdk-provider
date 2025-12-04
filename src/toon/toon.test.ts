import { describe, expect, it } from 'vitest';
import { decodeToon, encodeToon } from './index';

describe('TOON helpers', () => {
  describe('encodeToon', () => {
    it('should encode a simple object', async () => {
      const result = await encodeToon({ name: 'Alice', age: 30 });
      expect(result).toContain('name: Alice');
      expect(result).toContain('age: 30');
    });

    it('should encode an array of objects in tabular format', async () => {
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];
      const result = await encodeToon(data);
      // TOON uses tabular format for uniform arrays
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should encode primitives', async () => {
      expect(await encodeToon('hello')).toBe('hello');
      expect(await encodeToon(42)).toBe('42');
      expect(await encodeToon(true)).toBe('true');
      expect(await encodeToon(null)).toBe('null');
    });

    it('should encode nested objects', async () => {
      const data = {
        user: {
          name: 'Alice',
          address: {
            city: 'NYC',
          },
        },
      };
      const result = await encodeToon(data);
      expect(result).toContain('user');
      expect(result).toContain('name: Alice');
      expect(result).toContain('city: NYC');
    });

    it('should accept encoding options', async () => {
      const data = { a: { b: { c: 1 } } };
      const result = await encodeToon(data, { keyFolding: 'safe' });
      expect(result).toBeDefined();
    });
  });

  describe('decodeToon', () => {
    it('should decode a simple object', async () => {
      const toon = 'name: Alice\nage: 30';
      const result = await decodeToon(toon);
      expect(result).toEqual({ name: 'Alice', age: 30 });
    });

    it('should decode primitives', async () => {
      expect(await decodeToon('hello')).toBe('hello');
      expect(await decodeToon('42')).toBe(42);
      expect(await decodeToon('true')).toBe(true);
      expect(await decodeToon('null')).toBe(null);
    });

    it('should accept decoding options', async () => {
      const toon = 'name: Alice';
      const result = await decodeToon(toon, { strict: false });
      expect(result).toEqual({ name: 'Alice' });
    });
  });

  describe('round-trip', () => {
    it('should round-trip a simple object', async () => {
      const original = { name: 'Alice', age: 30, active: true };
      const encoded = await encodeToon(original);
      const decoded = await decodeToon(encoded);
      expect(decoded).toEqual(original);
    });

    it('should round-trip an array of objects', async () => {
      const original = [
        { id: 1, name: 'Alice', score: 95 },
        { id: 2, name: 'Bob', score: 87 },
      ];
      const encoded = await encodeToon(original);
      const decoded = await decodeToon(encoded);
      expect(decoded).toEqual(original);
    });

    it('should round-trip nested structures', async () => {
      const original = {
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
        metadata: {
          count: 2,
          page: 1,
        },
      };
      const encoded = await encodeToon(original);
      const decoded = await decodeToon(encoded);
      expect(decoded).toEqual(original);
    });
  });
});
