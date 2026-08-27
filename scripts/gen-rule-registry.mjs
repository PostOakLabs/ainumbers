#!/usr/bin/env node
/**
 * gen-rule-registry.mjs — the SOLE generator of chaingraph/kernels/data/rule-registry.json.
 *
 * ACCT-RULEREG-K-1, anchored on ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec.2.2 (the single-writer
 * ruling) + STANDING-ORDERS.md #34 (independent derivation) + #35 (shared derived artifacts have
 * one writer: the land row).
 *
 * ── THE TWO LAYERS, and why they are two ────────────────────────────────────────────────────────
 *   (a) ENTRY FILES  chaingraph/kernels/data/rule-registry/<standard_id>.entry.json
 *       Source of truth. One file per standard, DISJOINT BY CONSTRUCTION, written by the wave row
 *       that needs that standard — exactly like a kernel shard.
 *   (b) ASSEMBLED TABLE  chaingraph/kernels/data/rule-registry.json
 *       Derived. A named SO #35 single-writer artifact: ASSEMBLE-LAND regenerates it, once, for
 *       the whole batch. A shard row NEVER hand-writes it.
 *
 * A single-writer TABLE fed directly by many waves would serialize every accounting wave behind
 * one file and reproduce precisely the merge-ref-destruction hazard SO #35 exists to stop: each
 * regen pushes its still-open siblings into conflict, silently removing their CI. Disjoint entry
 * files keep the waves parallel AND keep the derived artifact single-writer.
 *
 * ── SO #34: THIS GENERATOR RECOMPUTES. IT NEVER AGREES WITH ITSELF ──────────────────────────────
 * Every source_digest in an entry file is validated two independent ways, and NEITHER of them is
 * "read the claimed value and accept it":
 *   1. BYTE RECOMPUTATION (primary). The digest is recomputed with node:crypto from the bytes of
 *      the pinned snapshot named by `snapshot_location`, and compared. A mismatch is a REJECTION.
 *      The recomputation input is the file path, never the claimed digest.
 *   2. REGISTRY RESOLUTION (always). The digest must resolve to a real entry in
 *      chaingraph/standard/clause-snapshot-registry.json, whose sole writer is
 *      chaingraph/standard/pin-clause-snapshot.mjs — a different tool, hashing the real bytes,
 *      and refusing whole-document-sized excerpts (SPEC.md Sec.30.2).
 * An entry carrying no digest at all is REJECTED, never warned about (build spec Sec.2.2).
 *
 * The MUTATION CONTROL for leg 1 ships in scripts/gen-rule-registry.test.mjs: it flips one byte in
 * a snapshot and asserts the generator REJECTS that entry. If that control ever PASSES, the gate
 * IS the vulnerability, and the test says so in those words.
 *
 * Snapshots live at WORKSPACE-ROOT research/clause-snapshots/ — never inside this repo (SO #3b:
 * the excerpts are primary text, and an internal artifact in a public repo is only fully
 * remediable by a history-rewriting force push). This script locates that directory by walking up
 * from the repo root, so it works from the main checkout and from any worktree. When the directory
 * is genuinely unreachable — a CI checkout of this repo alone — leg 1 cannot run; that is reported
 * as the DISTINCT state `SNAPSHOT-UNREACHABLE`, printed loudly per source, and NEVER as a pass
 * (SO #34c: absence is not a green). Leg 2 still binds in that environment.
 *
 * Usage:
 *   node scripts/gen-rule-registry.mjs            # regenerate the table (ASSEMBLE-LAND only)
 *   node scripts/gen-rule-registry.mjs --check    # gate: verify the table matches its sources
 *   node scripts/gen-rule-registry.mjs --check --json
 *   [--snapshot-root <dir>]  [--base-ref <ref>]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY_DIR = resolve(REPO, 'chaingraph', 'kernels', 'data', 'rule-registry');
const TABLE_PATH = resolve(REPO, 'chaingraph', 'kernels', 'data', 'rule-registry.json');
const CLAUSE_REGISTRY_PATH = resolve(REPO, 'chaingraph', 'standard', 'clause-snapshot-registry.json');
const ENTRY_DIR_REL = 'chaingraph/kernels/data/rule-registry';
const TABLE_REL = 'chaingraph/kernels/data/rule-registry.json';

/** Kept in lockstep with _ruleversion.bundle.mjs's declared bound (build spec Sec.2.3). */
export const MAX_SLICE_ENTRIES = 32;
export const SCHEMA_VERSION = '1.0.0';

