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
import { Effect, Option } from 'effect';
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
  readonly cause: PlatformError;
}

/**
 * Create an ExecError
 */
const makeExecError = (command: string, cause: PlatformError) => ({
  _tag: 'ExecError',
  command,
  cause,
});

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

    const runCommand = Command.string(cmd).pipe(
      Effect.map((output) => output.trim()),
      Effect.mapError((cause) => makeExecError(commandString, cause)),
    );

    // Wrap in ActionUI group if available
    if (Option.isSome(ui)) {
      return yield* ui.value.group(groupLabel, runCommand);
    }

    return yield* runCommand;
  });
};

/**
 * Template literal for running shell commands, returning lines as an array.
 *
 * @example
 * ```typescript
 * const files = yield* $lines`git diff --name-only origin/main`
 * // files: string[]
 * ```
 *
 * @since 0.0.1
 * @category constructors
 */
export const $lines = (strings: TemplateStringsArray, ...values: ReadonlyArray<unknown>) => {
  return $.apply(null, [
    strings,
    ...values,
  ] as unknown as Parameters<typeof $>).pipe(
    Effect.map((output) => output.split('\n').filter(Boolean)),
  );
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

    const runCommand = Command.string(cmd).pipe(
      Effect.map((output) => output.trim()),
      Effect.mapError((cause) => makeExecError(commandString, cause)),
    );

    if (Option.isSome(ui)) {
      return yield* ui.value.group(groupLabel, runCommand);
    }

    return yield* runCommand;
  });
};
