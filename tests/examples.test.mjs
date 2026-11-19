import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const lint = join(root, 'scripts', 'slop-lint.mjs');

function report(file, extra = []) {
  const out = spawnSync(process.execPath, [lint, '--json', ...extra, join(root, 'examples', file)], {
    encoding: 'utf8',
  });
  return { ...JSON.parse(out.stdout), code: out.status };
}

test('the crafted example is clean', () => {
  const { summary, code, files } = report('after.html');
  const findings = files.flatMap((f) => f.findings);
  assert.deepEqual(findings.map((f) => `${f.rule} ${f.line}`), []);
  assert.equal(summary.score, 100);
  assert.equal(code, 0);
});

test('the slop example is clearly worse than the crafted one', () => {
  const before = report('before.html');
  const after = report('after.html');
  assert.ok(before.summary.score < 40, `expected < 40, got ${before.summary.score}`);
  assert.ok(before.summary.bySeverity.P1 > 15, `expected many P1, got ${before.summary.bySeverity.P1}`);
  assert.ok(after.summary.score - before.summary.score > 50);
});
