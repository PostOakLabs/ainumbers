// determinism-attestation.test.mjs — site-repo test for the derived artifact
// data/determinism-attestation.json (FARM-DETERMINISM-ATTEST-1).
//
// Run: node --test scripts/determinism-attestation.test.mjs
//
// The artifact is a dated snapshot emitted by the workspace instrument
// scripts/farm-determinism-attest.mjs (which lives OUTSIDE this repo, untracked); this test is
// its in-repo integrity gate. It validates the in-toto Statement v1 shape and — per the
// independent-derivation doctrine — RECOMPUTES each kernel's machines_agreeing /
// machines_total from the per-report evidence records inside the predicate, rather than
// trusting the summary. A DISAGREE-class kernel fails this test: the determinism finding must
// never ship silently inside a green artifact.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATEMENT = JSON.parse(readFileSync(join(ROOT, 'data', 'determinism-attestation.json'), 'utf8'));

const CLASSES = ['agree', 'witness-bound', 'async-sentinel', 'fixture-drift', 'methodology', 'DISAGREE'];
const HEX64 = /^[0-9a-f]{64}$/;
const HEX40 = /^[0-9a-f]{40}$/;

test('artifact is an in-toto Statement v1 with the determinism predicate', () => {
  assert.equal(STATEMENT._type, 'https://in-toto.io/Statement/v1');
  assert.equal(STATEMENT.predicateType, 'ainumbers.co/determinism-attestation/v1');
  assert.ok(Array.isArray(STATEMENT.subject) && STATEMENT.subject.length > 0);
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(STATEMENT.predicate.generated_at), 'dated snapshot carries generated_at');
  assert.ok(['dated-snapshot', 'main-side-derived'].includes(STATEMENT.predicate.kind));
});

test('every subject is a named kernel with a sha256 digest that its kernel entry observed', () => {
  const kernels = STATEMENT.predicate.kernels;
  const names = new Set();
  for (const s of STATEMENT.subject) {
    assert.ok(s.name && HEX64.test(s.digest && s.digest.sha256), `bad subject ${JSON.stringify(s).slice(0, 80)}`);
    assert.ok(!names.has(s.name), `duplicate subject ${s.name}`);
    names.add(s.name);
    const k = kernels[s.name];
    assert.ok(k, `subject ${s.name} has no predicate.kernels entry`);
    assert.ok(
      (k.golden_hashes || []).some((g) => g.golden_hash === s.digest.sha256),
      `subject digest for ${s.name} is not among its kernel's observed golden_hashes`,
    );
  }
});

test('attestor entries carry pin, node build and a signature status', () => {
  assert.ok(STATEMENT.predicate.attestors.length >= 2, 'an attestation needs at least two machine reports');
  for (const a of STATEMENT.predicate.attestors) {
    assert.ok(HEX40.test(a.pin), `attestor ${a.report_id} pin`);
    assert.ok(a.node_build, `attestor ${a.report_id} node_build`);
    assert.ok(['signed', 'unsigned', 'BAD-SIG'].includes(a.signature_status));
    assert.notEqual(a.signature_status, 'BAD-SIG', `a BAD-SIG report (${a.report_id}) must be excluded, not attesting`);
  }
});

test('machines_agreeing / machines_total recompute exactly from the per-report evidence', () => {
  for (const [tool_id, k] of Object.entries(STATEMENT.predicate.kernels)) {
    // evidence is one record per mismatch row (a vector-mode report can mismatch several
    // vectors) — the machine unit is the REPORT: a report is checked if any of its records is
    // an agree/mismatch outcome, and agreeing when its records are agree outcomes.
    const byReport = new Map();
    for (const e of k.evidence || []) {
      const isCheck = e.outcome === 'mismatch' || String(e.outcome).startsWith('agree');
      if (!isCheck) continue;
      const cur = byReport.get(e.report) || { agree: 0, mismatch: 0 };
      if (e.outcome === 'mismatch') cur.mismatch += 1; else cur.agree += 1;
      byReport.set(e.report, cur);
    }
    const checked = [...byReport.keys()].length;
    const agreeing = [...byReport.values()].filter((v) => v.agree > 0 && v.mismatch === 0).length;
    assert.equal(
      k.machines_total, checked,
      `${tool_id}: machines_total ${k.machines_total} != evidence-derived ${checked}`,
    );
    assert.equal(
      k.machines_agreeing, agreeing,
      `${tool_id}: machines_agreeing ${k.machines_agreeing} != evidence-derived ${agreeing}`,
    );
    assert.ok(k.machines_agreeing >= 0 && k.machines_total >= 1, `${tool_id}: agreement bounds`);
    if (k.machines_total > 0) {
      assert.equal(k.pins.length > 0, true, `${tool_id}: pins recorded`);
      assert.ok(k.pins.every((p) => HEX40.test(p)), `${tool_id}: pin shape`);
    }
  }
});

test('every kernel carries a legal class; DISAGREE is empty (a determinism finding must not ship silently)', () => {
  const summary = STATEMENT.predicate.summary;
  let disagree = 0;
  for (const [tool_id, k] of Object.entries(STATEMENT.predicate.kernels)) {
    assert.ok(CLASSES.includes(k.class), `${tool_id}: illegal class ${k.class}`);
    if (k.class === 'DISAGREE') disagree += 1;
    if (k.class !== 'agree') assert.ok((k.exclusion_reasons || []).length >= 1, `${tool_id}: exclusion class without a quoted reason`);
  }
  assert.equal(disagree, 0, `${disagree} DISAGREE kernel(s) — determinism finding, STOP`);
  assert.equal(summary.DISAGREE, 0);
  assert.equal(summary.same_pin_divergences, 0);
  // class counts sum to the kernel universe, and each summary count matches the kernels
  const recount = {};
  for (const k of Object.values(STATEMENT.predicate.kernels)) recount[k.class] = (recount[k.class] || 0) + 1;
  for (const c of CLASSES) assert.equal(summary[c] || 0, recount[c] || 0, `summary class count ${c}`);
  assert.equal(Object.values(recount).reduce((a, b) => a + b, 0), summary.kernels);
});

test('the Nitro cross-machine report is fully accounted for (the row assertion, by evidence not by name list)', () => {
  const nitro = STATEMENT.predicate.attestors.find((a) => /NITRO-GOLDEN-HASH/i.test(a.report_id));
  assert.ok(nitro, 'the Nitro report is among the attestors');
  assert.ok(nitro.counts.mismatch_kernels >= 1, 'the Nitro report recorded mismatches');
  const mismatching = Object.values(STATEMENT.predicate.kernels)
    .filter((k) => (k.evidence || []).some((e) => e.isMismatch && e.report === nitro.report_id));
  assert.equal(mismatching.length, nitro.counts.mismatch_kernels, 'evidence mismatches reconcile with the attestor count');
  for (const k of mismatching) {
    assert.notEqual(k.class, 'DISAGREE', `${k.tool_id}: Nitro mismatch left unclassified`);
    assert.notEqual(k.class, 'agree', `${k.tool_id}: Nitro mismatch cannot be class agree`);
  }
});
