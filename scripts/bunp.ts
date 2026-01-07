#!/usr/bin/env bun

/**
 * bunp - Bump alpha version
 *
 * Usage: bun run bunp
 *
 * Increments the alpha version number:
 *   6.0.0-alpha.0 → 6.0.0-alpha.1
 *   6.0.0-alpha.1 → 6.0.0-alpha.2
 *   etc.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const packageJsonPath = join(import.meta.dir, '..', 'package.json');

// Read current package.json
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const currentVersion = packageJson.version;

// Parse version: expect format like "6.0.0-alpha.0"
const match = currentVersion.match(/^(\d+\.\d+\.\d+)-alpha\.(\d+)$/);

if (!match) {
  console.error(
    `Error: Version "${currentVersion}" is not in alpha format (x.y.z-alpha.N)`,
  );
  process.exit(1);
}

const [, semver, alphaNum] = match;
const newAlphaNum = parseInt(alphaNum, 10) + 1;
const newVersion = `${semver}-alpha.${newAlphaNum}`;

// Update package.json
packageJson.version = newVersion;
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`✓ Bumped version: ${currentVersion} → ${newVersion}`);
