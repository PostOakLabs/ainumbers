#!/usr/bin/env node
/**
 * scripts/check-webmcp-signed-snapshot.mjs: WEBMCP-SIGNED-SNAPSHOT-1 verifier.
 *
 * Verifies /.well-known/webmcp-signed.json (written by sign-webmcp-snapshot.mjs):
 *   - detached EdDSA JWS over JCS(snapshot minus signatures), via the shared
 *     scripts/lib/detached-jws.mjs, against the public key the agent-card checker
 *     uses (the did:key kid, cross-checked against /.well-known/jwks.json);
 *   - protected header typ MUST be exactly "webmcp-snapshot+jws" (an agent-card JWS,
 *     typ "JOSE", must FAIL);
 *   - structural source integrity: tools[] well-formed (sorted unique names, 64-hex hashes).
 *
 * RED (exit 1) ONLY on integrity: bad signature, wrong typ/kid, malformed snapshot.
 * Advisory (never failing): snapshot age, absent file, and drift of the live
 * registration set vs the snapshot (changed / missing / new tools). The live set
 * legitimately moves with each regen; `--strict` makes hash drift RED for a signing row.
 *
 * Absent snapshot: reports "absent" and exits 0 (the first signature is committed by
 * the row that ran the signer; this gate then guards it).
 *
 * Usage:
 *   node scripts/check-webmcp-signed-snapshot.mjs                  # verify (preflight gate)
 *   node scripts/check-webmcp-signed-snapshot.mjs --self-test      # RED/GREEN fixture proof
 *   node scripts/check-webmcp-signed-snapshot.mjs --pub <pem>      # TESTS ONLY: public-key override
 *   node scripts/check-webmcp-signed-snapshot.mjs --strict         # hash drift is RED
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyDetached, signDetached, loadSigningKey } from './lib/detached-jws.mjs';
import { buildSnapshotTools, SNAPSHOT_TYP, SNAPSHOT_REL } from './lib/webmcp-snapshot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SNAP_PATH = resolve(REPO, SNAPSHOT_REL);
const JWKS_PATH = resolve(REPO, '.well-known', 'jwks.json');
const argv = process.argv.slice(2);
const pubIdx = argv.indexOf('--pub');
const PUB_OVERRIDE = pubIdx > -1 ? resolve(process.cwd(), argv[pubIdx + 1]) : undefined;
const STRICT = argv.includes('--strict');

const HEX64 = /^[0-9a-f]{64}$/;

function red(msg) {
  console.error(`✗ webmcp signed snapshot: ${msg}`);
  process.exit(1);
}

/** Structural integrity of the snapshot body; returns an error string or null. */
function checkStructure(snap) {
  if (typeof snap.generated_at !== 'string' || Number.isNaN(Date.parse(snap.generated_at))) return 'generated_at is not an ISO time';
  if (typeof snap.source_commit !== 'string' || !/^[0-9a-f]{7,64}$/.test(snap.source_commit)) return 'source_commit is not a hex commit id';
  if (!Array.isArray(snap.tools) || snap.tools.length === 0) return 'tools[] missing or empty';
  let prev = '';
  for (const t of snap.tools) {
    if (typeof t?.name !== 'string' || t.name <= prev) return `tools[] not sorted-unique at ${JSON.stringify(t?.name)}`;
    prev = t.name;
    for (const k of ['description_sha256', 'input_schema_sha256', 'annotations_sha256'])
      if (!HEX64.test(t[k] ?? '')) return `tool ${t.name}: ${k} is not a 64-hex sha256`;
  }
  return null;
}

/** JWKS cross-check (skipped when --pub overrides the key for tests). */
function checkJwks(kid) {
  if (PUB_OVERRIDE) return null;
  if (!existsSync(JWKS_PATH)) return 'no /.well-known/jwks.json on disk';
  let jwks;
  try { jwks = JSON.parse(readFileSync(JWKS_PATH, 'utf8')); } catch (e) { return `jwks.json is not valid JSON (${e.message})`; }
  const key = (jwks.keys || []).find((k) => k.kty === 'OKP' && k.crv === 'Ed25519' && k.kid === kid);
  return key ? null : `signing kid ${kid} not present in jwks.json keys`;
}

async function verifySnapshot(snap, pubPemPath) {
  const s = await verifyDetached(snap, { typ: SNAPSHOT_TYP, pubPemPath });
  if (!s.ok) return s;
  const bad = checkStructure(snap);
  if (bad) return { ok: false, why: `source integrity: ${bad}` };
  return s;
}

