/**
 * Single source of truth for all available GitHub Actions.
 *
 * Import this in both cli.ts and ci.ts to ensure consistent action registration.
 */

import ExampleCommand from './example/action.js';

export default [
  ExampleCommand,
  // Add more actions here as needed
] as const;
