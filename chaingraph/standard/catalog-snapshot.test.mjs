// catalog-snapshot.test.mjs — §PIN-1 GATE (SPEC.md §PIN-1, additive slug section).
// Proves: the OPTIONAL `catalog_cid` chain member is a real pin and not decoration.
//   (a) every `catalog_cid` present in the live catalog decodes via §CID-1 fromCid()
//       — and a catalog carrying ZERO of them is REPORTED as zero, never read as a pass (SO #34c);
//   (b) malformed / foreign-profile CIDs are REJECTED, both by fromCid() and by the published
//       schema pattern, the latter measured by running the real schema-validate.mjs gate over a
//       synthetic catalog (no second validator, no copied expectation);
//   (c) positive vector — toCid(sha256(current chaingraph.json)) round-trips back to the same
//       digest and matches the pattern the schema itself declares (read from the schema file);
//   (d) tamper vector — one flipped catalog byte changes the CID.
//
// PERMANENT RED CONTROL: the shape assertions read the `catalog_cid` property out of
// openchain-graph-v0.4.schema.json. Point this run at a pre-§PIN-1 schema and it goes red:
//   SCHEMA=<path to a schema without catalog_cid> node chaingraph/standard/catalog-snapshot.test.mjs
// That is the RED-before-GREEN proof for this gate — a schema that does not declare the member
// cannot be made to pass by the test's own vectors.
//
// Node 18+, zero npm deps.
// Run:  node chaingraph/standard/catalog-snapshot.test.mjs
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toCid, fromCid } from '../kernels/_cid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = process.env.SCHEMA || resolve(HERE, 'openchain-graph-v0.4.schema.json');
const CATALOG_PATH = process.env.CHAINGRAPH || resolve(HERE, '..', 'chaingraph.json');
const VALIDATOR = resolve(HERE, 'schema-validate.mjs');

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// ---- §PIN-1.0: the schema must DECLARE the member. Everything below tests what it declares. ----
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
const chainProps = schema?.$defs?.chain?.properties ?? {};
const decl = chainProps.catalog_cid;
ok(!!decl, `$defs/chain declares the OPTIONAL catalog_cid member (${SCHEMA_PATH})`);
ok(decl?.type === 'string', 'catalog_cid is declared as a string');
ok(typeof decl?.pattern === 'string' && decl.pattern.length > 0, 'catalog_cid declares a text-form pattern');
ok(!(schema?.$defs?.chain?.required || []).includes('catalog_cid'),
  'catalog_cid is OPTIONAL — absence stays conformant (§PIN-1.3)');
if (!decl || typeof decl.pattern !== 'string') {
  console.error('\nNo catalog_cid declaration to test against — §PIN-1 is not in this schema.');
  process.exit(1);
}
const PATTERN = new RegExp(decl.pattern);

// ---- Independent anchor: SHA-256("") is a published constant, and its §CID-1 form is the vector
// cid-roundtrip.test.mjs already cross-checks. Asserting it here proves the encoder this gate uses
// is the validated one before any self-computed catalog value is trusted. ----
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const EMPTY_CID = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';
ok(createHash('sha256').update(Buffer.alloc(0)).digest('hex') === EMPTY_SHA256,
  'node:crypto reproduces the published SHA-256(empty) constant (the hashing path is the expected one)');
ok(toCid(EMPTY_SHA256) === EMPTY_CID, 'toCid() matches the published SHA-256(empty) cross-check vector');
ok(PATTERN.test(EMPTY_CID), 'the schema pattern accepts a known-good §CID-1 profile CID');

// ---- (c) POSITIVE VECTOR over the CURRENT catalog (recomputed every run, never pinned:
// the value MOVES whenever the catalog moves, which is the point of §PIN-1). ----
const catalogBytes = readFileSync(CATALOG_PATH);
const catalogSha = createHash('sha256').update(catalogBytes).digest('hex');
const catalogCid = toCid(catalogSha);
console.log(`\ncurrent catalog: ${CATALOG_PATH}\n  bytes=${catalogBytes.length}  sha256=${catalogSha}\n  catalog_cid=${catalogCid}\n`);
ok(PATTERN.test(catalogCid), 'the current catalog CID matches the schema-declared text form');
ok(fromCid(catalogCid) === 'sha256:' + catalogSha,
  'the current catalog CID round-trips back to the same sha256 digest (§CID-1.2 bijection)');

// ---- (d) TAMPER VECTOR: one flipped byte MUST move the CID. ----
{
  const mutated = Buffer.from(catalogBytes);
  const at = Math.floor(mutated.length / 2);
  mutated[at] = mutated[at] ^ 0x01;
  const mutatedCid = toCid(createHash('sha256').update(mutated).digest('hex'));
  ok(mutatedCid !== catalogCid, `one flipped catalog byte (offset ${at}) changes the CID — the pin is not decorative`);
  ok(PATTERN.test(mutatedCid), 'the tampered-catalog CID is still well-formed (the pin detects drift by VALUE, not by shape)');
}

