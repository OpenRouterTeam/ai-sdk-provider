/**
 * ActionUI Service Tests
 *
 * Tests the Mock layer - the Default layer wraps @actions/core which
 * outputs workflow commands (not suitable for unit testing).
 *
 * Uses MockConsole layer to capture output without mutating global console.
 */

import { describe, it } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { describe as vitestDescribe, expect, it as vitestIt } from 'vitest';
import { ActionUI, toRelativePath } from './action-ui.js';
import * as MockConsole from './mock-console.js';

const TestLayers = Layer.mergeAll(MockConsole.layer, ActionUI.Mock);

describe('ActionUI', () => {
  describe('ActionUI.Mock', () => {
    it.effect('info writes to console', () =>
      Effect.gen(function* () {
        const ui = yield* ActionUI;
        yield* ui.info('Hello, World!');
        const lines = yield* MockConsole.getLines();
        expect(lines).toContain('Hello, World!');
      }).pipe(Effect.provide(TestLayers)),
    );

    it.effect('debug writes with [DEBUG] prefix', () =>
      Effect.gen(function* () {
        const ui = yield* ActionUI;
        yield* ui.debug('Debug message');
        const lines = yield* MockConsole.getLines();
        expect(lines).toContain('[DEBUG] Debug message');
      }).pipe(Effect.provide(TestLayers)),
    );

    it.effect('error writes with [ERROR] prefix and location', () =>
      Effect.gen(function* () {
        const ui = yield* ActionUI;
        yield* ui.error('Something failed', {
          file: 'src/index.ts',
          startLine: 42,
        });
        const lines = yield* MockConsole.getLines();
        expect(lines[0]).toContain('[ERROR]');
        expect(lines[0]).toContain('Something failed');
        expect(lines[0]).toContain('src/index.ts:42');
      }).pipe(Effect.provide(TestLayers)),
    );

    it.effect('warning writes with [WARNING] prefix', () =>
      Effect.gen(function* () {
        const ui = yield* ActionUI;
        yield* ui.warning('Deprecated API used');
        const lines = yield* MockConsole.getLines();
        expect(lines[0]).toContain('[WARNING]');
        expect(lines[0]).toContain('Deprecated API used');
      }).pipe(Effect.provide(TestLayers)),
    );

    it.effect('notice writes with [NOTICE] prefix', () =>
      Effect.gen(function* () {
        const ui = yield* ActionUI;
        yield* ui.notice('Migration needed');
        const lines = yield* MockConsole.getLines();
        expect(lines.some((l) => l.includes('[NOTICE]'))).toBe(true);
        expect(lines.some((l) => l.includes('Migration needed'))).toBe(true);
      }).pipe(Effect.provide(TestLayers)),
    );

    it.effect('group wraps effect with start/end markers', () =>
      Effect.gen(function* () {
        const groupContent: Array<string> = [];
        const ui = yield* ActionUI;
        yield* ui.group(
          'Build',
          Effect.sync(() => groupContent.push('Building...')),
        );
        const lines = yield* MockConsole.getLines();
        expect(lines[0]).toContain('Build');
        expect(groupContent[0]).toBe('Building...');
        expect(lines[1]).toContain('Build');
      }).pipe(Effect.provide(TestLayers)),
    );

    it.effect('setOutput logs the output', () =>
      Effect.gen(function* () {
        const ui = yield* ActionUI;
        yield* ui.setOutput('result', 'success');
        const lines = yield* MockConsole.getLines();
        expect(lines.some((l) => l.includes('[OUTPUT]'))).toBe(true);
        expect(lines.some((l) => l.includes('result=success'))).toBe(true);
      }).pipe(Effect.provide(TestLayers)),
    );

    it.effect('exportVariable sets process.env', () =>
      Effect.gen(function* () {
        const originalValue = process.env['TEST_VAR'];
        const ui = yield* ActionUI;
        yield* ui.exportVariable('TEST_VAR', 'test-value');
        expect(process.env['TEST_VAR']).toBe('test-value');
        // Cleanup
        if (originalValue === undefined) {
          delete process.env['TEST_VAR'];
        } else {
          process.env['TEST_VAR'] = originalValue;
        }
      }).pipe(Effect.provide(TestLayers)),
    );

    it.effect('setFailed sets exit code to 1', () =>
      Effect.gen(function* () {
        const originalExitCode = process.exitCode;
        const ui = yield* ActionUI;
        yield* ui.setFailed('Action failed!');
        const lines = yield* MockConsole.getLines();
        expect(process.exitCode).toBe(1);
        expect(lines.some((e) => e.includes('[FAILED]'))).toBe(true);
        // Cleanup
        process.exitCode = originalExitCode;
      }).pipe(Effect.provide(TestLayers)),
    );

    it.effect('isDebug returns false by default', () =>
      Effect.gen(function* () {
        const originalDebug = process.env['DEBUG'];
        const originalRunnerDebug = process.env['RUNNER_DEBUG'];
        delete process.env['DEBUG'];
        delete process.env['RUNNER_DEBUG'];

        const ui = yield* ActionUI;
        const result = yield* ui.isDebug;
        expect(result).toBe(false);

        // Cleanup
        if (originalDebug !== undefined) {
          process.env['DEBUG'] = originalDebug;
        }
        if (originalRunnerDebug !== undefined) {
          process.env['RUNNER_DEBUG'] = originalRunnerDebug;
        }
      }).pipe(Effect.provide(TestLayers)),
    );

    it.effect('isDebug returns true when DEBUG=1', () =>
      Effect.gen(function* () {
        const originalDebug = process.env['DEBUG'];
        process.env['DEBUG'] = '1';

        const ui = yield* ActionUI;
        const result = yield* ui.isDebug;
        expect(result).toBe(true);

        // Cleanup
        if (originalDebug === undefined) {
          delete process.env['DEBUG'];
        } else {
          process.env['DEBUG'] = originalDebug;
        }
      }).pipe(Effect.provide(TestLayers)),
    );

    it.effect('setSecret logs masked info', () =>
      Effect.gen(function* () {
        const ui = yield* ActionUI;
        yield* ui.setSecret('my-secret-value');
        const lines = yield* MockConsole.getLines();
        expect(lines.some((l) => l.includes('[MASK]'))).toBe(true);
        expect(lines.some((l) => l.includes('15 chars'))).toBe(true);
        // Should NOT contain the actual secret
        expect(lines.every((l) => !l.includes('my-secret-value'))).toBe(true);
      }).pipe(Effect.provide(TestLayers)),
    );

    it.effect('addPath updates PATH', () =>
      Effect.gen(function* () {
        const originalPath = process.env['PATH'];
        const ui = yield* ActionUI;
        yield* ui.addPath('/custom/bin');
        expect(process.env['PATH']?.startsWith('/custom/bin:')).toBe(true);
        // Cleanup
        process.env['PATH'] = originalPath;
      }).pipe(Effect.provide(TestLayers)),
    );
  });
});

