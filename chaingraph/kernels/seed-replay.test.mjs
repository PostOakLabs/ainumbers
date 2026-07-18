// seed-replay.test.mjs — §24.6.2 `seeded-stochastic` replay gate (SPEC.md §15).
//
// §24.6 doctrine: a determinism class is TESTED, not merely asserted. `seeded-stochastic` is a
// STRONGER claim than `estimated` — it says the kernel's pseudo-random draws replay bit-identically
// from a declared integer seed — and that claim is not what the §4 parity/finite gates already
// measure, so it earns a gate of its own.
//
// Three checks:
//   (a) REPLAY  — a declared (prng_algorithm, seed, draw_count) reproduces a byte-identical draw
//                 sequence, digested through the CANONICAL §4 hash path, matching the committed
//                 reference vector. Proves replay determinism against a frozen value, not just
//                 against a second run in the same process.
//   (b) TAMPER  — the SAME generator at the fixture's tampered seed MUST produce a DIFFERENT
//                 digest. This is the check that matters: it proves the seed is genuinely
//                 load-bearing rather than a decorative receipt field. A `seeded-stochastic`
//                 declaration whose seed does not move the output is a false claim.
//   (c) ESTATE  — every kernel declaring `seeded-stochastic` is re-run at its own declared seed
//                 (byte-identical `execution_hash` REQUIRED) and again at a perturbed seed
//                 (a DIFFERENT hash REQUIRED), plus the three fields MUST all be present.
//
// (a) and (b) run UNCONDITIONALLY, before any kernel scan — same pattern as
// quantization-parity.test.mjs's self-test — so the replay and tamper-detect paths stay proven
// even in an estate with zero `seeded-stochastic` kernels. `art-371` (ART371-CLASS-RELOCATE)
// is the first live adopter: determinism_class is hash-excluded metadata (§24.6) and lives on
// the top-level artifact, never inside output_payload — the estate scan below checks it there.
//
// Zero-dependency. Wired into scripts/preflight.mjs.
//   node chaingraph/kernels/seed-replay.test.mjs

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionHash } from './_hash.mjs';
import { KERNELS } from './index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, 'fixtures', 'seed-replay.fixtures.json');
const MASK64 = (1n << 64n) - 1n;

let fail = 0, checked = 0;