const FILER_STATUSES = [
  'large_accelerated', 'accelerated', 'non_accelerated', 'smaller_reporting',
  'emerging_growth', 'private', 'non_public_business_entity',
];
const ISO_DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

// ── canonicalization: recursive key sort, same JCS shape the kernels use ────────────────────────
export function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    const out = {};
    Object.keys(v).sort().forEach((k) => { out[k] = canon(v[k]); });
    return out;
  }
  return v;
}

export function sha256HexOf(buf) {
  return 'sha256:' + createHash('sha256').update(buf).digest('hex');
}

/** Walk up from `start` looking for research/clause-snapshots. Returns a path or null. */
export function findSnapshotRoot(start = REPO) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, 'research', 'clause-snapshots');
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function loadClauseRegistryDigests(path = CLAUSE_REGISTRY_PATH) {
  if (!existsSync(path)) return new Set();
  const arr = JSON.parse(readFileSync(path, 'utf8'));
  return new Set(arr.map((r) => r.digest));
}

// ── structural validation of one entry file ─────────────────────────────────────────────────────
// Every rejection is NAMED. Nothing is coerced, defaulted, or warned about.
export function validateEntryFile(file, doc) {
  const errs = [];
  const fail = (m) => errs.push(`${file}: ${m}`);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) { fail('is not a JSON object'); return errs; }
  if (doc.schema_version !== SCHEMA_VERSION) fail(`schema_version must be "${SCHEMA_VERSION}", got ${JSON.stringify(doc.schema_version)}`);
  if (typeof doc.standard_id !== 'string' || !doc.standard_id) { fail('missing a non-empty standard_id'); return errs; }
  if (basename(file) !== `${doc.standard_id}.entry.json`) {
    fail(`filename must be "${doc.standard_id}.entry.json" — the filename IS the disjointness key, so a mismatch could let two waves collide`);
  }
  if (typeof doc.written_by !== 'string' || !doc.written_by) fail('missing written_by (the row that owns this standard)');
  if (!Array.isArray(doc.entries) || doc.entries.length === 0) { fail('entries must be a non-empty array'); return errs; }

  const seen = new Map();
  doc.entries.forEach((e, i) => {
    const at = `entries[${i}]`;
    if (!e || typeof e !== 'object' || Array.isArray(e)) { fail(`${at} is not an object`); return; }
    if (e.standard_id !== doc.standard_id) fail(`${at}.standard_id "${String(e.standard_id)}" does not match the file's standard_id "${doc.standard_id}"`);
    if (!Array.isArray(e.applies_to_filer_statuses) || e.applies_to_filer_statuses.length === 0) {
      fail(`${at}.applies_to_filer_statuses must be a non-empty array`);
    } else {
      e.applies_to_filer_statuses.forEach((fs) => {
        if (!FILER_STATUSES.includes(fs)) fail(`${at} declares filer_status "${String(fs)}", outside the closed enum`);
        const key = `${e.standard_id}|${fs}`;
        if (seen.has(key)) fail(`(standard_id="${e.standard_id}", filer_status="${fs}") is declared by both ${seen.get(key)} and ${at} — a triple must resolve to EXACTLY ONE entry`);
        else seen.set(key, at);
      });
    }
    if (!ISO_DATE_RE.test(String(e.effective_for_annual_periods_beginning))) fail(`${at}.effective_for_annual_periods_beginning must be an ISO date`);
    if (e.effective_for_interim_periods_beginning !== null && !ISO_DATE_RE.test(String(e.effective_for_interim_periods_beginning))) {
      fail(`${at}.effective_for_interim_periods_beginning must be null or an ISO date`);
    }
    if (typeof e.early_adoption_permitted !== 'boolean') fail(`${at}.early_adoption_permitted must be a boolean`);
    if (typeof e.transition_method !== 'string' || !e.transition_method) fail(`${at}.transition_method must be a non-empty string`);
    if (!isCitation(e.citation)) fail(`${at}.citation must carry {clause, source, source_digest, snapshot_location} — an entry with no digest is REJECTED, not warned about`);

    const ps = e.parameter_set;
    if (!ps || typeof ps !== 'object' || Array.isArray(ps)) { fail(`${at}.parameter_set must be an object`); return; }
    Object.keys(ps).forEach((name) => {
      const versions = ps[name];
      if (!Array.isArray(versions) || versions.length === 0) {
        fail(`${at}.parameter_set["${name}"] must be a non-empty array of versions — a parameter is ALWAYS (value, effective_from, effective_to, source, source_digest), never a bare number`);
        return;
      }
      versions.forEach((v, vi) => {
        const vat = `${at}.parameter_set["${name}"][${vi}]`;
        if (!v || typeof v !== 'object') { fail(`${vat} is not an object`); return; }
        if (!Object.prototype.hasOwnProperty.call(v, 'value')) fail(`${vat} missing \`value\``);
        if (!ISO_DATE_RE.test(String(v.effective_from))) fail(`${vat}.effective_from must be an ISO date`);
        if (v.effective_to !== null && !ISO_DATE_RE.test(String(v.effective_to))) fail(`${vat}.effective_to must be null or an ISO date`);
        if (v.effective_to !== null && String(v.effective_from) >= String(v.effective_to)) fail(`${vat}.effective_from must be strictly before effective_to`);
        if (typeof v.source !== 'string' || !v.source) fail(`${vat}.source must be a non-empty string`);
        if (typeof v.source_digest !== 'string' || !v.source_digest) fail(`${vat}.source_digest is missing — REJECTED, not warned about`);
        if (typeof v.snapshot_location !== 'string' || !v.snapshot_location) fail(`${vat}.snapshot_location is missing — a digest with no locator cannot be independently recomputed`);
      });
      // NON-OVERLAP over half-open [effective_from, effective_to). Asserted here host-side as well
      // as in-guest: it is the property that makes the table trustworthy (build spec Sec.2.4).
      for (let a = 0; a < versions.length; a++) {
        for (let b = a + 1; b < versions.length; b++) {
          const A = versions[a], B = versions[b];
          if (!A || !B) continue;
          const aEnd = A.effective_to === null ? '9999-12-31' : String(A.effective_to);
          const bEnd = B.effective_to === null ? '9999-12-31' : String(B.effective_to);
          if (String(A.effective_from) < bEnd && String(B.effective_from) < aEnd) {
            fail(`${at}.parameter_set["${name}"]: versions[${a}] and versions[${b}] have OVERLAPPING [effective_from, effective_to) windows`);
          }
        }
      }
    });
  });
  return errs;
}