vitestDescribe('toRelativePath', () => {
  const originalWorkspace = process.env['GITHUB_WORKSPACE'];
  const originalCwd = process.cwd();

  vitestIt('converts absolute path to relative using GITHUB_WORKSPACE', () => {
    process.env['GITHUB_WORKSPACE'] = '/home/runner/work/repo/repo';
    const result = toRelativePath('/home/runner/work/repo/repo/src/index.ts');
    expect(result).toBe('src/index.ts');
    // Cleanup
    if (originalWorkspace === undefined) {
      delete process.env['GITHUB_WORKSPACE'];
    } else {
      process.env['GITHUB_WORKSPACE'] = originalWorkspace;
    }
  });

  vitestIt('converts absolute path to relative using cwd when GITHUB_WORKSPACE not set', () => {
    delete process.env['GITHUB_WORKSPACE'];
    const result = toRelativePath(`${originalCwd}/src/index.ts`);
    expect(result).toBe('src/index.ts');
    // Cleanup
    if (originalWorkspace !== undefined) {
      process.env['GITHUB_WORKSPACE'] = originalWorkspace;
    }
  });

  vitestIt('returns path unchanged when not under workspace', () => {
    process.env['GITHUB_WORKSPACE'] = '/home/runner/work/repo/repo';
    const result = toRelativePath('/other/path/file.ts');
    expect(result).toBe('/other/path/file.ts');
    // Cleanup
    if (originalWorkspace === undefined) {
      delete process.env['GITHUB_WORKSPACE'];
    } else {
      process.env['GITHUB_WORKSPACE'] = originalWorkspace;
    }
  });

  vitestIt('handles paths at the workspace root', () => {
    process.env['GITHUB_WORKSPACE'] = '/home/runner/work/repo/repo';
    const result = toRelativePath('/home/runner/work/repo/repo/file.ts');
    expect(result).toBe('file.ts');
    // Cleanup
    if (originalWorkspace === undefined) {
      delete process.env['GITHUB_WORKSPACE'];
    } else {
      process.env['GITHUB_WORKSPACE'] = originalWorkspace;
    }
  });
});
