import { strict as assert } from 'node:assert';
import { Command } from '@effect/platform';
import { BunContext } from '@effect/platform-bun';
import { describe, it } from '@effect/vitest';
import { Effect, Layer, Redacted } from 'effect';
import { ActionUI } from './action-ui.js';
import { $, $cmd, $lines, $secret, $sh } from './exec.js';

// Create a test layer with real command execution using BunContext
// This provides CommandExecutor, FileSystem, Path, Terminal, and Worker
const TestLayer = Layer.merge(BunContext.layer, ActionUI.Mock);

describe('Exec', () => {
  it.layer(TestLayer)('$', (it) => {
    it.effect('should run simple commands', () =>
      Effect.gen(function* () {
        const result = yield* $`echo hello`;
        assert.equal(result.trim(), 'hello');
      }),
    );

    it.effect('should handle interpolation', () =>
      Effect.gen(function* () {
        const name = 'world';
        const result = yield* $`echo hello ${name}`;
        assert.equal(result.trim(), 'hello world');
      }),
    );

    it.effect('should handle multiple interpolations', () =>
      Effect.gen(function* () {
        const a = 'foo';
        const b = 'bar';
        const result = yield* $`echo ${a} and ${b}`;
        assert.equal(result.trim(), 'foo and bar');
      }),
    );
  });

  it.layer(TestLayer)('$lines', (it) => {
    it.effect('should return output as array of lines', () =>
      Effect.gen(function* () {
        const result = yield* $lines`printf 'line1\nline2\nline3'`;
        assert.ok(Array.isArray(result));
        assert.deepEqual(result, [
          'line1',
          'line2',
          'line3',
        ]);
      }),
    );

    it.effect('should filter empty lines', () =>
      Effect.gen(function* () {
        const result = yield* $lines`printf 'a\n\nb\n'`;
        assert.deepEqual(result, [
          'a',
          'b',
        ]);
      }),
    );

    it.effect('should support shell features like globs', () =>
      Effect.gen(function* () {
        // Create a temp directory with files, then glob them
        const result = yield* $lines`echo *.ts | tr ' ' '\n'`;
        assert.ok(Array.isArray(result));
        // Should find at least exec.ts in the current directory
        assert.ok(
          result.some((f) => f.endsWith('.ts')),
          'Should find .ts files via glob',
        );
      }),
    );

    it.effect('should support pipes', () =>
      Effect.gen(function* () {
        const result = yield* $lines`printf 'foo\nbar\nbaz' | grep -v bar`;
        assert.ok(result.includes('foo'));
        assert.ok(result.includes('baz'));
        assert.ok(!result.includes('bar'));
      }),
    );
  });

  describe('$cmd', () => {
    it('should create a Command without executing', () => {
      const cmd = $cmd`echo test`;
      assert.ok(cmd);
      assert.equal(cmd._tag, 'StandardCommand');
    });

    it.layer(TestLayer)('execution', (it) => {
      it.effect('should allow customization before execution', () =>
        Effect.gen(function* () {
          const cmd = $cmd`echo test`;
          const result = yield* Command.string(cmd);
          assert.equal(result.trim(), 'test');
        }),
      );
    });
  });

  it.layer(TestLayer)('$sh', (it) => {
    it.effect('should run commands through shell', () =>
      Effect.gen(function* () {
        const result = yield* $sh`echo hello`;
        assert.equal(result.trim(), 'hello');
      }),
    );

    it.effect('should handle shell features like pipes', () =>
      Effect.gen(function* () {
        const result = yield* $sh`echo "hello world" | tr 'a-z' 'A-Z'`;
        assert.equal(result.trim(), 'HELLO WORLD');
      }),
    );

    it.effect('should tee multiline output to stdout and return it', () =>
      Effect.gen(function* () {
        // This test verifies that output is both streamed to stdout (visible in test output)
        // AND captured and returned as a string
        const result = yield* $sh`printf 'line1\nline2\nline3'`;
        assert.equal(result, 'line1\nline2\nline3');
      }),
    );

    it.effect('should fail when command exits with non-zero code', () =>
      Effect.gen(function* () {
        // This command prints output but exits with code 1
        const result = yield* $sh`echo "some output" && exit 1`.pipe(Effect.either);
        assert.equal(result._tag, 'Left', 'Expected command to fail');
      }),
    );

    it.effect('should fail when command exits with non-zero code (simple)', () =>
      Effect.gen(function* () {
        const result = yield* $sh`exit 42`.pipe(Effect.either);
        assert.equal(result._tag, 'Left', 'Expected command to fail');
      }),
    );

    it.effect('should capture stderr output', () =>
      Effect.gen(function* () {
        // This command writes to stderr
        const result = yield* $sh`echo "stdout line" && echo "stderr line" >&2`;
        // Both stdout and stderr should be captured
        assert.ok(result.includes('stdout line'), 'Should capture stdout');
        assert.ok(result.includes('stderr line'), 'Should capture stderr');
      }),
    );

    it.effect('should show stderr even when command fails', () =>
      Effect.gen(function* () {
        // This test verifies stderr is visible in console output even when command fails
        // (check the test output to see "error message" printed)
        const result = yield* $sh`echo "error message" >&2 && exit 1`.pipe(Effect.either);
        assert.equal(result._tag, 'Left', 'Expected command to fail');
      }),
    );
  });

  it.layer(TestLayer)('$ exit code handling', (it) => {
    it.effect('should fail when command exits with non-zero code', () =>
      Effect.gen(function* () {
        const result = yield* $`false`.pipe(Effect.either);
        assert.equal(result._tag, 'Left', 'Expected command to fail');
      }),
    );
  });

  it.layer(TestLayer)('$secret', (it) => {
    it.effect('should return output as Redacted value', () =>
      Effect.gen(function* () {
        const result = yield* $secret`echo secret-value`;
        // Result should be Redacted
        assert.equal(Redacted.value(result), 'secret-value');
      }),
    );

    it.effect('should handle interpolation', () =>
      Effect.gen(function* () {
        const value = 'my-token';
        const result = yield* $secret`echo ${value}`;
        assert.equal(Redacted.value(result), 'my-token');
      }),
    );

    it.effect('should fail when command exits with non-zero code', () =>
      Effect.gen(function* () {
        const result = yield* $secret`false`.pipe(Effect.either);
        assert.equal(result._tag, 'Left', 'Expected command to fail');
      }),
    );
  });
});
