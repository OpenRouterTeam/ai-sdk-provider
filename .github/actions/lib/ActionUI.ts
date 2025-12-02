/**
 * ActionUI Service
 *
 * Effect wrapper around @actions/core for GitHub Actions workflow commands.
 *
 * @example
 * ```typescript
 * import { ActionUI } from '@openrouter-monorepo/github-action-utils'
 * import { Effect } from 'effect'
 *
 * const program = Effect.gen(function* () {
 *   const ui = yield* ActionUI
 *
 *   yield* ui.group('Installing dependencies', Effect.gen(function* () {
 *     yield* ui.info('Running npm install...')
 *   }))
 *
 *   yield* ui.error('Type error found', { file: 'src/index.ts', startLine: 42 })
 * })
 *
 * // In CI: Effect.provide(program, ActionUI.Default)
 * // Local: Effect.provide(program, ActionUI.Mock)
 * ```
 */

import type * as ConsoleModule from 'effect/Console';

import * as ActionsCore from '@actions/core';
import { Cause, Chunk, Console, Effect, Layer } from 'effect';

// Re-export the type from @actions/core for convenience
export type { AnnotationProperties } from '@actions/core';

/**
 * ActionUI Service - GitHub Actions workflow commands as Effect
 *
 * - `ActionUI.Default` - wraps @actions/core (for CI)
 * - `ActionUI.Mock` - console output (for local dev)
 */
export class ActionUI extends Effect.Service<ActionUI>()(
  '@openrouter/ActionUI',
  {
    succeed: {
      // Logging
      debug: (message: string) => Effect.sync(() => ActionsCore.debug(message)),
      info: (message: string) => Effect.sync(() => ActionsCore.info(message)),

      // Annotations
      error: (message: string, properties?: ActionsCore.AnnotationProperties) =>
        Effect.sync(() => ActionsCore.error(message, properties)),
      warning: (
        message: string,
        properties?: ActionsCore.AnnotationProperties,
      ) => Effect.sync(() => ActionsCore.warning(message, properties)),
      notice: (
        message: string,
        properties?: ActionsCore.AnnotationProperties,
      ) => Effect.sync(() => ActionsCore.notice(message, properties)),

      // Groups - Effect-native wrapper with proper resource management
      group: <A, E, R>(name: string, effect: Effect.Effect<A, E, R>) =>
        Effect.acquireUseRelease(
          Effect.sync(() => ActionsCore.startGroup(name)),
          () => effect,
          () => Effect.sync(() => ActionsCore.endGroup()),
        ),

      // Masking
      setSecret: (secret: string) =>
        Effect.sync(() => ActionsCore.setSecret(secret)),

      // Outputs & Environment
      setOutput: (name: string, value: unknown) =>
        Effect.sync(() => ActionsCore.setOutput(name, value)),
      exportVariable: (name: string, value: unknown) =>
        Effect.sync(() => ActionsCore.exportVariable(name, String(value))),
      addPath: (inputPath: string) =>
        Effect.sync(() => ActionsCore.addPath(inputPath)),

      // State
      isDebug: Effect.sync(() => ActionsCore.isDebug()),
      setFailed: (message: string) =>
        Effect.sync(() => ActionsCore.setFailed(message)),
    },
  },
) {
  /**
   * Mock layer for local development.
   * Uses Effect's Console service (via consoleWith) instead of global console,
   * enabling proper testing by providing a mock Console layer.
   */
  static readonly Mock = Layer.succeed(
    ActionUI,
    new ActionUI({
      debug: (message: string) =>
        Effect.consoleWith((c) => c.debug(`[DEBUG] ${message}`)),
      info: (message: string) => Effect.consoleWith((c) => c.log(message)),

      error: (message: string, properties?: ActionsCore.AnnotationProperties) =>
        Effect.consoleWith((c) => {
          const loc = properties?.file
            ? ` (${properties.file}:${properties.startLine ?? '?'})`
            : '';
          return c.error(`[ERROR] ${message}${loc}`);
        }),
      warning: (
        message: string,
        properties?: ActionsCore.AnnotationProperties,
      ) =>
        Effect.consoleWith((c) => {
          const loc = properties?.file
            ? ` (${properties.file}:${properties.startLine ?? '?'})`
            : '';
          return c.warn(`[WARNING] ${message}${loc}`);
        }),
      notice: (
        message: string,
        properties?: ActionsCore.AnnotationProperties,
      ) =>
        Effect.consoleWith((c) => {
          const loc = properties?.file
            ? ` (${properties.file}:${properties.startLine ?? '?'})`
            : '';
          return c.log(`[NOTICE] ${message}${loc}`);
        }),

      group: <A, E, R>(name: string, effect: Effect.Effect<A, E, R>) =>
        Effect.acquireUseRelease(
          Effect.consoleWith((c) => c.log(`▶ ${name}`)),
          () => effect,
          () => Effect.consoleWith((c) => c.log(`◀ ${name}`)),
        ),

      setSecret: (secret: string) =>
        Effect.consoleWith((c) =>
          c.log(`[MASK] Registered secret (${secret.length} chars)`),
        ),

      setOutput: (name: string, value: unknown) =>
        Effect.consoleWith((c) => c.log(`[OUTPUT] ${name}=${value}`)),
      exportVariable: (name: string, value: unknown) =>
        Effect.gen(function* () {
          process.env[name] = String(value);
          yield* Effect.consoleWith((c) => c.log(`[ENV] ${name}=${value}`));
        }),
      addPath: (inputPath: string) =>
        Effect.gen(function* () {
          process.env['PATH'] = `${inputPath}:${process.env['PATH']}`;
          yield* Effect.consoleWith((c) => c.log(`[PATH] Added: ${inputPath}`));
        }),

      isDebug: Effect.sync(
        () =>
          process.env['DEBUG'] === '1' || process.env['RUNNER_DEBUG'] === '1',
      ),
      setFailed: (message: string) =>
        Effect.gen(function* () {
          process.exitCode = 1;
          yield* Effect.consoleWith((c) => c.error(`[FAILED] ${message}`));
        }),
    }),
  );
}

