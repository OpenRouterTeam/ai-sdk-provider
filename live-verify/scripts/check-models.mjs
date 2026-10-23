#!/usr/bin/env node

/**
 * Verifies the probe model slugs against the public OpenRouter catalog (no key)
 * and prints prices plus an estimated probe cost.
 *   - /api/v1/models?output_modalities=all  (includes rerank + decisions models)
 *   - /api/v1/models/<slug>/endpoints        (live endpoints, provider slugs)
 * Exit code 1 if a slug is missing or lacks a required capability.
 * Reads probes/lib/models.ts directly (Node >= 23.6 strips TS types).
 */
import { MODELS, ROUTING } from '../probes/lib/models.ts';

const BASE = 'https://openrouter.ai/api/v1';
const get = async (path) => {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`${path}: HTTP ${res.status}`);
  }
  return res.json();
};

/** Capability requirements per model role. */
const REQUIRE = {
  anthropic: { params: ['tools', 'reasoning'], efforts: ['max'] },
  anthropicThinking: { params: ['tools', 'reasoning'] },
  openaiReasoning: { params: ['reasoning'] },
  openaiLuna: { params: ['tools', 'reasoning'] },
  deepseek: { params: ['tools'] },
  openaiCheap: {
    params: ['tools'],
    input: ['image'],
    providers: [ROUTING.configuredOrder, ROUTING.other],
  },
  geminiVideo: { input: ['video'] },
  geminiVideoProcessing: { input: ['video'] },
  rerank: { output: ['rerank'] },
  decision: { output: ['decisions'] },
};

/**
 * Rough per-probe token budgets [input, output] per role, summed over every
 * request the probes make with that role (see README for the breakdown).
 */
const BUDGET = {
  anthropic: [32_000, 2_200], // 517 (2x ~15k-token tool), 590, 566
  anthropicThinking: [2_500, 2_048], // 583: 2 turns
  openaiReasoning: [600, 4_600], // 518, 592, 600 x2, 608 x2
  openaiLuna: [600, 2_048], // 542 turn 1 raw + sdk
  deepseek: [2_000, 1_536], // 542: 6 turn-2 requests
  openaiCheap: [12_000, 400], // 552 (low+high ~4k), 598 x2, 548, 605 x2, 606
  geminiVideo: [7_000, 32], // 601: 19 s video
  geminiVideoProcessing: [12_000, 64], // 584 (agentic may load more)
  decision: [400, 0], // 577
};

const catalog = (await get('/models?output_modalities=all')).data;
const byId = new Map(catalog.map((m) => [m.id, m]));
let ok = true;
let estimate = 0;
const rows = [];

for (const [role, slug] of Object.entries(MODELS)) {
  const m = byId.get(slug);
  const req = REQUIRE[role] ?? {};
  const problems = [];
  if (!m) {
    problems.push('NOT IN CATALOG');
  } else {
    const params = new Set(m.supported_parameters ?? []);
    for (const p of req.params ?? []) {
      if (!params.has(p)) {
        problems.push(`no ${p}`);
      }
    }
    const inputs = new Set(m.architecture?.input_modalities ?? []);
    for (const i of req.input ?? []) {
      if (!inputs.has(i)) {
        problems.push(`no ${i} input`);
      }
    }
    const outputs = new Set(m.architecture?.output_modalities ?? []);
    for (const o of req.output ?? []) {
      if (!outputs.has(o)) {
        problems.push(`no ${o} output`);
      }
    }
    const efforts = new Set(m.reasoning?.supported_efforts ?? []);
    for (const e of req.efforts ?? []) {
      if (!efforts.has(e)) {
        problems.push(`no effort ${e}`);
      }
    }
  }
  let endpoints = [];
  try {
    endpoints = (await get(`/models/${slug}/endpoints`)).data?.endpoints ?? [];
  } catch (e) {
    problems.push(`endpoints: ${e.message}`);
  }
  if (endpoints.length === 0) {
    problems.push('no live endpoints');
  }
  const tags = endpoints.map((e) => String(e.tag ?? '').split('/')[0]);
  for (const p of req.providers ?? []) {
    if (!tags.includes(p)) {
      problems.push(`no ${p} endpoint`);
    }
  }

  const pin = Number(m?.pricing?.prompt ?? 0) * 1e6;
  const pout = Number(m?.pricing?.completion ?? 0) * 1e6;
  const [tin, tout] = BUDGET[role] ?? [0, 0];
  const cost = (tin * pin + tout * pout) / 1e6;
  estimate += cost;
  if (problems.length) {
    ok = false;
  }
  rows.push({
    role,
    slug,
    price: `$${pin.toFixed(3)} / $${pout.toFixed(3)} per 1M`,
    endpoints: [...new Set(tags)].join(',') || '-',
    est: `$${cost.toFixed(5)}`,
    status: problems.length ? `FAIL: ${problems.join('; ')}` : 'ok',
  });
}

for (const r of rows) {
  console.log(
    `${r.status === 'ok' ? 'OK  ' : 'FAIL'} ${r.role.padEnd(22)} ${r.slug.padEnd(32)} ${r.price.padEnd(28)} est ${r.est.padEnd(10)} [${r.endpoints}]${r.status === 'ok' ? '' : `  ${r.status}`}`,
  );
}
// Flat per-request fees not in token prices.
const fees =
  0.002 /* rerank search */ + 0.01 /* possible web_search fallback (#606) */;
console.log(
  `Estimated probe token cost: $${estimate.toFixed(4)} + up to $${fees.toFixed(3)} per-request fees = ~$${(estimate + fees).toFixed(3)}`,
);
process.exit(ok ? 0 : 1);