function isCitation(c) {
  return !!c && typeof c === 'object' && !Array.isArray(c) &&
    typeof c.clause === 'string' && c.clause.length > 0 &&
    typeof c.source === 'string' && c.source.length > 0 &&
    typeof c.source_digest === 'string' && c.source_digest.length > 0 &&
    typeof c.snapshot_location === 'string' && c.snapshot_location.length > 0;
}

/** Every (snapshot_location, source_digest) pair an entry file asserts, citations and parameters. */
export function collectSourceClaims(doc) {
  const claims = [];
  const push = (where, c) => {
    if (c && typeof c.source_digest === 'string' && typeof c.snapshot_location === 'string') {
      claims.push({ where, snapshot_location: c.snapshot_location, claimed_digest: c.source_digest });
    }
  };
  (doc.entries || []).forEach((e, i) => {
    push(`entries[${i}].citation`, e.citation);
    const ps = e.parameter_set || {};
    Object.keys(ps).forEach((name) => {
      (Array.isArray(ps[name]) ? ps[name] : []).forEach((v, vi) => push(`entries[${i}].parameter_set["${name}"][${vi}]`, v));
    });
  });
  return claims;
}

/**
 * INDEPENDENT DERIVATION (SO #34). `readSnapshot(snapshot_location)` returns a Buffer or null;
 * null means the bytes are unreachable in this environment.
 *
 * The claimed digest is used for ONE thing only: as the value the recomputed digest is compared
 * AGAINST. It is never the input to the computation, and it is never written into the output as
 * the verified digest — the RECOMPUTED value is.
 */