// ── Reference generator: splitmix64 seed expansion + xoshiro256** (integer-only). ──────────────
// This is the `prng_algorithm` the reference deployment names in §24.6.2. It is reproduced here
// deliberately rather than imported from a kernel: the gate must be able to verify a kernel's
// replay claim without depending on that kernel's own code being correct.
function splitmix64(seed) {
  let z = seed & MASK64;
  return function next() {
    z = (z + 0x9E3779B97F4A7C15n) & MASK64;
    let x = z;
    x = ((x ^ (x >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK64;
    x = ((x ^ (x >> 27n)) * 0x94D049BB133111EBn) & MASK64;
    x = x ^ (x >> 31n);
    return x & MASK64;
  };
}
function rotl(x, k) { return ((x << k) | (x >> (64n - k))) & MASK64; }
function makeXoshiro256ss(seed) {
  const sm = splitmix64(BigInt(seed) & MASK64);
  let s0 = sm(), s1 = sm(), s2 = sm(), s3 = sm();
  return function next() {
    const result = (rotl((s1 * 5n) & MASK64, 7n) * 9n) & MASK64;
    const t = (s1 << 17n) & MASK64;
    s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3; s2 ^= t;
    s3 = rotl(s3, 45n);
    return result;
  };
}

// Digest a draw sequence through the CANONICAL §4 hash path (_hash.mjs / RFC 8785 JCS).
// Never hand-canonicalize — that is the forbidden "Scheme E" lint-forbidden-hash catches.
// BigInt draws are rendered as decimal strings: JCS has no BigInt, and a string keeps every
// one of the 64 bits, where a Number would silently lose precision above 2^53.
async function drawDigest({ prng_algorithm, seed, draw_count }) {
  if (prng_algorithm !== 'xoshiro256**') {
    throw new Error(`unsupported prng_algorithm "${prng_algorithm}" — the gate implements xoshiro256** only`);
  }
  const rng = makeXoshiro256ss(seed);
  const draws = [];
  for (let i = 0; i < draw_count; i++) draws.push(rng().toString());
  return executionHash({ prng_algorithm, seed, draw_count }, { draws });
}

// ── (a) + (b): unconditional replay + tamper-detect against the committed reference vector ─────
if (!existsSync(FIXTURE)) {
  console.error(`✗ committed reference vector missing: fixtures/seed-replay.fixtures.json — the unconditional replay/tamper checks cannot run.`);
  fail++;
} else {
  const fx = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const v = fx.reference_vector ?? {};
  const { prng_algorithm, seed, draw_count, tampered_seed, expected_digest } = v;

  if (typeof seed !== 'number' || typeof tampered_seed !== 'number' || seed === tampered_seed) {
    console.error('✗ reference vector: `seed` and `tampered_seed` must both be integers and MUST differ (a negative fixture that matches the positive one proves nothing).');
    fail++;
  } else {
    // (a) REPLAY — twice in-process (determinism) AND against the frozen committed digest.
    const d1 = await drawDigest(v);
    const d2 = await drawDigest(v);
    if (d1 !== d2) {
      console.error(`✗ replay: two runs at the same declared seed produced different digests (${d1} != ${d2}) — the reference generator is not deterministic.`);
      fail++;
    } else if (d1 !== expected_digest) {
      console.error(`✗ replay: digest ${d1} does not match the committed expected_digest ${expected_digest} — replay drift against the frozen reference vector.`);
      fail++;
    } else {
      console.log(`✓ replay: ${draw_count} ${prng_algorithm} draws at seed ${seed} reproduce the committed digest byte-identically.`);
      checked++;
    }

    // (b) TAMPER — the negative fixture MUST fail to reproduce it.
    const dTampered = await drawDigest({ ...v, seed: tampered_seed });
    if (dTampered === expected_digest) {
      console.error(`✗ tamper: the tampered seed ${tampered_seed} reproduced the SAME digest as seed ${seed} — the seed is not load-bearing, so a \`seeded-stochastic\` declaration would be a false claim.`);
      fail++;
    } else {
      console.log(`✓ tamper: tampered seed ${tampered_seed} yields a different digest — the seed is load-bearing, as \`seeded-stochastic\` requires.`);
      checked++;
    }
  }
}

// ── (c): every kernel that actually declares the class ─────────────────────────────────────────
for (const [id, kernel] of Object.entries(KERNELS)) {
  if (typeof kernel?.buildArtifact !== 'function') continue;

  let probe;
  try { probe = await kernel.buildArtifact({}, { now: null }); } catch { continue; }
  const op = probe?.output_payload;
  // determinism_class is hash-excluded metadata (SPEC.md §24.6) — it lives on the top-level
  // artifact, never inside output_payload; check the artifact field, not the payload.
  if (probe?.determinism_class !== 'seeded-stochastic') continue; // other classes are out of scope

  const missing = ['prng_algorithm', 'seed', 'draw_count'].filter((f) => op[f] === undefined || op[f] === null);
  if (missing.length) {
    console.error(`✗ ${id}: declares seeded-stochastic but the receipt omits ${missing.join(', ')} — §24.6.2 requires all three.`);
    fail++; continue;
  }
  if (!Number.isInteger(op.seed)) {
    console.error(`✗ ${id}: declares seeded-stochastic but \`seed\` is not an integer (${op.seed}).`);
    fail++; continue;
  }

  // REPLAY at the declared seed → byte-identical execution_hash.
  const a = await kernel.buildArtifact({ seed: op.seed }, { now: null });
  const b = await kernel.buildArtifact({ seed: op.seed }, { now: null });
  if (a.execution_hash !== b.execution_hash) {
    console.error(`✗ ${id}: two runs at declared seed ${op.seed} produced different execution_hash values — not bit-identical on replay, so the class is over-claimed. Declare \`estimated\` instead.`);
    fail++; continue;
  }

  // TAMPER at a perturbed seed → the hash MUST move.
  const t = await kernel.buildArtifact({ seed: op.seed + 1 }, { now: null });
  if (t.execution_hash === a.execution_hash) {
    console.error(`✗ ${id}: perturbing the seed did NOT change execution_hash — the declared seed is decorative, not load-bearing.`);
    fail++; continue;
  }

  console.log(`✓ ${id}: seeded-stochastic verified — replays byte-identically at seed ${op.seed}, and a perturbed seed moves the hash.`);
  checked++;
}

if (fail === 0) {
  console.log(`\n✓ seed-replay clean — ${checked} check(s) passed.`);
  process.exit(0);
}
console.error(`\n✗ ${fail} seed-replay failure(s).`);
process.exit(1);
