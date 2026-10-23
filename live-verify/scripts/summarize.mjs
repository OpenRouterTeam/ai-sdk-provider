#!/usr/bin/env node

/**
 * Builds results/summary.md from the vitest JSON reports and probes.json.
 * Usage: node summarize.mjs <resultsDir> [mainSha] [intSha]
 * Missing inputs are reported as "not run" rather than failing.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [
  resultsDir = 'lv-results',
  mainSha = '?',
  intSha = '?',
  intRef = 'claude/live-verify-ci',
] = process.argv.slice(2);

const readJson = (name) => {
  const p = join(resultsDir, name);
  if (!existsSync(p)) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    return { __parseError: String(e) };
  }
};

/** Normalize an absolute test file path to a path relative to the repo. */
const relFile = (file) =>
  String(file ?? '').replace(/^.*?\/(e2e\/|src\/|probes\/)/, '$1');

/** Map<key, {status, failure}> plus file-level load errors. */
function index(report) {
  const tests = new Map();
  const fileErrors = [];
  if (!report || report.__parseError) {
    return { tests, fileErrors };
  }
  for (const file of report.testResults ?? []) {
    const rel = relFile(file.name);
    const assertions = file.assertionResults ?? [];
    if (file.status === 'failed' && assertions.length === 0) {
      fileErrors.push({
        file: rel,
        message: (file.message ?? '').slice(0, 400),
      });
    }
    for (const a of assertions) {
      const name =
        a.fullName || [...(a.ancestorTitles ?? []), a.title].join(' > ');
      tests.set(`${rel} > ${name}`, {
        status: a.status,
        failure: (a.failureMessages ?? [])
          .join('\n')
          .split('\n')[0]
          ?.slice(0, 300),
      });
    }
  }
  return { tests, fileErrors };
}

function counts(report) {
  if (!report) {
    return 'not run';
  }
  if (report.__parseError) {
    return `unreadable (${report.__parseError})`;
  }
  const { tests, fileErrors } = index(report);
  const c = { passed: 0, failed: 0, skipped: 0 };
  for (const t of tests.values()) {
    if (t.status === 'passed') {
      c.passed++;
    } else if (t.status === 'failed') {
      c.failed++;
    } else {
      c.skipped++;
    }
  }
  return (
    `${c.passed} passed, ${c.failed} failed, ${c.skipped} skipped` +
    (fileErrors.length ? `, ${fileErrors.length} file(s) failed to load` : '')
  );
}

