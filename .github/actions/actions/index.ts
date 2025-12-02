/**
 * Single source of truth for all available GitHub Actions.
 *
 * Import this in both cli.ts and ci.ts to ensure consistent action registration.
 */

import UIDemoCommand from './ui-demo/action.js';

export default [
  UIDemoCommand,
  // Add more actions here as needed
] as const;