export function verifySourceClaims(claims, { readSnapshot, registryDigests }) {
  const errors = [];
  const verifications = [];
  const byLocation = new Map();
  for (const c of claims) {
    if (!registryDigests.has(c.claimed_digest)) {
      errors.push(`${c.where}: source_digest ${c.claimed_digest} does not resolve to any entry in ${basename(CLAUSE_REGISTRY_PATH)} — a digest satisfied by an arbitrary string is not a citation (SPEC.md Sec.30.5c)`);
      continue;
    }
    let bytes = null;
    try { bytes = readSnapshot(c.snapshot_location); } catch { bytes = null; }
    if (bytes === null) {
      verifications.push({ snapshot_location: c.snapshot_location, digest: c.claimed_digest, mode: 'SNAPSHOT-UNREACHABLE', excerpt_bytes: null });
      byLocation.set(c.snapshot_location, 'SNAPSHOT-UNREACHABLE');
      continue;
    }
    const recomputed = sha256HexOf(bytes);
    if (recomputed !== c.claimed_digest) {
      errors.push(
        `${c.where}: DIGEST MISMATCH for ${c.snapshot_location} — recomputed ${recomputed} from the pinned snapshot bytes, entry claims ${c.claimed_digest}. `
        + 'The entry is REJECTED. The snapshot changed, or the claim was never true.'
      );
      continue;
    }
    verifications.push({ snapshot_location: c.snapshot_location, digest: recomputed, mode: 'RECOMPUTED-FROM-BYTES', excerpt_bytes: bytes.length });
    byLocation.set(c.snapshot_location, 'RECOMPUTED-FROM-BYTES');
  }
  // De-duplicate, deterministic order.
  const seen = new Set();
  const unique = [];
  verifications
    .slice()
    .sort((a, b) => (a.snapshot_location + a.digest).localeCompare(b.snapshot_location + b.digest))
    .forEach((v) => { const k = v.snapshot_location + '|' + v.digest; if (!seen.has(k)) { seen.add(k); unique.push(v); } });
  return { errors, verifications: unique };
}

/** Deterministic assembly. No timestamps, no environment, no ordering luck. */
export function assembleTable(docs, verifications) {
  const entries = [];
  docs.slice().sort((a, b) => a.standard_id.localeCompare(b.standard_id)).forEach((doc) => {
    doc.entries.forEach((e) => entries.push(canon(e)));
  });
  entries.sort((a, b) => {
    const k = a.standard_id.localeCompare(b.standard_id);
    return k !== 0 ? k : a.applies_to_filer_statuses.join(',').localeCompare(b.applies_to_filer_statuses.join(','));
  });
  const standards = Array.from(new Set(entries.map((e) => e.standard_id))).sort();
  const body = { entries, standards, schema_version: SCHEMA_VERSION };
  const table_digest = sha256HexOf(Buffer.from(JSON.stringify(canon(body)), 'utf8'));
  return {
    _generated_by: 'scripts/gen-rule-registry.mjs',
    _note:
      'DERIVED ARTIFACT — do not hand-edit. Sole writer: scripts/gen-rule-registry.mjs, run by ASSEMBLE-LAND '
      + '(STANDING-ORDERS.md #35). Sources are the disjoint per-standard entry files under '
      + ENTRY_DIR_REL + '/, one per standard, each written by the wave row that needs that standard. '
      + 'Every source_digest here was RECOMPUTED from the pinned snapshot bytes, never read from the entry file '
      + 'and agreed with (STANDING-ORDERS.md #34).',
    schema_version: SCHEMA_VERSION,
    max_slice_entries: MAX_SLICE_ENTRIES,
    table_digest,
    standards,
    entries,
    source_verification: verifications,
  };
}

/** A per-standard slice must fit the in-guest bound, or the host has produced an unusable table. */
export function checkSliceConstructibility(table) {
  const errs = [];
  const counts = new Map();
  table.entries.forEach((e) => counts.set(e.standard_id, (counts.get(e.standard_id) || 0) + 1));
  for (const [sid, n] of counts) {
    if (n > MAX_SLICE_ENTRIES) {
      errs.push(`standard_id "${sid}" expands to ${n} entries, above max_slice_entries=${MAX_SLICE_ENTRIES} — a per-standard slice would not be constructible for the guest`);
    }
  }
  return errs;
}