const esc = (s) =>
  String(s ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');
const lines = [];
const out = (s = '') => lines.push(s);

out('# Live API verification summary');
out();
out(`- Generated: ${new Date().toISOString()}`);
out(`- Baseline: \`main\` @ ${mainSha}`);
out(`- Integration: \`${intRef}\` @ ${intSha}`);
out();

const suites = ['e2e', 'issues'];
out('## Suite results');
out();
out('| Suite | main | int |');
out('| --- | --- | --- |');
for (const s of suites) {
  out(
    `| ${s} | ${counts(readJson(`main-${s}.json`))} | ${counts(readJson(`int-${s}.json`))} |`,
  );
}
out();

out('## main vs int diff');
out();
for (const s of suites) {
  const main = readJson(`main-${s}.json`);
  const int = readJson(`int-${s}.json`);
  out(`### ${s}`);
  out();
  if (!main || !int) {
    out('_Not compared: one side did not run._');
    out();
    continue;
  }
  const m = index(main);
  const i = index(int);
  const regressions = [];
  const fixed = [];
  const bothFail = [];
  const onlyInt = [];
  for (const [key, it] of i.tests) {
    const mt = m.tests.get(key);
    if (!mt) {
      onlyInt.push([key, it]);
      continue;
    }
    if (mt.status === 'passed' && it.status === 'failed') {
      regressions.push([key, it]);
    } else if (mt.status === 'failed' && it.status === 'passed') {
      fixed.push([key, it]);
    } else if (mt.status === 'failed' && it.status === 'failed') {
      bothFail.push([key, it]);
    }
  }
  const onlyMain = [...m.tests.keys()].filter((k) => !i.tests.has(k));

  out(`**Regressions (pass on main, fail on int): ${regressions.length}**`);
  out();
  for (const [k, t] of regressions) {
    out(`- \`${esc(k)}\`: ${esc(t.failure)}`);
  }
  if (regressions.length) {
    out();
  }
  out(`Fixed on int (fail on main, pass on int): ${fixed.length}`);
  for (const [k] of fixed) {
    out(`- \`${esc(k)}\``);
  }
  out();
  out(`Failing on both (pre-existing / environmental): ${bothFail.length}`);
  for (const [k, t] of bothFail) {
    out(`- \`${esc(k)}\`: ${esc(t.failure)}`);
  }
  out();
  const newFailing = onlyInt.filter(([, t]) => t.status === 'failed');
  out(`Only on int: ${onlyInt.length} (${newFailing.length} failing)`);
  for (const [k, t] of onlyInt) {
    out(
      `- [${t.status}] \`${esc(k)}\`${t.status === 'failed' ? `: ${esc(t.failure)}` : ''}`,
    );
  }
  out();
  if (onlyMain.length) {
    out(`Only on main: ${onlyMain.length}`);
    for (const k of onlyMain) {
      out(`- \`${esc(k)}\``);
    }
    out();
  }
  for (const [side, idx] of [
    ['main', m],
    ['int', i],
  ]) {
    for (const fe of idx.fileErrors) {
      out(`- ${side}: file failed to load \`${fe.file}\`: ${esc(fe.message)}`);
    }
  }
  out();
}

out('## Probe results (integration)');
out();
const probes = readJson('probes.json');
if (!probes) {
  out('_Probes not run._');
} else if (!probes.hasKey) {
  out('_Probes skipped: no OPENROUTER_API_KEY._');
} else {
  const recs = probes.records ?? [];
  const by = (st) => recs.filter((r) => r.status === st).length;
  out(
    `${recs.length} probes: ${by('pass')} pass, ${by('fail')} fail, ${by('optional-fail')} optional-fail, ${by('info')} info, ${by('skipped')} skipped. ` +
      `Requests used: ${probes.used?.requests ?? '?'} / ${probes.limits?.MAX_REQUESTS}. ` +
      `Reported cost: $${(probes.totalCostUsd ?? 0).toFixed(4)}.`,
  );
  out();
  out('| PR | Probe | Status | Model | HTTP | Cost | Notes / error |');
  out('| --- | --- | --- | --- | --- | --- | --- |');
  for (const r of recs) {
    const note = r.error ?? r.notes ?? '';
    out(
      `| ${esc(r.pr)} | ${esc(r.title)} | **${r.status}** | ${esc(r.model)} | ${esc((r.httpStatuses ?? []).join(','))} | ${r.costUsd != null ? `$${r.costUsd.toFixed(5)}` : ''} | ${esc(note).slice(0, 400)} |`,
    );
  }
  out();
  out('### Probe effects');
  out();
  for (const r of recs) {
    if (!r.effect || Object.keys(r.effect).length === 0) {
      continue;
    }
    if (r.id === '597-542-cross-family-matrix') {
      continue;
    }
    out(
      `- **${r.pr} ${r.id}**: \`${esc(JSON.stringify(r.effect)).slice(0, 900)}\``,
    );
  }
  out();
  const matrix = recs.find((r) => r.id === '597-542-cross-family-matrix')
    ?.effect?.matrix;
  if (matrix) {
    out('### #542 cross-family matrix');
    out();
    out('| Case | HTTP | Sent reasoning_details | Provider | Error |');
    out('| --- | --- | --- | --- | --- |');
    for (const [name, v] of Object.entries(matrix)) {
      const val = v ?? {};
      const err =
        val.error ?? (val.bodyError ? JSON.stringify(val.bodyError) : '');
      out(
        `| ${name} | ${val.status ?? ''} | ${esc((val.sentDetailTypes ?? val.detailTypes ?? []).join(', '))} | ${esc(val.provider)} | ${esc(err).slice(0, 500)} |`,
      );
    }
    out();
    const s = (k) => matrix[k]?.status;
    const ok = (k) => s(k) === 200 && !matrix[k]?.bodyError;
    let verdict = 'Inconclusive.';
    if (
      !ok('i-full') &&
      !ok('ii-encrypted-only') &&
      ok('iii-summary-only') &&
      ok('iv-none')
    ) {
      verdict =
        'Backend/upstream rejects OpenAI encrypted reasoning sent to DeepSeek (i/ii fail, iii/iv pass): #542 is a backend issue; the client-side reasoningReplay workaround is needed.';
    } else if (ok('i-full') && ok('ii-encrypted-only')) {
      verdict =
        'Backend accepts the encrypted OpenAI details on DeepSeek: #542 does not reproduce at the API level today.';
    }
    out(`Verdict: ${verdict}`);
    out();
  }
}

writeFileSync(join(resultsDir, 'summary.md'), `${lines.join('\n')}\n`);
console.log(`wrote ${join(resultsDir, 'summary.md')}`);
