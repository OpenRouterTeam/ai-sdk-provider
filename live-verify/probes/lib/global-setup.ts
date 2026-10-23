/**
 * Resets per-probe records before the run and merges them into
 * `$LIVE_VERIFY_RESULTS/probes.json` afterwards.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const RESULTS_DIR =
  process.env.LIVE_VERIFY_RESULTS || join(process.cwd(), 'lv-results');
const RECORDS_DIR = join(RESULTS_DIR, 'probes.d');

export function setup() {
  rmSync(RECORDS_DIR, { recursive: true, force: true });
  mkdirSync(RECORDS_DIR, { recursive: true });
}

export function teardown() {
  const records = existsSync(RECORDS_DIR)
    ? readdirSync(RECORDS_DIR)
        .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
        .sort()
        .map((f) => JSON.parse(readFileSync(join(RECORDS_DIR, f), 'utf8')))
    : [];
  let budget: unknown = null;
  try {
    budget = JSON.parse(
      readFileSync(join(RECORDS_DIR, '_budget.json'), 'utf8'),
    );
  } catch {
    budget = { probes: 0, requests: 0 };
  }
  const totalCost = records.reduce(
    (sum: number, r: { costUsd?: number }) => sum + (r.costUsd ?? 0),
    0,
  );
  writeFileSync(
    join(RESULTS_DIR, 'probes.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        hasKey: Boolean(process.env.OPENROUTER_API_KEY),
        limits: {
          MAX_PROBES: Number(process.env.MAX_PROBES || 40),
          MAX_REQUESTS: Number(process.env.MAX_REQUESTS || 90),
        },
        used: budget,
        totalCostUsd: Number(totalCost.toFixed(6)),
        records,
      },
      null,
      2,
    ),
  );
}