// ── --self-test: ephemeral key, in-memory fixtures; works with or without a committed snapshot ──
if (argv.includes('--self-test')) {
  const tmp = mkdtempSync(join(tmpdir(), 'wsn-selftest-'));
  try {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const keyPath = join(tmp, 'k.pem');
    const pubPath = join(tmp, 'p.pem');
    writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
    writeFileSync(pubPath, publicKey.export({ type: 'spki', format: 'pem' }));
    const { privKey, kid } = await loadSigningKey(keyPath);
    const h = (c) => c.repeat(64);
    const snap = {
      generated_at: '2026-01-01T00:00:00.000Z', source_commit: 'abcdef1',
      tools: [{ name: 'a_tool', description_sha256: h('a'), input_schema_sha256: h('b'), annotations_sha256: h('c') }],
    };
    snap.signatures = [await signDetached(snap, { privKey, kid, typ: SNAPSHOT_TYP })];
    const g = await verifySnapshot(snap, pubPath);
    if (!g.ok) red(`SELF-TEST: untampered fixture failed: ${g.why}`);
    const flipped = structuredClone(snap); // flip ONE byte of tool content
    flipped.tools[0].description_sha256 = h('d');
    if ((await verifySnapshot(flipped, pubPath)).ok) red('SELF-TEST INCONCLUSIVE: a tampered tool hash VERIFIED, gate is blind');
    console.log('✓ self-test RED: one flipped tool-hash byte, verify correctly FAILED');
    const badSig = structuredClone(snap);
    badSig.signatures[0].signature = (badSig.signatures[0].signature[0] === 'A' ? 'B' : 'A') + badSig.signatures[0].signature.slice(1);
    if ((await verifySnapshot(badSig, pubPath)).ok) red('SELF-TEST INCONCLUSIVE: a tampered signature VERIFIED');
    console.log('✓ self-test RED: tampered signature, verify correctly FAILED');
    const wrongTyp = structuredClone(snap); delete wrongTyp.signatures;
    wrongTyp.signatures = [await signDetached(wrongTyp, { privKey, kid, typ: 'JOSE' })]; // agent-card typ
    const wt = await verifySnapshot(wrongTyp, pubPath);
    if (wt.ok) red('SELF-TEST INCONCLUSIVE: an agent-card-typ (JOSE) signature verified as a snapshot');
    console.log(`✓ self-test RED: agent-card typ rejected (${wt.why})`);
    const again = await verifySnapshot(snap, pubPath);
    if (!again.ok) red(`SELF-TEST: untampered fixture failed after tamper runs: ${again.why}`);
    console.log('✓ self-test GREEN: untampered fixture verifies (typ webmcp-snapshot+jws)');
    process.exit(0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ── normal verify ─────────────────────────────────────────────────────────────
if (!existsSync(SNAP_PATH)) {
  console.log(`○ webmcp signed snapshot: absent (${SNAPSHOT_REL} not yet signed; advisory, not RED)`);
  process.exit(0);
}
let snap;
try { snap = JSON.parse(readFileSync(SNAP_PATH, 'utf8')); } catch (e) { red(`${SNAPSHOT_REL} is not valid JSON (${e.message})`); }
const r = await verifySnapshot(snap, PUB_OVERRIDE);
if (!r.ok) red(r.why);
const jwksErr = checkJwks(r.kid);
if (jwksErr) red(jwksErr);

// Advisory drift/age report (never fails unless --strict).
const ageDays = Math.floor((Date.now() - Date.parse(snap.generated_at)) / 86400000);
let drift = { changed: 0, missing: 0, added: 0 };
try {
  const live = new Map(buildSnapshotTools(REPO).map((t) => [t.name, t]));
  const mine = new Map(snap.tools.map((t) => [t.name, t]));
  for (const [n, t] of mine) {
    const l = live.get(n);
    if (!l) drift.missing++;
    else if (['description_sha256', 'input_schema_sha256', 'annotations_sha256'].some((k) => l[k] !== t[k])) drift.changed++;
  }
  for (const n of live.keys()) if (!mine.has(n)) drift.added++;
} catch (e) {
  console.log(`  drift: not computed (${e.message})`);
  drift = null;
}
console.log(`✓ webmcp signed snapshot valid (kid ${r.kid}; typ ${SNAPSHOT_TYP}; ${snap.tools.length} tools)`);
console.log(`  age: ${ageDays} day(s) (advisory)`);
if (drift) {
  console.log(`  drift vs live set (advisory): ${drift.changed} changed, ${drift.missing} missing from live, ${drift.added} not yet in snapshot`);
  if (STRICT && (drift.changed || drift.missing || drift.added)) red('--strict: live registration set differs from the snapshot; re-sign');
}
