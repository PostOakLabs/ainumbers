// art-677-whistleblowing-channel-clock.proptest.mjs
// kernel_digest_at_authoring: sha256:44d66e7fb0a9a0cf87611ad6f6eacd54080cf60d68fa2a39d37fdef885063af0
//
// Property tests for the Whistleblowing Channel Clock kernel (WHISTLEBLOW-CLOCK-BUILD-1).
// Run: node --test chaingraph/kernels/__proptests__/art-677-whistleblowing-channel-clock.proptest.mjs
//
// Deterministic seeded generator (xorshift32) -- no Math.random, no runtime clock, so the
// run is reproducible. Every generated date is a real civil calendar date.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, meta } from '../art-677-whistleblowing-channel-clock.kernel.mjs';
import { executionHash } from '../_hash.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- deterministic xorshift32 PRNG (seed fixed; reproducible runs) ---
let seed = 0x67767701 >>> 0;
function rnd() {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 4294967296;
}
function rndInt(lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }

const LEAP = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function daysInMonth(y, m) { return m === 2 && LEAP(y) ? 29 : DIM[m - 1]; }
function randDate() {
  const y = rndInt(1970, 2100);
  const m = rndInt(1, 12);
  const d = rndInt(1, daysInMonth(y, m));
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function dateComponents(s) {
  return { y: +s.slice(0, 4), m: +s.slice(5, 7), d: +s.slice(8, 10) };
}
function daysFromCivil(y, m, d) {
  const y2 = m <= 2 ? y - 1 : y;
  const era = Math.floor(y2 / 400);
  const yoe = y2 - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
const dayNumber = (s) => { const c = dateComponents(s); return daysFromCivil(c.y, c.m, c.d); };
function civilFromDays(z) {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const yAdj = m <= 2 ? y + 1 : y;
  return `${String(yAdj).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const HERE = dirname(fileURLToPath(import.meta.url));

// --- golden fixtures oracle ---
test('fixture oracle: every golden vector recomputes byte-identically', async () => {
  const fx = JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'art-677-whistleblowing-channel-clock.fixtures.json'), 'utf8'));
  assert.ok(fx.vectors.length >= 6, 'at least 6 vectors');
  for (const v of fx.vectors) {
    const r = compute(v.policy_parameters);
    assert.deepEqual(r.output_payload, v.output_payload, `payload drift on ${v.name}`);
    assert.equal(await executionHash(v.policy_parameters, r.output_payload), v.golden_hash, `hash drift on ${v.name}`);
  }
});

test('spec pin: the canonical preimage hash is the spec byte-pin', async () => {
  const fx = JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'art-677-whistleblowing-channel-clock.fixtures.json'), 'utf8'));
  const pin = fx.vectors.find((v) => v.name === 'parity-canonical-preimage');
  assert.equal(pin.golden_hash, '8589545f4c067fae4cbf01ee5e1481dd6476cb14c47f6dd4603ed83398b93579');
});

// --- P1: window rule (ack_days = ack - receipt, within_7 iff ack_days <= 7) ---
test('P1 ack window rule holds for 30,000 generated compliant-order inputs', () => {
  for (let i = 0; i < 30000; i++) {
    const receipt = randDate();
    const ack = civilFromDays(dayNumber(receipt) + rndInt(0, 60));
    const basis = rndInt(1, 365);
    const r = compute({ report_received: receipt, ack_sent: ack, followup_basis_days: basis });
    const ackDays = dayNumber(ack) - dayNumber(receipt);
    assert.equal(r.output_payload.ack_days, ackDays);
    assert.equal(r.output_payload.ack_within_7, ackDays <= 7);
    assert.equal(r.output_payload.overall, ackDays <= 7 ? 'CLOCKS_COMPLIANT' : 'ACK_WINDOW_BREACHED');
  }
});

// --- P2: follow-up due = receipt + basis civil days, always a valid canonical date ---
test('P2 follow-up due date is receipt + basis civil days, canonical form', () => {
  for (let i = 0; i < 30000; i++) {
    const receipt = randDate();
    const ack = civilFromDays(dayNumber(receipt) + rndInt(0, 30));
    const basis = rndInt(1, 3650);
    const r = compute({ report_received: receipt, ack_sent: ack, followup_basis_days: basis });
    assert.equal(r.output_payload.followup_due, civilFromDays(dayNumber(receipt) + basis));
    assert.match(r.output_payload.followup_due, /^\d{4}-\d{2}-\d{2}$/);
    const c = dateComponents(r.output_payload.followup_due);
    assert.ok(c.m >= 1 && c.m <= 12 && c.d >= 1 && c.d <= daysInMonth(c.y, c.m));
  }
});

// --- P3: determinism (same inputs, same payload, no hidden state) ---
test('P3 compute() is deterministic across repeated calls', () => {
  const pp = { report_received: '2026-02-28', ack_sent: '2026-03-05', followup_basis_days: 90 };
  const a = compute(pp).output_payload;
  for (let i = 0; i < 100; i++) assert.deepEqual(compute(pp).output_payload, a);
});

// --- P4: fail-closed refusals name every offending input, never repair silently ---
test('P4 malformed inputs fail closed with named domain_errors', () => {
  /** @type {[Record<string, unknown>, string[]][]} */
  const bad = [
    [{}, ['INVALID_REPORT_RECEIVED', 'INVALID_ACK_SENT', 'INVALID_BASIS']],
    [{ report_received: '2026-13-01', ack_sent: '2026-09-05', followup_basis_days: 90 }, ['INVALID_REPORT_RECEIVED']],
    [{ report_received: '2026-09-01', ack_sent: '2026-02-30', followup_basis_days: 90 }, ['INVALID_ACK_SENT']],
    [{ report_received: '2026-09-01', ack_sent: '2026-09-05', followup_basis_days: 0 }, ['INVALID_BASIS']],
    [{ report_received: '2026-09-01', ack_sent: '2026-09-05', followup_basis_days: -90 }, ['INVALID_BASIS']],
    [{ report_received: '2026-09-01', ack_sent: '2026-09-05', followup_basis_days: '90' }, ['INVALID_BASIS']],
    [{ report_received: '2026-09-01', ack_sent: '2026-08-30', followup_basis_days: 90 }, ['ACK_BEFORE_REPORT']],
    [{ report_received: 123, ack_sent: null, followup_basis_days: NaN }, ['INVALID_REPORT_RECEIVED', 'INVALID_ACK_SENT', 'INVALID_BASIS']],
  ];
  for (const [pp, expected] of bad) {
    const r = compute(pp);
    assert.equal(r.output_payload.overall, 'INPUT_REFUSED');
    assert.deepEqual(r.output_payload.domain_errors.sort(), [...expected].sort());
    assert.equal(r.output_payload.ack_days, null);
    assert.equal(r.output_payload.followup_due, null);
    assert.ok(r.compliance_flags.includes('DOMAIN_ERROR'));
  }
});

// --- P5: leap-year and month-boundary civil arithmetic correctness ---
test('P5 civil arithmetic is leap-year and month-boundary correct', () => {
  // 2024 leap: 2024-02-28 + 1 = 2024-02-29; 2023: + 1 = 2024-03-01
  assert.equal(compute({ report_received: '2024-02-28', ack_sent: '2024-02-28', followup_basis_days: 1 }).output_payload.followup_due, '2024-02-29');
  assert.equal(compute({ report_received: '2023-02-28', ack_sent: '2023-02-28', followup_basis_days: 1 }).output_payload.followup_due, '2023-03-01');
  // month boundary: 2026-09-30 + 1 = 2026-10-01
  assert.equal(compute({ report_received: '2026-09-30', ack_sent: '2026-09-30', followup_basis_days: 1 }).output_payload.followup_due, '2026-10-01');
  // year boundary: 2026-12-31 + 1 = 2027-01-01
  assert.equal(compute({ report_received: '2026-12-31', ack_sent: '2026-12-31', followup_basis_days: 1 }).output_payload.followup_due, '2027-01-01');
});

// --- P6: shape and meta invariants ---
test('P6 output shape is exactly the five pinned keys; meta invariants hold', async () => {
  const r = compute({ report_received: '2026-09-01', ack_sent: '2026-09-05', followup_basis_days: 90 });
  assert.deepEqual(Object.keys(r.output_payload).sort(), ['ack_days', 'ack_within_7', 'followup_due', 'overall', 'trace']);
  const art = await (await import('../art-677-whistleblowing-channel-clock.kernel.mjs')).buildArtifact({ report_received: '2026-09-01', ack_sent: '2026-09-05', followup_basis_days: 90 });
  assert.equal(typeof art.execution_hash, 'string');
  assert.equal(art.execution_hash.length, 64);
  assert.equal(art.tool_id, 'art-677-whistleblowing-channel-clock');
  assert.equal(meta.mcp_name, 'compute_whistleblowing_channel_clock');
  assert.equal(meta.gpu, false);
});