// ============================================================================
// GitHub Actions Console (replaces Effect's default Console)
// ============================================================================

/**
 * Console implementation that emits GitHub Actions workflow commands.
 *
 * Makes Effect's Console.group, Console.error, Console.warn, Console.debug
 * render as foldable groups and annotations in the GitHub Actions UI.
 */
const makeGitHubActionsConsole = (): ConsoleModule.Console => {
  const unsafeConsole: ConsoleModule.UnsafeConsole = {
    assert: (cond, ...args) => {
      if (!cond) {
        ActionsCore.error(`Assertion failed: ${args.map(String).join(' ')}`);
      }
    },
    clear: () => {},
    count: (label = 'default') => ActionsCore.info(`${label}: count`),
    countReset: () => {},
    debug: (...args) => ActionsCore.debug(args.map(String).join(' ')),
    dir: (item) => ActionsCore.info(JSON.stringify(item, null, 2)),
    dirxml: (...args) => ActionsCore.info(args.map(String).join(' ')),
    error: (...args) => ActionsCore.error(args.map(String).join(' ')),
    group: (...args) => ActionsCore.startGroup(args.map(String).join(' ')),
    groupCollapsed: (...args) =>
      ActionsCore.startGroup(args.map(String).join(' ')),
    groupEnd: () => ActionsCore.endGroup(),
    info: (...args) => ActionsCore.info(args.map(String).join(' ')),
    log: (...args) => ActionsCore.info(args.map(String).join(' ')),
    table: (data) => ActionsCore.info(JSON.stringify(data, null, 2)),
    time: () => {},
    timeEnd: () => {},
    timeLog: () => {},
    trace: (...args) =>
      ActionsCore.info(`Trace: ${args.map(String).join(' ')}`),
    warn: (...args) => ActionsCore.warning(args.map(String).join(' ')),
  };

  return {
    [Console.TypeId]: Console.TypeId,
    assert: (cond, ...args) =>
      Effect.sync(() => unsafeConsole.assert(cond, ...args)),
    clear: Effect.sync(() => unsafeConsole.clear()),
    count: (label) => Effect.sync(() => unsafeConsole.count(label)),
    countReset: (label) => Effect.sync(() => unsafeConsole.countReset(label)),
    debug: (...args) => Effect.sync(() => unsafeConsole.debug(...args)),
    dir: (item, opts) => Effect.sync(() => unsafeConsole.dir(item, opts)),
    dirxml: (...args) => Effect.sync(() => unsafeConsole.dirxml(...args)),
    error: (...args) => Effect.sync(() => unsafeConsole.error(...args)),
    group: (opts) =>
      Effect.sync(() =>
        opts?.collapsed
          ? unsafeConsole.groupCollapsed(opts?.label ?? '')
          : unsafeConsole.group(opts?.label ?? ''),
      ),
    groupEnd: Effect.sync(() => unsafeConsole.groupEnd()),
    info: (...args) => Effect.sync(() => unsafeConsole.info(...args)),
    log: (...args) => Effect.sync(() => unsafeConsole.log(...args)),
    table: (data, props) =>
      Effect.sync(() => unsafeConsole.table(data, props as Array<string>)),
    time: (label) => Effect.sync(() => unsafeConsole.time(label)),
    timeEnd: (label) => Effect.sync(() => unsafeConsole.timeEnd(label)),
    timeLog: (label, ...args) =>
      Effect.sync(() => unsafeConsole.timeLog(label, ...args)),
    trace: (...args) => Effect.sync(() => unsafeConsole.trace(...args)),
    warn: (...args) => Effect.sync(() => unsafeConsole.warn(...args)),
    unsafe: unsafeConsole,
  };
};

