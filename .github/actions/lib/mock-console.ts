/**
 * MockConsole - A mock Console implementation for testing
 *
 * Based on Effect's testing pattern: provides a Console implementation that
 * captures all output in a Ref, allowing tests to verify console output
 * without mutating the global console.
 */

import * as EffectArray from 'effect/Array';
import * as Console from 'effect/Console';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Ref from 'effect/Ref';

/**
 * Extended Console interface with getLines method for retrieving captured output
 */
export interface MockConsole extends Console.Console {
  readonly getLines: () => Effect.Effect<ReadonlyArray<string>>;
}

/**
 * Tag for MockConsole service - uses the same identifier as Console so it
 * seamlessly replaces the default Console in the fiber context
 */
export const MockConsole = Context.GenericTag<Console.Console, MockConsole>('effect/Console');

/**
 * Create a MockConsole instance that captures all log output
 */
export const make = Effect.gen(function* () {
  const lines = yield* Ref.make(EffectArray.empty<string>());

  const getLines: MockConsole['getLines'] = () => Ref.get(lines);

  // Capture log/info/warn/error/debug calls
  const log: MockConsole['log'] = (...args) =>
    Ref.update(lines, EffectArray.append(args.map(String).join(' ')));

  const warn: MockConsole['warn'] = (...args) =>
    Ref.update(lines, EffectArray.append(args.map(String).join(' ')));

  const error: MockConsole['error'] = (...args) =>
    Ref.update(lines, EffectArray.append(args.map(String).join(' ')));

  const debug: MockConsole['debug'] = (...args) =>
    Ref.update(lines, EffectArray.append(args.map(String).join(' ')));

  const info: MockConsole['info'] = (...args) =>
    Ref.update(lines, EffectArray.append(args.map(String).join(' ')));

  return MockConsole.of({
    [Console.TypeId]: Console.TypeId,
    getLines,
    log,
    warn,
    error,
    debug,
    info,
    // Provide the real console as unsafe for any code that needs it
    unsafe: globalThis.console,
    // All other methods are no-ops
    assert: () => Effect.void,
    clear: Effect.void,
    count: () => Effect.void,
    countReset: () => Effect.void,
    dir: () => Effect.void,
    dirxml: () => Effect.void,
    group: () => Effect.void,
    groupEnd: Effect.void,
    table: () => Effect.void,
    time: () => Effect.void,
    timeEnd: () => Effect.void,
    timeLog: () => Effect.void,
    trace: () => Effect.void,
  });
});

/**
 * Layer that provides MockConsole as the Console service
 */
export const layer = Layer.unwrapEffect(Effect.map(make, (console) => Console.setConsole(console)));

/**
 * Helper to get captured lines from the current Console context.
 * Must be used within an effect that has MockConsole provided.
 */
export const getLines = (): Effect.Effect<ReadonlyArray<string>> =>
  Effect.consoleWith((console) => (console as MockConsole).getLines());
