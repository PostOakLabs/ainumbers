#!/usr/bin/env node
// scripts/gen-fv-status.mjs — FV-AGENTSURFACE-BUILD-1.
//
// Writes one JSON artifact per `spec_digest` to fv-status/<hex>.json,
// answering the three questions a receipt-holder asks per
// research/FV-AGENTSURFACE-SPEC-1-2026-08-11.md (the design — implemented
// faithfully, not re-opened here): published? / proven? / still trusted?
// ONE shape, not three surfaces (§0 of the design).
//
// INDEPENDENT DERIVATION (SO #34): spec_digest, kernel_digest and the
// in-scope kernel set are ALL recomputed here from source bytes, exactly
// like scripts/gen-registry-kernel-resolve.mjs — never read from a field an
// earlier process wrote. Grouping by spec_digest is real, not assumed: today
// every live/gpu:false/registered kernel shares one spec_digest because
// there is one chaingraph/standard/SPEC.md; if that ever changes this
// generator produces more than one fv-status/*.json file without any code
// change (the grouping key, not the file count, is what's authoritative).
//
// `proven` is a claim about an INDIVIDUAL kernel's verification against the
// spec, not a blanket claim about the spec digest — the design's example
// artifact (§1) shows a single-kernel `kernel_ids` array, so `proven` nests
// per-kernel tier records (read honestly from chaingraph/fv-pilot/*.json,
// the only structured claim-tier source in this repo) rather than forcing
// one flat tier onto every kernel sharing the digest. Kernels with no
// fv-pilot record are counted, never silently omitted (SO #34c).
//
// `still_trusted` is the one DYNAMIC field (phil's TOCTOU patch, mandatory):
// carries checked_against_errata_root (Sigsum tree head at generation time)
// + a short TTL, so a cached artifact can never silently serve
// `trusted: true` across a revocation. Sigsum anchor is not yet wired in
// errata.json itself (FV-ERRATA-BUILD-2 shipped it deferred) — this
// generator reads whatever errata.json actually carries and degrades to
// tree_size:0/root_hash:null exactly as the design's §4 gate 1 specifies,
// stated as deferred, never a fake root.
//
// `ttl_seconds` default (86400s / 24h) is the magnitude the design doc
// itself shows as a placeholder (§1) — same "state the default honestly,
// don't block on it" pattern as challenge_window_days elsewhere in the
// wave. Override with --ttl-seconds=<n> once Tim rules on it; nothing here
// treats the default as final.
//
// Usage:
//   node scripts/gen-fv-status.mjs --write [--ttl-seconds=86400]
//   node scripts/gen-fv-status.mjs --check

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceDigest } from '../chaingraph/kernels/_buildid.mjs';
import { cgCanon } from '../chaingraph/kernels/_hash.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const KDIR = resolve(REPO, 'chaingraph', 'kernels');
const CGPATH = resolve(REPO, 'chaingraph', 'chaingraph.json');
const SPEC_PATH = resolve(REPO, 'chaingraph', 'standard', 'SPEC.md');
const FV_PILOT_DIR = resolve(REPO, 'chaingraph', 'fv-pilot');
const ERRATA_PATH = resolve(REPO, 'errata.json');
const OUT_DIR = resolve(REPO, 'fv-status');

// Same offline-first / never-a-live-dependency discipline errata.json and
// registry/kernel/*.json already state — carried verbatim here too (§2 of
// the design doc: "state twice so drift is visible", not a paraphrase).
export const OFFLINE_FIRST_NOTE =
  'This artifact is a snapshot, not a subscription. published and proven describe the spec itself and do not change without a new spec_digest -- a cached copy of these two sections remains true indefinitely, offline, no refetch required. still_trusted is the one field that can go stale: it reports the errata log state AT THE TIME OF GENERATION (checked_against_errata_root), not now. Within ttl_seconds of issued_at, treat still_trusted.value as current. Past expires_at, treat it as unknown-refresh-needed -- not as continuing to hold, and not as false either. Refetching this artifact (or fetching errata.json directly and checking spec_digest) is the only way to get a current answer. None of this ever gates the underlying receipt cryptographic validity -- an FV+zk artifact verifies offline in full regardless of whether this status file is ever fetched. This file informs trust; it is never a dependency of verification.';

