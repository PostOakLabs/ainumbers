/**
 * KERNEL-PREFLIGHT-RATCHETS-1 controls: kernel-preflight's READY bar includes the three
 * estate ratchets (flag-mirror, R4 null-class, flags-computed), judged only on findings
 * that name the kernel under test.
 *
 *   GREEN: an existing, baselined-clean kernel passes all three steps.
 *   RED:   a scratch kernel with an unconditional compliance_flags push (a NEW
 *          flags-computed violation, id absent from every baseline) fails that step.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREFLIGHT = resolve(REPO, 'scripts', 'kernel-preflight.mjs');
const RATCHET_LABELS = ['Flag-mirror', 'R4 null-class', 'Flags-computed'];

function preflight(id) {
  const r = spawnSync(process.execPath, [PREFLIGHT, id, '--fast', '--keep-going'], { cwd: REPO, encoding: 'utf8' });
  return (r.stdout || '') + (r.stderr || '');
}

test('GREEN: a clean kernel passes all three ratchet steps', () => {
  const out = preflight('art-617-m3p-monthly-cap-calculator');
  for (const label of RATCHET_LABELS) {
    assert.match(out, new RegExp(`✓ PASS\\s+\\d+ms\\s+${label}`), `${label} should PASS:\n${out}`);
  }
});

test('RED: a new unconditional flag emission fails the flags-computed step', () => {
  const id = 'art-9999-ratchet-probe';
  const file = resolve(REPO, 'chaingraph', 'kernels', `${id}.kernel.mjs`);
  writeFileSync(file, [
    `export const meta = { tool_id: '${id}' };`,
    'export function compute(pp) {',
    '  const compliance_flags = [];',
    "  compliance_flags.push('PROBE_COMPUTED');",
    '  return { output_payload: { ok: true }, compliance_flags };',
    '}',
    '',
  ].join('\n'));
  // The ratchet scripts enumerate git-tracked kernels, so register the scratch file as
  // intent-to-add for the run and unregister it in `finally`.
  const rel = `chaingraph/kernels/${id}.kernel.mjs`;
  try {
    spawnSync('git', ['add', '-N', '--', rel], { cwd: REPO });
    const out = preflight(id);
    assert.match(out, /✗ FAIL\s+\d+ms\s+Flags-computed/, out);
    assert.match(out, new RegExp(`${id} is named by node scripts/check-flags-computed\\.mjs`), out);
  } finally {
    spawnSync('git', ['rm', '--cached', '-q', '-f', '--', rel], { cwd: REPO });
    rmSync(file, { force: true });
  }
});
