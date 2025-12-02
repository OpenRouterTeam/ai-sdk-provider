/**
 * Single source of truth for all available GitHub Actions.
 *
 * Import this in both cli.ts and ci.ts to ensure consistent action registration.
 */

import ActionUIDemoCommand from './action-ui-demo/action.js';

export default [
  ActionUIDemoCommand,
  // Add more actions here as needed
] as const;