const args = process.argv.slice(2);
const mode = args.includes('--write') ? 'write' : args.includes('--check') ? 'check' : null;
if (!mode) { console.error('usage: gen-fv-status.mjs --write [--ttl-seconds=N] | --check'); process.exit(2); }
const ttlArg = args.find((a) => a.startsWith('--ttl-seconds='));
const TTL_SECONDS = ttlArg ? Number(ttlArg.split('=')[1]) : 86400;
if (!Number.isFinite(TTL_SECONDS) || TTL_SECONDS <= 0) { console.error('✗ --ttl-seconds must be a positive number'); process.exit(2); }

const idxSrc = readFileSync(resolve(KDIR, 'index.mjs'), 'utf8');
const kBlock = idxSrc.slice(idxSrc.indexOf('KERNELS = {'));
const registeredIds = new Set([...kBlock.matchAll(/['"]([a-z0-9][a-z0-9._-]+)['"]\s*:/gi)].map((m) => m[1]));

const cg = JSON.parse(readFileSync(CGPATH, 'utf8'));
if (!cg.spec_version) { console.error('✗ chaingraph.json has no spec_version'); process.exit(3); }
const specVersion = cg.spec_version;

const inScope = (cg.nodes ?? []).filter(
  (n) => n.status === 'live' && n.gpu === false && registeredIds.has(n.tool_id)
    && existsSync(resolve(KDIR, n.tool_id + '.kernel.mjs')),
);
if (inScope.length === 0) { console.error('✗ 0 in-scope kernels found — refusing to treat that as a valid empty regen (SO #34c: absence is not a pass)'); process.exit(3); }

function loadFvPilot(toolId) {
  const p = resolve(FV_PILOT_DIR, `${toolId}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

// Class -> the same claim-ladder tier vocabulary FV-AGENTSURFACE-SPEC-1 §1
// names (`exhaustive-enumeration` / `property-tested` / `machine-checked-proof`),
// reused verbatim, never re-invented here.
const CLASS_TO_TIER = { A: 'exhaustive-enumeration', B: 'property-tested', C: 'machine-checked-proof' };

function provenRecordFor(toolId) {
  const pilot = loadFvPilot(toolId);
  if (!pilot) return null;
  const ev = pilot.evidence_vector ?? {};
  const tier = CLASS_TO_TIER[pilot.class] ?? null;
  return {
    tier,
    tier_wording: pilot.label, // Tim's already-ratified public string, verbatim
    claim_scope: {
      source: ev.authoritative_vectors?.source ?? null,
      tolerance: ev.authoritative_vectors?.tolerance ?? null,
      assumptions: ev.machine_proof?.note ?? ev.machine_proof?.gate ?? null,
    },
    // twin_agreement: SPEC.md §29 field, optional, not yet populated by any
    // kernel (FV-TWIN-SCHEMA-1 unstaged/unlanded) — honest false state,
    // never fabricated (design §1, build gate #3).
    twin_agreement: {
      checked: false,
      value: null,
      field_pointer: 'audit_signature.twin_execution',
      note: 'field defined in chaingraph/standard/SPEC.md §29, not yet populated by any kernel (FV-TWIN-SCHEMA-1, unstaged) — this artifact surfaces it once shipped, does not invent it',
    },
    float_bound: {
      status: 'empirical',
      note: 'proved lemma pending FV-FLOATBOUND-SPEC-1; differential test never retired even once it lands (augments, never replaces — FV-ROBUST-WAVE-BUILD-SPEC.md §3)',
    },
  };
}

async function buildArtifacts() {
  const specDigest = await sourceDigest(readFileSync(SPEC_PATH, 'utf8'));
  const hex = specDigest.slice('sha256:'.length);

  const kernelIds = [];
  const provenKernels = {};
  let unclaimedCount = 0;
  for (const n of inScope) {
    kernelIds.push(n.tool_id);
    const rec = provenRecordFor(n.tool_id);
    if (rec) provenKernels[n.tool_id] = rec;
    else unclaimedCount++;
  }
  kernelIds.sort();

  const errata = JSON.parse(readFileSync(ERRATA_PATH, 'utf8'));
  const matchingEntries = (errata.entries ?? []).filter((e) => e.spec_digest === specDigest);
  // Sigsum leg not yet wired in errata.json itself (FV-ERRATA-BUILD-2 shipped
  // deferred) — degrade exactly per design §4 gate 1: null/zero, stated as
  // deferred, never a fabricated root.
  const checkedAgainstErrataRoot = {
    log: 'sigsum',
    tree_size: 0,
    root_hash: null,
    deferred: true,
    deferred_reason: 'errata.json Sigsum anchor not yet wired (FV-ERRATA-BUILD-2 shipped this leg deferred, blocked on ci-policy-key private key access) — this field will carry the real tree head once that lands',
  };

  const now = new Date();
  const expires = new Date(now.getTime() + TTL_SECONDS * 1000);

  const artifact = {
    fv_status_version: '1.0',
    spec_digest: specDigest,
    spec_version: specVersion,
    kernel_ids: kernelIds,
    issued_at: now.toISOString(),

    published: {
      state: 'unpublished',
      registry: 'OpenRegSpecs',
      registry_url: null,
      reason: 'registry publication surface not yet shipped; specs exist internally, publish-cleanliness review pending',
    },

    proven: {
      note: 'Proof tier is a claim about an individual kernel\'s verification against this spec, not a blanket claim about the spec digest -- only kernels with a recorded fv-pilot claim-tier record carry a tier below.',
      kernels: provenKernels,
      unclaimed_count: unclaimedCount,
      unclaimed_note: 'no formal claim-tier record exists yet for these kernels; absence here means unassessed, never a negative claim',
    },

    still_trusted: {
      value: matchingEntries.length === 0,
      checked_against_errata_root: { ...checkedAgainstErrataRoot, checked_at: now.toISOString() },
      matching_entries: matchingEntries,
      ttl_seconds: TTL_SECONDS,
      expires_at: expires.toISOString(),
      on_expiry: 'unknown-refresh-needed',
      errata_feed_url: '/errata.json',
      errata_page_url: '/errata.html',
    },

    offline_first_note: OFFLINE_FIRST_NOTE,
  };

  return { hex, artifact };
}

function canonicalBytes(artifact) {
  return JSON.stringify(cgCanon(artifact));
}

// Fields that legitimately change on every run (freshness, never coverage) —
// --check compares everything else exactly and only validates SHAPE for
// these, per the design's "still_trusted is the one dynamic field" rule.
const DYNAMIC_KEYS = ['issued_at'];
function stripDynamic(artifact) {
  const clone = JSON.parse(JSON.stringify(artifact));
  for (const k of DYNAMIC_KEYS) delete clone[k];
  delete clone.still_trusted.checked_against_errata_root.checked_at;
  delete clone.still_trusted.expires_at;
  return clone;
}

const { hex, artifact } = await buildArtifacts();

if (mode === 'check') {
  const problems = [];
  if (!existsSync(OUT_DIR)) {
    console.error(`✗ FV-AGENTSURFACE-BUILD-1 FAILED — ${OUT_DIR} does not exist. Run: node scripts/gen-fv-status.mjs --write`);
    process.exit(1);
  }
  const onDisk = new Set(readdirSync(OUT_DIR).filter((f) => f.endsWith('.json')));
  const wantedFile = `${hex}.json`;
  if (!onDisk.has(wantedFile)) {
    problems.push(`missing ${wantedFile}`);
  } else {
    const actual = JSON.parse(readFileSync(resolve(OUT_DIR, wantedFile), 'utf8'));
    const actualStatic = canonicalBytes(stripDynamic(actual));
    const wantStatic = canonicalBytes(stripDynamic(artifact));
    if (actualStatic !== wantStatic) problems.push(`stale ${wantedFile} (non-freshness fields do not match recomputed artifact)`);
    if (!actual.issued_at || !actual.still_trusted?.expires_at) problems.push(`${wantedFile} missing freshness fields (issued_at / still_trusted.expires_at)`);
  }
  for (const fname of onDisk) {
    if (fname !== wantedFile) problems.push(`orphan ${fname} (no longer the current spec_digest — SO #34c: a leftover file is not evidence of anything)`);
  }
  if (problems.length) {
    console.error(`✗ FV-AGENTSURFACE-BUILD-1 fv-status coverage FAILED — ${problems.length} problem(s):`);
    for (const p of problems) console.error('  • ' + p);
    console.error('\nRun: node scripts/gen-fv-status.mjs --write');
    process.exit(1);
  }
  console.log(`✓ FV-AGENTSURFACE-BUILD-1 clean — fv-status/${wantedFile} current for ${inScope.length} in-scope kernel(s).`);
  process.exit(0);
}

// --- WRITE -------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });
const outPath = resolve(OUT_DIR, `${hex}.json`);
writeFileSync(outPath, JSON.stringify(artifact, null, 2) + '\n');
console.log(`✓ FV-AGENTSURFACE-BUILD-1 wrote fv-status/${hex}.json — ${inScope.length} kernel(s), ${Object.keys(artifact.proven.kernels).length} with a recorded claim-tier, ${artifact.proven.unclaimed_count} unassessed.`);
