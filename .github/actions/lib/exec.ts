/**
 * Shell Command Template Literal (`$`)
 *
 * Provides a zx-style syntax for running shell commands with Effect.
 * Commands are automatically wrapped in ActionUI groups for CI log folding.
 *
 * @example
 * ```typescript
 * import { $ } from '@openrouter-monorepo/github-action-utils'
 * import { Effect } from 'effect'
 *
 * const program = Effect.gen(function* () {
 *   // Simple command
 *   yield* $`git fetch origin main`
 *
 *   // With interpolation
 *   const branch = 'feature-branch'
 *   yield* $`git checkout ${branch}`
 *
 *   // Capture output (automatically trimmed)
 *   const diff = yield* $`git diff --name-only origin/main`
 *   const files = diff.split('\n')
 * })
 * ```
 *
 * @since 0.0.1
 * @category exec
 */

import type { PlatformError } from '@effect/platform/Error';

import { Command } from '@effect/platform';
import { SystemError } from '@effect/platform/Error';
import { Console, Effect, Option, Redacted, Stream } from 'effect';
import { ActionUI } from './action-ui.js';

/**
 * Error when command execution fails
 *
 * @since 0.0.1
 * @category errors
 */
export interface ExecError {
  readonly _tag: 'ExecError';
  readonly command: string;
  readonly exitCode?: number;
  readonly cause: PlatformError;
}

/**
 * Create an ExecError
 */
const makeExecError = (command: string, cause: PlatformError, exitCode?: number): ExecError => ({
  _tag: 'ExecError',
  command,
  exitCode,
  cause,
});

/**
 * Run a command, streaming both stdout and stderr to console while collecting output.
 * Properly checks exit code and fails if non-zero.
 */
const runCommandWithTee = (cmd: Command.Command, commandString: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const lines: string[] = [];
      const process = yield* Command.start(cmd);

      // Create text decoders for stdout and stderr
      const stdoutDecoder = new TextDecoder();
      const stderrDecoder = new TextDecoder();
      let stdoutBuffer = '';
      let stderrBuffer = '';

      // Merge stdout and stderr streams and process them together
      const mergedStream = Stream.merge(
        process.stdout.pipe(
          Stream.map((chunk) => ({
            type: 'stdout' as const,
            chunk,
          })),
        ),
        process.stderr.pipe(
          Stream.map((chunk) => ({
            type: 'stderr' as const,
            chunk,
          })),
        ),
      );

      yield* mergedStream.pipe(
        Stream.tap(({ type, chunk }) =>
          Effect.gen(function* () {
            const decoder = type === 'stdout' ? stdoutDecoder : stderrDecoder;
            const buffer = type === 'stdout' ? stdoutBuffer : stderrBuffer;
            const newContent = decoder.decode(chunk, {
              stream: true,
            });
            const fullContent = buffer + newContent;
            const parts = fullContent.split('\n');

            // Keep the last incomplete line in the buffer
            const remaining = parts.pop() ?? '';
            if (type === 'stdout') {
              stdoutBuffer = remaining;
            } else {
              stderrBuffer = remaining;
            }

            // Process complete lines
            for (const line of parts) {
              lines.push(line);
              yield* Console.log(line);
            }
          }),
        ),
        Stream.runDrain,
      );

      // Flush any remaining content in buffers
      if (stdoutBuffer.length > 0) {
        lines.push(stdoutBuffer);
        yield* Console.log(stdoutBuffer);
      }
      if (stderrBuffer.length > 0) {
        lines.push(stderrBuffer);
        yield* Console.log(stderrBuffer);
      }

      // Wait for process to exit and check exit code
      const exitCode = yield* process.exitCode;

      if (exitCode !== 0) {
        return yield* Effect.fail(
          makeExecError(
            commandString,
            new SystemError({
              reason: 'Unknown',
              module: 'Command',
              method: 'exec',
              pathOrDescriptor: commandString,
              description: `Command failed with exit code ${exitCode}`,
            }),
            exitCode,
          ),
        );
      }

      return lines.join('\n').trim();
    }),
  ).pipe(
    Effect.mapError((cause) =>
      cause._tag === 'ExecError' ? cause : makeExecError(commandString, cause),
    ),
  );

/**
 * Build a command string from template literal parts
 */
const buildCommandString = (strings: TemplateStringsArray, values: ReadonlyArray<unknown>) => {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      const value = values[i];
      result += value !== undefined && value !== null ? String(value) : '';
    }
  }
  return result.trim();
};

/**
 * Parse a command string into command and arguments.
 * Uses simple whitespace splitting. For complex commands with pipes, redirects, etc.,
 * use Command.make('sh', '-c', '...') directly.
 */
const parseCommand = (commandString: string) => {
  const parts = commandString.split(/\s+/).filter((p) => p.length > 0);
  const [command = '', ...args] = parts;
  return {
    command,
    args,
  };
};

/**
 * Template literal for running shell commands.
 * Wraps the command in an ActionUI group for CI log folding.
 *
 * @example
 * ```typescript
 * // Simple command
 * yield* $`git status`
 *
 * // With interpolation
 * const file = 'package.json'
 * yield* $`cat ${file}`
 *
 * // Capture output
 * const output = yield* $`npm version`
 * ```
 *
 * @since 0.0.1
 * @category constructors
 */