// ---- (a) EVERY catalog_cid present in the live catalog decodes. Zero present is REPORTED. ----
{
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const chains = Array.isArray(catalog.chains) ? catalog.chains : [];
  const pinned = chains.filter((c) => c && typeof c.catalog_cid === 'string');
  console.log(`catalog inventory: ${chains.length} chain(s), ${pinned.length} carrying catalog_cid`);
  ok(chains.length > 0, 'the catalog carries chains to inspect (an empty chains[] is not a pass)');
  for (const c of pinned) {
    let decoded = null;
    try { decoded = fromCid(c.catalog_cid); } catch (e) { decoded = 'THREW: ' + e.message; }
    ok(typeof decoded === 'string' && decoded.startsWith('sha256:'),
      `chain "${c.name}" catalog_cid decodes via fromCid() (${decoded})`);
    ok(PATTERN.test(c.catalog_cid), `chain "${c.name}" catalog_cid matches the schema text form`);
  }
  if (pinned.length === 0) {
    console.log('  · ZERO chains carry catalog_cid today — the per-chain decode loop asserted NOTHING.');
    console.log('    That is the expected state at §PIN-1 landing (the member is OPTIONAL and no backfill is owed),');
    console.log('    and it is why the vectors above and below run unconditionally: this gate never reports');
    console.log('    "all pins valid" on the strength of an empty set.');
  }
}

// ---- (b) REJECTION, axis 1: fromCid() refuses anything outside the §CID-1 DASL profile. ----
function b32(bytes) {
  const A = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += A[(value >>> (bits - 5)) & 0x1f]; bits -= 5; }
  }
  if (bits > 0) out += A[(value << (5 - bits)) & 0x1f];
  return out;
}
const digestBytes = Buffer.from(catalogSha, 'hex');
const FOREIGN = [
  { header: [0x01, 0x71, 0x12, 0x20], why: 'dag-cbor (0x71) codec', expect: /codec/ },
  { header: [0x00, 0x55, 0x12, 0x20], why: 'non-CIDv1 version byte', expect: /version/ },
  { header: [0x01, 0x55, 0x11, 0x20], why: 'sha1 (0x11) multihash function', expect: /multihash/ },
];
for (const f of FOREIGN) {
  const cid = 'b' + b32(Buffer.concat([Buffer.from(f.header), digestBytes]));
  let threw = false;
  try { fromCid(cid); } catch (e) { threw = f.expect.test(e.message); }
  ok(threw, `fromCid() rejects a catalog_cid built with a ${f.why}`);
}
{
  const shortCid = 'b' + b32(Buffer.concat([Buffer.from([0x01, 0x55, 0x12, 0x10]), digestBytes.subarray(0, 16)]));
  let threw = false;
  try { fromCid(shortCid); } catch (e) { threw = /digest size/.test(e.message); }
  ok(threw, 'fromCid() rejects a catalog_cid declaring a digest size other than 32 bytes');
}
{
  let threw = false;
  try { fromCid(catalogCid.toUpperCase()); } catch (e) { threw = /base32|expected a base32-lower/.test(e.message); }
  ok(threw, 'fromCid() rejects a base32-UPPER spelling (§CID-1.1 is base32-lower, unpadded)');
}

// ---- (b) REJECTION, axis 2: the PUBLISHED SCHEMA refuses the same malformed values. ----
// Measured by running the real schema-validate.mjs gate over two synthetic catalogs that differ in
// exactly one thing: the catalog_cid value. The verdict is read per-field (an error line naming
// catalog_cid), so an unrelated red elsewhere in the gate cannot be mistaken for this axis passing.
function catalogDoc(cid) {
  const chain = { name: 'pin-1-vector-chain', title: 'PIN-1 vector', steps: [{ tool_id: 'art-01-a2a-fee-route-optimizer' }] };
  if (cid !== undefined) chain.catalog_cid = cid;
  return { spec_version: '0.8.13', nodes: [], chains: [chain] };
}
function runValidator(doc) {
  const dir = mkdtempSync(join(tmpdir(), 'pin1-'));
  const file = join(dir, 'chaingraph.json');
  writeFileSync(file, JSON.stringify(doc, null, 2));
  try {
    const out = execFileSync(process.execPath, [VALIDATOR], {
      env: { ...process.env, CHAINGRAPH: file, SCHEMA: SCHEMA_PATH },
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, text: out };
  } catch (e) {
    return { code: e.status ?? 1, text: (e.stdout || '') + (e.stderr || '') };
  }
}
const MALFORMED = [
  ['bafkreiNOTBASE32UPPER', 'a base32-UPPER value'],
  ['bafybeigmhgpatdhibm63jy6ekiff57fcif7enik2gfclu23znq6j7j4u4u', 'a non-raw (bafybei…, dag-pb/dag-cbor) profile'],
  ['bafkrei', 'a truncated value'],
  ['sha256:' + catalogSha, 'a bare sha256: digest instead of a CID'],
];
{
  const good = runValidator(catalogDoc(catalogCid));
  ok(!/catalog_cid/.test(good.text), `schema-validate.mjs raises no catalog_cid error for a well-formed pin (exit ${good.code})`);
  ok(good.code === 0, `schema-validate.mjs accepts a catalog carrying a well-formed catalog_cid (exit ${good.code})`);

  const absent = runValidator(catalogDoc(undefined));
  ok(absent.code === 0, `schema-validate.mjs accepts a chain with NO catalog_cid — absence is conformant (exit ${absent.code})`);

  for (const [bad, why] of MALFORMED) {
    const r = runValidator(catalogDoc(bad));
    ok(r.code !== 0 && /catalog_cid/.test(r.text),
      `schema-validate.mjs REJECTS ${why} as catalog_cid (exit ${r.code})`);
  }
}

console.log(fail ? `\n${fail} failure(s).` : '\nAll §PIN-1 catalog-snapshot checks passed.');
process.exit(fail ? 1 : 0);
