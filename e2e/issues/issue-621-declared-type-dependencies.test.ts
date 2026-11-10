/**
 * Regression test for GitHub issue #621
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/621
 *
 * Reported error: TS2307: Cannot find module '@ai-sdk/provider' (pnpm
 * isolated with hoist=false, skipLibCheck: false); under other layouts the
 * provider types silently became `any` or bound to an arbitrary hoisted copy.
 * SDK version: @openrouter/ai-sdk-provider 3.1.0
 *
 * This test verifies that every package imported by the library source (and
 * by the built `dist/**\/*.d.ts`, when present) is declared in `dependencies`
 * or `peerDependencies`, and that the optional peers are bundled at runtime.
 * It only runs under `pnpm test:issues`. The real guard, which CI runs, is
 * `scripts/check-consumer-types.mjs` (`pnpm check:consumer-types`): it type-
 * checks user code against the packed tarball across package-manager layouts
 * and `ai` versions.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(import.meta.dirname, '..', '..');
const pkg: {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
} = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]);

function listFiles(dir: string, accept: (file: string) => boolean): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return listFiles(full, accept);
    }
    return accept(full) ? [full] : [];
  });
}

function importedPackages(files: string[]): Set<string> {
  const specifier = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;
  const packages = new Set<string>();
  for (const file of files) {
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(specifier)) {
      if (
        !spec ||
        spec.startsWith('.') ||
        spec.startsWith('@/') ||
        spec.startsWith('node:')
      ) {
        continue;
      }
      const parts = spec.split('/');
      packages.add(
        spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!,
      );
    }
  }
  return packages;
}

const distDir = join(repoRoot, 'dist');

describe('Issue #621: type declarations import undeclared packages', () => {
  it('declares @ai-sdk/provider and @ai-sdk/provider-utils as optional peers', () => {
    // Optional peers (not dependencies) so the `.d.ts` files bind to the exact
    // copies the consumer's `ai` version pins, instead of a newer copy that
    // npm/pnpm would install for a caret dependency.
    for (const name of ['@ai-sdk/provider', '@ai-sdk/provider-utils']) {
      expect(pkg.dependencies ?? {}).not.toHaveProperty(name);
      expect(pkg.peerDependencies).toHaveProperty(name);
      expect(pkg.peerDependenciesMeta?.[name]?.optional).toBe(true);
    }
  });

  it('declares every package imported by library source', () => {
    const files = listFiles(
      join(repoRoot, 'src'),
      (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
    );
    const undeclared = [...importedPackages(files)].filter(
      (name) => !declared.has(name),
    );
    expect(undeclared).toEqual([]);
  });

  it.skipIf(!existsSync(distDir))(
    'declares every package imported by built type declarations',
    () => {
      const files = listFiles(distDir, (f) => f.endsWith('.d.ts'));
      expect(files.length).toBeGreaterThan(0);
      const undeclared = [...importedPackages(files)].filter(
        (name) => !declared.has(name),
      );
      expect(undeclared).toEqual([]);
    },
  );

  it.skipIf(!existsSync(distDir))(
    'bundles optional peers into the runtime JS',
    () => {
      // Optional peers may be absent at runtime, so the JS must not import them.
      const files = listFiles(distDir, (f) => f.endsWith('.js'));
      expect(files.length).toBeGreaterThan(0);
      const imported = importedPackages(files);
      expect(imported).not.toContain('@ai-sdk/provider');
      expect(imported).not.toContain('@ai-sdk/provider-utils');
    },
  );
});