export const $ = (strings: TemplateStringsArray, ...values: ReadonlyArray<unknown>) => {
  const commandString = buildCommandString(strings, values);
  const { args, command } = parseCommand(commandString);

  if (!command) {
    return Effect.die(new Error('Empty command'));
  }

  const cmd = Command.make(command, ...args);
  const groupLabel = `$ ${commandString}`;

  return Effect.gen(function* () {
    const ui = yield* Effect.serviceOption(ActionUI);
    const runCommand = runCommandWithTee(cmd, commandString);

    // Wrap in ActionUI group if available
    if (Option.isSome(ui)) {
      return yield* ui.value.group(groupLabel, runCommand);
    }

    return yield* runCommand;
  });
};

/**
 * Template literal for running shell commands, returning lines as an array.
 * Runs through a shell interpreter, so supports globs, pipes, redirects, etc.
 *
 * @example
 * ```typescript
 * const files = yield* $lines`git diff --name-only origin/main`
 * // files: string[]
 *
 * // Supports shell features
 * const mdFiles = yield* $lines`ls *.md`
 * const filtered = yield* $lines`cat file.txt | grep pattern`
 * ```
 *
 * @since 0.0.1
 * @category constructors
 */
export const $lines = (strings: TemplateStringsArray, ...values: ReadonlyArray<unknown>) => {
  return $sh(strings, ...values).pipe(Effect.map((output) => output.split('\n').filter(Boolean)));
};

/**
 * Create a Command from a template literal without executing it.
 * Useful when you need to customize the command (env, cwd, etc.) before running.
 *
 * @example
 * ```typescript
 * const cmd = $cmd`npm install`
 * const output = yield* Command.string(cmd.pipe(
 *   Command.env({ NODE_ENV: 'production' }),
 *   Command.workingDirectory('/app')
 * ))
 * ```
 *
 * @since 0.0.1
 * @category constructors
 */
export const $cmd = (strings: TemplateStringsArray, ...values: ReadonlyArray<unknown>) => {
  const commandString = buildCommandString(strings, values);
  const { args, command } = parseCommand(commandString);

  if (!command) {
    throw new Error('Empty command');
  }

  return Command.make(command, ...args);
};

/**
 * Run a command through a shell interpreter.
 * Useful for commands with pipes, redirects, or shell features.
 *
 * @example
 * ```typescript
 * const result = yield* $sh`cat file.txt | grep pattern | wc -l`
 * ```
 *
 * @since 0.0.1
 * @category constructors
 */
export const $sh = (strings: TemplateStringsArray, ...values: ReadonlyArray<unknown>) => {
  const commandString = buildCommandString(strings, values);

  if (!commandString) {
    return Effect.die(new Error('Empty command'));
  }

  const cmd = Command.make('sh', '-c', commandString);
  const groupLabel = `$ ${commandString}`;

  return Effect.gen(function* () {
    const ui = yield* Effect.serviceOption(ActionUI);
    const runCommand = runCommandWithTee(cmd, commandString);

    if (Option.isSome(ui)) {
      return yield* ui.value.group(groupLabel, runCommand);
    }

    return yield* runCommand;
  });
};

/**
 * Run a command silently without logging output.
 * Used internally for commands that return sensitive data.
 * Properly checks exit code and fails if non-zero.
 */
const runCommandSilent = (cmd: Command.Command, commandString: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const process = yield* Command.start(cmd);
      const chunks: Uint8Array[] = [];
      yield* process.stdout.pipe(
        Stream.tap((chunk) => Effect.sync(() => chunks.push(chunk))),
        Stream.runDrain,
      );
      const exitCode = yield* process.exitCode;

      if (exitCode !== 0) {
        return yield* Effect.fail(
          makeExecError(
            commandString,
            new SystemError({
              reason: 'Unknown',
              module: 'Command',
              method: 'exec',
              pathOrDescriptor: commandString,
              description: `Command failed with exit code ${exitCode}`,
            }),
            exitCode,
          ),
        );
      }

      const decoder = new TextDecoder();
      return chunks
        .map((c) => decoder.decode(c))
        .join('')
        .trim();
    }),
  ).pipe(
    Effect.mapError((cause) =>
      cause._tag === 'ExecError' ? cause : makeExecError(commandString, cause),
    ),
  );

/**
 * Template literal for running shell commands that return sensitive data.
 * Output is NOT logged to console and is returned as a Redacted value.
 *
 * @example
 * ```typescript
 * // Get a secret token without logging it
 * const token = yield* $secret`gh auth token`
 * // Use Redacted.value(token) when you need the actual value
 * ```
 *
 * @since 0.0.1
 * @category constructors
 */
export const $secret = (strings: TemplateStringsArray, ...values: ReadonlyArray<unknown>) => {
  const commandString = buildCommandString(strings, values);
  const { args, command } = parseCommand(commandString);

  if (!command) {
    return Effect.die(new Error('Empty command'));
  }

  const cmd = Command.make(command, ...args);

  return runCommandSilent(cmd, commandString).pipe(Effect.map(Redacted.make));
};