function listEntryFiles(dir = ENTRY_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.entry.json')).sort().map((f) => join(dir, f));
}

/** Branch-awareness, same technique as check-shard-assembly.mjs: is `path` present on the base ref? */
function presentOnBaseRef(pathRel, baseRef) {
  try {
    execSync(`git cat-file -e ${baseRef}:${pathRel}`, { cwd: REPO, env: gitEnv(), stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function resolveBaseRef(explicit) {
  if (explicit) return explicit;
  for (const ref of ['origin/main', 'main']) {
    try { execSync(`git rev-parse --verify ${ref}`, { cwd: REPO, env: gitEnv(), stdio: 'ignore' }); return ref; } catch { /* next */ }
  }
  return null;
}

function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const asJson = argv.includes('--json');
  const snapArgIdx = argv.indexOf('--snapshot-root');
  const baseArgIdx = argv.indexOf('--base-ref');
  const snapshotRoot = snapArgIdx !== -1 ? resolve(argv[snapArgIdx + 1]) : findSnapshotRoot();
  const baseRef = resolveBaseRef(baseArgIdx !== -1 ? argv[baseArgIdx + 1] : null);

  const files = listEntryFiles();
  if (files.length === 0) {
    console.log(`gen-rule-registry: no entry files under ${ENTRY_DIR_REL}/ — nothing to assemble.`);
    process.exit(0);
  }

  const docs = [];
  const errors = [];
  for (const f of files) {
    let doc;
    try { doc = JSON.parse(readFileSync(f, 'utf8')); }
    catch (e) { errors.push(`${basename(f)}: not parseable JSON — ${e.message}`); continue; }
    const structural = validateEntryFile(f, doc);
    if (structural.length) { errors.push(...structural.map((m) => m.replace(f, basename(f)))); continue; }
    docs.push(doc);
  }

  const registryDigests = loadClauseRegistryDigests();
  const readSnapshot = (loc) => {
    if (!snapshotRoot) return null;
    const p = resolve(snapshotRoot, basename(loc));
    if (!existsSync(p) || !statSync(p).isFile()) return null;
    return readFileSync(p);
  };
  const claims = docs.flatMap((d) => collectSourceClaims(d));
  const { errors: digestErrors, verifications } = verifySourceClaims(claims, { readSnapshot, registryDigests });
  errors.push(...digestErrors);

  const table = assembleTable(docs, verifications);
  errors.push(...checkSliceConstructibility(table));

  const unreachable = verifications.filter((v) => v.mode === 'SNAPSHOT-UNREACHABLE');
  if (unreachable.length) {
    console.log(
      `gen-rule-registry: SNAPSHOT-UNREACHABLE for ${unreachable.length} source(s) — `
      + `workspace-root research/clause-snapshots/ was ${snapshotRoot ? 'found but is missing these files' : 'not found from ' + REPO}. `
      + 'Byte recomputation could NOT run for them; only clause-snapshot-registry resolution did. '
      + 'This is a DISTINCT state, never a pass (STANDING-ORDERS.md #34c).'
    );
    unreachable.forEach((v) => console.log(`  - ${v.snapshot_location}`));
  }

  if (errors.length) {
    console.error(`gen-rule-registry: FAIL — ${errors.length} problem(s):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  const serialized = JSON.stringify(table, null, 2) + '\n';

  if (!check) {
    mkdirSync(dirname(TABLE_PATH), { recursive: true });
    writeFileSync(TABLE_PATH, serialized);
    console.log(`gen-rule-registry: wrote ${TABLE_REL} — ${table.entries.length} entr(y|ies) across ${table.standards.length} standard(s), table_digest ${table.table_digest}`);
    process.exit(0);
  }

  // ── --check ───────────────────────────────────────────────────────────────────────────────────
  if (!existsSync(TABLE_PATH)) {
    // Branch-aware, exactly the SHARD-GATE-PRE-ASSEMBLE-1 shape: an entry file that is NEW on this
    // branch is a MID-FLIGHT shard awaiting ASSEMBLE-LAND, not a registration leak. A shard row is
    // forbidden to write the table (SO #35), so a red here would be a gate demanding a forbidden act.
    const newOnBranch = baseRef
      ? files.filter((f) => !presentOnBaseRef(`${ENTRY_DIR_REL}/${basename(f)}`, baseRef)).map((f) => basename(f))
      : null;
    if (newOnBranch === null) {
      console.error(
        'gen-rule-registry: FAIL — BASE REF UNRESOLVED (tried origin/main, main) and '
        + `${TABLE_REL} is absent. Nothing is exempted when the base ref cannot be resolved (SO #34c).`
      );
      process.exit(1);
    }
    if (newOnBranch.length === 0) {
      console.error(
        `gen-rule-registry: FAIL — ${TABLE_REL} is absent, and every entry file is already present on ${baseRef}. `
        + 'That is a registration leak, not a mid-flight shard: run this script without --check (ASSEMBLE-LAND only) and commit the table.'
      );
      process.exit(1);
    }
    console.log(
      `gen-rule-registry: PENDING-ASSEMBLE — ${newOnBranch.length} entry file(s) present on this branch but ABSENT from ${baseRef}, `
      + `and ${TABLE_REL} has not been assembled yet. These are mid-flight registry shards awaiting ASSEMBLE-LAND, not a defect:`
    );
    newOnBranch.forEach((f) => console.log(`  - ${ENTRY_DIR_REL}/${f}  [new on this branch]`));
    console.log('  Entry-file structure and every source digest were still fully verified above; only the assembled table is pending.');
    process.exit(0);
  }

  // Staleness is judged on table_digest (a canonical hash of entries+standards+schema_version),
  // never on raw byte equality of the full file. source_verification's `mode` field
  // (RECOMPUTED-FROM-BYTES vs SNAPSHOT-UNREACHABLE) reflects whether THIS process could reach
  // workspace-root research/clause-snapshots/ -- which exists in a claimant's local workspace but
  // never in the CI checkout (SO #3b: research/ is deliberately outside repo/, never vendored in).
  // A byte-equality check would make the committed table permanently unreproducible: it can never
  // match both a local regen (snapshots reachable) and CI's regen (snapshots absent) at once.
  // table_digest excludes source_verification by construction (assembleTable() hashes only
  // {entries, standards, schema_version}), so it is the host-independent freshness signal; the
  // underlying digest verification against snapshot bytes already ran above (errors.length check)
  // whenever this process could reach them, so weakening the byte-compare here does not weaken that.
  const onDisk = readFileSync(TABLE_PATH, 'utf8');
  const diskParsed = (() => { try { return JSON.parse(onDisk); } catch { return null; } })();
  if (!diskParsed || diskParsed.table_digest !== table.table_digest) {
    console.error(`gen-rule-registry: FAIL — ${TABLE_REL} is STALE relative to ${ENTRY_DIR_REL}/.`);
    console.error(`  on-disk table_digest:   ${diskParsed ? diskParsed.table_digest : '(unparseable)'}`);
    console.error(`  regenerated table_digest: ${table.table_digest}`);
    console.error('  Fix: ASSEMBLE-LAND runs `node scripts/gen-rule-registry.mjs` and commits the result. A shard row must NOT (SO #35).');
    process.exit(1);
  }

  const recomputedCount = verifications.filter((v) => v.mode === 'RECOMPUTED-FROM-BYTES').length;
  const out = {
    ok: true, standards: table.standards.length, entries: table.entries.length,
    table_digest: table.table_digest,
    sources_recomputed_from_bytes: recomputedCount,
    sources_snapshot_unreachable: unreachable.length,
  };
  if (asJson) console.log(JSON.stringify(out, null, 2));
  else {
    console.log(
      `gen-rule-registry: OK — ${TABLE_REL} matches ${ENTRY_DIR_REL}/ (${table.entries.length} entries, ${table.standards.length} standards, `
      + `${recomputedCount} source digest(s) recomputed from snapshot bytes, ${unreachable.length} unreachable).`
    );
  }
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('gen-rule-registry.mjs')) {
  main();
}