/**
 * Layer that replaces Effect's Console with one that emits GitHub Actions workflow commands.
 */
export const GitHubActionsConsoleLayer: Layer.Layer<never> = Console.setConsole(
  makeGitHubActionsConsole(),
);

/**
 * Combined layer for GitHub Actions environment.
 * Provides ActionUI service + Console replacement.
 */
export const GitHubActionsLayer = Layer.mergeAll(
  ActionUI.Default,
  GitHubActionsConsoleLayer,
);

// ============================================================================
// Defect Reporting - Emit GitHub Actions annotations for unexpected errors
// ============================================================================

/**
 * Parse a stack trace line to extract file, line, and column info.
 * Handles both V8-style and Bun-style stack traces.
 *
 * Examples:
 *   "    at foo (/path/to/file.ts:10:5)"
 *   "    at /path/to/file.ts:10:5"
 *   "      at foo (file:///path/to/file.ts:10:5)"
 */
const parseStackLine = (line: string) => {
  // Match: "at <name> (<path>:<line>:<col>)" or "at <path>:<line>:<col>"
  const match = line.match(
    /at\s+(?:.*?\s+\()?(?:file:\/\/)?(.+?):(\d+):(\d+)\)?/,
  );
  if (match) {
    const [, file, lineStr, colStr] = match;
    return {
      file: file!,
      line: Number.parseInt(lineStr!, 10),
      column: colStr ? Number.parseInt(colStr, 10) : undefined,
    };
  }
  return undefined;
};

/**
 * Extract the error message from a defect.
 */
const getDefectMessage = (defect: unknown) => {
  if (defect instanceof Error) {
    return defect.message;
  }
  if (typeof defect === 'string') {
    return defect;
  }
  return String(defect);
};

/**
 * Extract the stack trace from a defect.
 */
const getDefectStack = (defect: unknown) => {
  if (defect instanceof Error) {
    return defect.stack;
  }
  return undefined;
};

/**
 * Report a Cause to GitHub Actions UI with proper annotations.
 *
 * - For each defect (Die), emits an error annotation at the source location
 * - For each failure (Fail), emits an error annotation
 * - Calls setFailed with the primary error message
 *
 * @example
 * ```typescript
 * Effect.catchAllCause(myProgram, (cause) =>
 *   reportCauseToActions(cause)
 * )
 * ```
 */
export const reportCauseToActions = <E>(cause: Cause.Cause<E>) =>
  Effect.sync(() => {
    // Report all defects (unexpected errors) with annotations
    const defects = Cause.defects(cause);
    for (const defect of Chunk.toReadonlyArray(defects)) {
      const message = getDefectMessage(defect);
      const stack = getDefectStack(defect);

      // Try to get the first user-code stack frame for annotation
      if (stack) {
        const lines = stack.split('\n');
        for (const line of lines) {
          // Skip internal/node_modules frames
          if (line.includes('node_modules') || line.includes('internal/')) {
            continue;
          }
          const parsed = parseStackLine(line);
          if (parsed) {
            const annotation: ActionsCore.AnnotationProperties = {
              file: parsed.file,
              startLine: parsed.line,
            };
            if (parsed.column !== undefined) {
              annotation.startColumn = parsed.column;
            }
            ActionsCore.error(message, annotation);
            break; // Only annotate the first relevant frame
          }
        }
      } else {
        ActionsCore.error(`Unexpected error: ${message}`);
      }
    }

    // Report all failures (expected errors)
    const failures = Cause.failures(cause);
    for (const failure of Chunk.toReadonlyArray(failures)) {
      const message =
        failure instanceof Error ? failure.message : String(failure);
      ActionsCore.error(`Error: ${message}`);
    }

    // Set the step as failed with a summary message
    const primaryMessage = Cause.isInterruptedOnly(cause)
      ? 'Action was interrupted'
      : Chunk.size(defects) > 0
        ? getDefectMessage(Chunk.unsafeHead(defects))
        : Chunk.size(failures) > 0
          ? String(Chunk.unsafeHead(failures))
          : 'Action failed with unknown error';

    ActionsCore.setFailed(primaryMessage);
  });

/**
 * Wrap an effect to report any defects to GitHub Actions UI.
 *
 * This catches all causes (including defects) and reports them as annotations
 * before re-raising the error. Use this at the entrypoint level.
 *
 * @example
 * ```typescript
 * cli(process.argv).pipe(
 *   withActionsErrorReporting,
 *   Effect.provide(CILayer),
 *   BunRuntime.runMain,
 * )
 * ```
 */
export const withActionsErrorReporting = Effect.tapErrorCause((cause) => {
  // Skip if only interrupted (user cancelled)
  if (Cause.isInterruptedOnly(cause)) {
    return Effect.void;
  }
  return reportCauseToActions(cause);
});
