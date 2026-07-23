import { describe, expect, it } from 'vitest';
import * as provider from './index';

describe('main exports', () => {
  it('exports the provider factory and default provider', () => {
    expect(provider.createOpenRouter).toBeTypeOf('function');
    expect(provider.openrouter).toBeDefined();
  });
});
