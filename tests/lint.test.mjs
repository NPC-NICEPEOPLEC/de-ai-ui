import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const lint = join(root, 'scripts', 'slop-lint.mjs');
const slop = join(root, 'tests', 'fixtures', 'slop.html');
const craft = join(root, 'tests', 'fixtures', 'craft.html');

function run(args) {
  const out = spawnSync(process.execPath, [lint, ...args], { encoding: 'utf8' });
  return { code: out.status, stdout: out.stdout, stderr: out.stderr };
}

function walkFindings(node, acc = []) {
  if (!node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    for (const item of node) walkFindings(item, acc);
    return acc;
  }
  if (node.rule && node.severity) acc.push(node);
  for (const value of Object.values(node)) walkFindings(value, acc);
  return acc;
}

test('slop fixture trips every headline rule', () => {
  const { stdout, code } = run(['--json', slop]);
  const report = JSON.parse(stdout);
  const ids = new Set(walkFindings(report).map((f) => f.rule));

  const required = [
    'R001', 'R002', 'R003',
    'C001', 'C003',
    'T001', 'T002', 'T003', 'T004', 'T005', 'T006',
    'Y001', 'Y002', 'Y003',
    'L001', 'L002',
    'M001', 'M002', 'M003',
    'A001', 'A002',
    'K001', 'D001',
    'S001', 'S002',
  ];
  const missing = required.filter((id) => !ids.has(id));
  assert.deepEqual(missing, [], `missing rules: ${missing.join(', ')}`);
  assert.equal(code, 1, 'slop fixture must fail the default score gate');
});

test('craft fixture is clean', () => {
  const { stdout, code } = run(['--json', craft]);
  const report = JSON.parse(stdout);
  const findings = walkFindings(report);
  assert.deepEqual(
    findings.map((f) => `${f.rule}:${f.line}:${f.message}`),
    [],
    'craft fixture must produce zero findings',
  );
  assert.equal(report.summary.score, 100);
  assert.equal(code, 0);
});

test('human output names the file, line and rule', () => {
  const { stdout } = run([slop]);
  assert.match(stdout, /slop\.html/);
  assert.match(stdout, /C001/);
  assert.match(stdout, /score/i);
});

test('severity filter hides lower tiers', () => {
  const { stdout } = run(['--json', '--min-severity', 'P0', slop]);
  const report = JSON.parse(stdout);
  const findings = walkFindings(report);
  assert.equal(findings.filter((f) => f.severity !== 'P0').length, 0);
});

test('unknown path exits 2 with a readable error', () => {
  const { code, stderr } = run(['does-not-exist.html']);
  assert.equal(code, 2);
  assert.match(stderr, /no such file|not found|ENOENT/i);
});
