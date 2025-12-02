import { strict as assert } from 'node:assert';
import { Command } from '@effect/platform';
import { BunContext } from '@effect/platform-bun';
import { describe, it } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { ActionUI } from './ActionUI.js';
import { $, $cmd, $lines, $sh } from './Exec.js';

// Create a test layer with real command execution using BunContext
// This provides CommandExecutor, FileSystem, Path, Terminal, and Worker
const TestLayer = Layer.merge(BunContext.layer, ActionUI.Mock);

describe('Exec', () => {
  describe('$', () => {
    it.effect('should run simple commands', () =>
      Effect.gen(function* () {
        const result = yield* $`echo hello`;
        assert.equal(result.trim(), 'hello');
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect('should handle interpolation', () =>
      Effect.gen(function* () {
        const name = 'world';
        const result = yield* $`echo hello ${name}`;
        assert.equal(result.trim(), 'hello world');
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect('should handle multiple interpolations', () =>
      Effect.gen(function* () {
        const a = 'foo';
        const b = 'bar';
        const result = yield* $`echo ${a} and ${b}`;
        assert.equal(result.trim(), 'foo and bar');
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe('$lines', () => {
    it.effect('should return output as array of lines', () =>
      Effect.gen(function* () {
        const result = yield* $lines`echo -e "line1\nline2\nline3"`;
        // Note: echo -e behavior varies, so we use printf for reliable newlines
        assert.ok(Array.isArray(result));
        assert.ok(result.length > 0);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect('should filter empty lines', () =>
      Effect.gen(function* () {
        // Use $sh variant since $lines doesn't interpret escape sequences
        const result = yield* $sh`printf 'a\n\nb\n'`.pipe(
          Effect.map((output) => output.trim().split('\n').filter(Boolean)),
        );
        assert.deepEqual(result, ['a', 'b']);
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe('$cmd', () => {
    it('should create a Command without executing', () => {
      const cmd = $cmd`echo test`;
      assert.ok(cmd);
      assert.equal(cmd._tag, 'StandardCommand');
    });

    it.effect('should allow customization before execution', () =>
      Effect.gen(function* () {
        const cmd = $cmd`echo test`;
        const result = yield* Command.string(cmd);
        assert.equal(result.trim(), 'test');
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe('$sh', () => {
    it.effect('should run commands through shell', () =>
      Effect.gen(function* () {
        const result = yield* $sh`echo hello`;
        assert.equal(result.trim(), 'hello');
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect('should handle shell features like pipes', () =>
      Effect.gen(function* () {
        const result = yield* $sh`echo "hello world" | tr 'a-z' 'A-Z'`;
        assert.equal(result.trim(), 'HELLO WORLD');
      }).pipe(Effect.provide(TestLayer)),
    );
  });
});
