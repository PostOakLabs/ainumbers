#!/usr/bin/env node
// collect-replay-witnesses.mjs: the daily collector behind data/replay-witness-roll.json.
//
// Outside GitHub accounts fork the repository, run .github/workflows/replay-witness.yml and so
// attest two subjects with their own identity: the beacon (a fixed digest of the corpus digest) and
// the replay-result file. This script finds those attestations, verifies each one, and counts, per
// module digest, how many distinct accounts reproduced it.
//
//   node scripts/collect-replay-witnesses.mjs --write     write data/replay-witness-roll.json
//   node scripts/collect-replay-witnesses.mjs --collect --out <dir>
//                                                         live collection for the scheduled
//                                                         workflow: roll + disagreement issues
//   node scripts/collect-replay-witnesses.mjs --check     freshness (hermetic part only)
//
// Admission rule (the whole of it, no human step): the bundle verifies for the fork as owner, the
// signing workflow path is .github/workflows/replay-witness.yml, the runner is GitHub-hosted, and
// the source commit is an ancestor of upstream main. Faking a pass needs a compromise of GitHub's
// signing, not of the fork.
//
// Counting rule: a witness counts toward a module only while that module digest is current in this
// checkout. A digest that moves resets that module to zero. House and outside lines are never summed.
//
// The writer is main-side: the --write mode is the regen command of the 'replay-witness-roll' entry
// in scripts/derived-artifacts.mjs. Without GH_TOKEN it HOLDS the witnesses already in the file
// (no network, byte-stable), so a PR checkout or a local run never invents or drops a witness.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jcsStringify } from '../chaingraph/kernels/_hash.mjs';
import { replayCorpus, serializeResult } from './replay-result.mjs';
import { gitEnv } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..');
export const UPSTREAM = 'PostOakLabs/ainumbers';
export const ROLL_REL = 'data/replay-witness-roll.json';
export const WITNESS_WORKFLOW_PATH = '.github/workflows/replay-witness.yml';
export const PREDICATE_TYPE = 'ainumbers.co/replay-witness/v1';
export const BEACON_PREFIX = 'ainumbers-replay-witness/v1:';
export const ROLL_SCHEMA = 'ainumbers.co/replay-witness-roll/v1';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const bare = (d) => String(d ?? '').replace(/^sha256:/, '');

/** Parse the workflow path out of a certificate buildSignerURI. */
export function parseSignerPath(uri) {
  const m = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/(\.github\/workflows\/[^@]+)@.+$/.exec(String(uri ?? ''));
  return m ? { repo: m[1], path: m[2] } : null;
}

/** "linux-x64-node20" from a replay-env predicate. */
export function runtimeLabel(env) {
  const os = { linux: 'linux', win32: 'win', darwin: 'macos' }[env?.os] ?? String(env?.os ?? 'unknown');
  const node = /^v?(\d+)/.exec(String(env?.node ?? ''))?.[1] ?? 'x';
  return `${os}-${env?.arch ?? 'unknown'}-node${node}`;
}

/**
 * Flatten one entry of `gh attestation verify --format json` into the facts the admission rule needs.
 * Shape (gh documented output): { verificationResult: { statement: { subject, predicate },
 * signature: { certificate: { buildSignerURI, runnerEnvironment, sourceRepositoryDigest } } } }.
 */
export function extractRecord(entry) {
  const vr = entry?.verificationResult ?? {};
  const cert = vr.signature?.certificate ?? {};
  const subjects = {};
  for (const s of vr.statement?.subject ?? []) subjects[s.name] = bare(s.digest?.sha256);
  const signer = parseSignerPath(cert.buildSignerURI);
  return {
    signerRepo: signer?.repo ?? null,
    signerPath: signer?.path ?? null,
    runner: cert.runnerEnvironment ?? null,
    sourceCommit: cert.sourceRepositoryDigest ?? null,
    subjects,
    env: vr.statement?.predicate ?? {},
  };
}

/**
 * Classify one verified record. Pure.
 * @param rec        extractRecord output
 * @param ctx        { fork, beacon, expectedResult, commitInUpstream: (sha) => boolean }
 * @returns {{status: 'agree'|'disagree'|'rejected', reason: string}}
 */
export function classifyRecord(rec, ctx) {
  if (rec.signerRepo !== ctx.fork) return { status: 'rejected', reason: 'signer-not-the-fork' };
  if (rec.signerPath !== WITNESS_WORKFLOW_PATH) return { status: 'rejected', reason: 'wrong-workflow-path' };
  if (rec.runner !== 'github-hosted') return { status: 'rejected', reason: 'not-github-hosted-runner' };
  if (!/^[0-9a-f]{40}$/.test(String(rec.sourceCommit ?? '')) || !ctx.commitInUpstream(rec.sourceCommit)) {
    return { status: 'rejected', reason: 'source-commit-not-in-upstream' };
  }
  if (rec.subjects['replay-beacon'] !== ctx.beacon) return { status: 'rejected', reason: 'beacon-mismatch' };
  const got = rec.subjects['replay-result'];
  if (!got) return { status: 'rejected', reason: 'no-result-subject' };
  return got === ctx.expectedResult
    ? { status: 'agree', reason: 'result-equals-agreed-digest' }
    : { status: 'disagree', reason: 'result-differs-from-agreed-digest' };
}

/** Vector ids (or, failing that, module digests) in which a witness result differs from ours. */
export function diffResults(ours, theirs) {
  const ids = new Set();
  for (const list of Object.values(theirs?.mismatches ?? {})) for (const id of list) ids.add(id);
  if (ids.size === 0) {
    const keys = new Set([...Object.keys(ours.modules), ...Object.keys(theirs?.modules ?? {})]);
    for (const k of keys) if (ours.modules[k] !== theirs?.modules?.[k]) ids.add(`module:${k}`);
  }
  return [...ids].sort();
}

/**
 * Build the roll. Pure.
 * @param replay   { result, counts } from replayCorpus
 * @param house    committed house line or null
 * @param witnesses  [{ account, account_created, fork, corpus_digest, result, runtimes, bundle_url, modules_agreed }]
 * @param disagreements  [{ account, fork, corpus_digest, vector_ids, bundle_url }]
 */
export function buildRoll({ replay, house, witnesses, disagreements }) {
  const current = replay.result.corpus_digest;
  const currentModules = Object.keys(replay.result.modules);
  const mod = {};
  for (const d of currentModules) {
    mod[d] = {
      house: { agree: house ? 1 : 0, disagree: 0, signed: house?.signature_status === 'signed' },
      outside: { accounts_agree: 0, accounts_disagree: 0, runtimes: [] },
    };
  }
  const agreeBy = new Map();     // module digest -> Set(account)
  const disagreeBy = new Map();
  const runtimes = new Map();
  const add = (m, k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };
  for (const w of witnesses) {
    if (w.result !== 'agree') continue;
    for (const d of w.modules_agreed ?? []) {
      if (!mod[d]) continue;           // digest moved: the witness no longer counts here
      add(agreeBy, d, w.account);
      for (const r of w.runtimes ?? []) add(runtimes, d, r);
    }
  }
  for (const x of disagreements) {
    for (const id of x.vector_ids ?? []) {
      const d = id.startsWith('module:') ? id.slice(7) : null;
      if (d && mod[d]) add(disagreeBy, d, x.account);
    }
  }
  for (const d of currentModules) {
    mod[d].outside.accounts_agree = agreeBy.get(d)?.size ?? 0;
    mod[d].outside.accounts_disagree = disagreeBy.get(d)?.size ?? 0;
    mod[d].outside.runtimes = [...(runtimes.get(d) ?? [])].sort();
  }
  const keyOf = (w) => `${w.account}|${w.corpus_digest}|${w.result}`;
  const ws = [...witnesses].sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0));
  const ds = [...disagreements].sort((a, b) => (`${a.account}|${a.corpus_digest}` < `${b.account}|${b.corpus_digest}` ? -1 : 1));
  return {
    schema: ROLL_SCHEMA,
    window: { corpus_digest: current, beacon: sha256(BEACON_PREFIX + current), agreed_result_sha256: sha256(serializeResult(replay.result)) },
    wording: 'Each count is the number of distinct GitHub accounts whose own hosted runner reproduced the module digest. It says the same fixtures give the same hashes elsewhere, nothing about the rule text.',
    modules: mod,
    witnesses: ws,
    disagreements: ds,
  };
}

export const serializeRoll = (roll) => jcsStringify(roll) + '\n';

// ---- live collection (network). Every gh call goes through deps.gh so tests never touch it. ----

export const realGh = (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

function tryGh(gh, args) {
  try { return gh(args); } catch { return null; }
}

/** Fork full names, paged: ceil(F/100) calls. */
export function listForks(gh, upstream = UPSTREAM) {
  const out = tryGh(gh, ['api', '--paginate', `repos/${upstream}/forks?per_page=100`, '--jq', '.[].full_name']);
  return (out ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).sort();
}

/** Decode the result digest out of one attestation's DSSE statement, or null. */
export function resultDigestOf(att) {
  try {
    const st = JSON.parse(Buffer.from(att.bundle.dsseEnvelope.payload, 'base64').toString('utf8'));
    return bare(st.subject.find((s) => s.name === 'replay-result')?.digest?.sha256) || null;
  } catch { return null; }
}

/**
 * Collect against live GitHub. deps: { gh, verify(file, fork) -> entries[], download(fork, dir) -> files[],
 * commitInUpstream(sha), readJson }.
 * One call per fork for the beacon query, plus verify calls only for forks that have attestations.
 */
export async function collectLive({ replay, deps, prior }) {
  const { result } = replay;
  const beacon = sha256(BEACON_PREFIX + result.corpus_digest);
  const expectedResult = sha256(serializeResult(result));
  const forks = listForks(deps.gh);
  const witnesses = (prior?.witnesses ?? []).filter((w) => w.corpus_digest !== result.corpus_digest);
  const disagreements = (prior?.disagreements ?? []).filter((d) => d.corpus_digest !== result.corpus_digest);
  const rejected = [];
  const agreedModules = Object.keys(result.modules).filter((d) => !(d in result.mismatches));

  for (const fork of forks) {
    const raw = tryGh(deps.gh, ['api', `repos/${fork}/attestations/sha256:${beacon}?per_page=100&predicate_type=${PREDICATE_TYPE}`]);
    if (!raw) continue;
    let atts = [];
    try { atts = JSON.parse(raw).attestations ?? []; } catch { continue; }
    if (atts.length === 0) continue;
    const owner = fork.split('/')[0];
    const created = (() => { try { return String(JSON.parse(deps.gh(['api', `users/${owner}`])).created_at).slice(0, 10); } catch { return 'unknown'; } })();
    const ctx = { fork, beacon, expectedResult, commitInUpstream: deps.commitInUpstream };
    const bundleUrl = atts[0].bundle_url ?? `https://api.github.com/repos/${fork}/attestations/sha256:${beacon}`;

    // Agreement path: verify the locally recomputed agreed file against the fork's attestations.
    const runtimes = new Set();
    let agreed = false;
    for (const entry of deps.verify(deps.agreedFile, fork)) {
      const rec = extractRecord(entry);
      const c = classifyRecord(rec, ctx);
      if (c.status === 'agree') { agreed = true; runtimes.add(runtimeLabel(rec.env)); } else rejected.push({ fork, reason: c.reason });
    }
    if (agreed) {
      witnesses.push({
        account: owner, account_created: created, fork, corpus_digest: result.corpus_digest, result: 'agree',
        runtimes: [...runtimes].sort(), bundle_url: bundleUrl, modules_agreed: agreedModules.slice().sort(),
      });
    }

    // Disagreement path: only if some attestation carries a different result digest.
    const different = atts.some((a) => { const d = resultDigestOf(a); return d && d !== expectedResult; });
    if (!different) continue;
    for (const file of deps.download(fork)) {
      const bytes = readFileSync(file);
      if (sha256(bytes) === expectedResult) continue;
      for (const entry of deps.verify(file, fork)) {
        const rec = extractRecord(entry);
        const c = classifyRecord(rec, ctx);
        if (c.status !== 'disagree') { rejected.push({ fork, reason: c.reason }); continue; }
        let theirs = null;
        try { theirs = JSON.parse(bytes.toString('utf8')); } catch { /* keep null: diff falls back to module keys */ }
        const vector_ids = diffResults(result, theirs);
        witnesses.push({ account: owner, account_created: created, fork, corpus_digest: result.corpus_digest, result: 'disagree', runtimes: [runtimeLabel(rec.env)], bundle_url: bundleUrl, modules_agreed: [] });
        disagreements.push({ account: owner, fork, corpus_digest: result.corpus_digest, vector_ids, bundle_url: bundleUrl });
        break;
      }
    }
  }
  return { witnesses, disagreements, rejected, forks: forks.length };
}

/**
 * One issue per corpus digest, same idempotent shape as scripts/scheduled-red-issue.mjs: resolve an
 * OPEN issue by exact title, comment if it exists, create otherwise. No labels. Returns the action.
 */
export function reportDisagreements({ disagreements, gh, repo = UPSTREAM }) {
  const byCorpus = new Map();
  for (const d of disagreements) { if (!byCorpus.has(d.corpus_digest)) byCorpus.set(d.corpus_digest, []); byCorpus.get(d.corpus_digest).push(d); }
  const actions = [];
  for (const [corpus, list] of [...byCorpus].sort()) {
    const title = `Replay witness disagreement: corpus ${corpus.slice(0, 12)}`;
    const body = [
      `A GitHub-hosted witness run reproduced a different result for corpus \`${corpus}\`.`,
      '',
      ...list.map((d) => `- ${d.fork}: ${d.vector_ids.slice(0, 20).join(', ') || 'no vector ids'} (${d.bundle_url})`),
      '',
      'Treat a real disagreement as a nondeterminism erratum. It stays in data/replay-witness-roll.json until a later run by the same account agrees.',
    ].join('\n');
    const found = tryGh(gh, ['issue', 'list', '--repo', repo, '--state', 'open', '--search', `in:title "${title}"`, '--limit', '50', '--json', 'number,title']);
    const hit = (() => { try { return JSON.parse(found ?? '[]').find((i) => i.title === title); } catch { return null; } })();
    if (hit) { tryGh(gh, ['issue', 'comment', String(hit.number), '--repo', repo, '--body', body]); actions.push({ corpus, action: 'commented', issue: hit.number }); }
    else { tryGh(gh, ['issue', 'create', '--repo', repo, '--title', title, '--body', body]); actions.push({ corpus, action: 'opened' }); }
  }
  return actions;
}

// ---- CLI ----

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

const readPrior = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null);

function liveDeps(agreedFile) {
  const verify = (file, fork) => {
    const out = tryGh(realGh, ['attestation', 'verify', file, '--repo', fork, '--signer-workflow', `${fork}/${WITNESS_WORKFLOW_PATH}`, '--predicate-type', PREDICATE_TYPE, '--format', 'json']);
    try { return out ? JSON.parse(out) : []; } catch { return []; }
  };
  const download = (fork) => {
    const dir = mkdtempSync(join(tmpdir(), 'witness-'));
    const runs = tryGh(realGh, ['api', `repos/${fork}/actions/workflows/replay-witness.yml/runs?status=success&per_page=3`, '--jq', '.workflow_runs[].id']);
    for (const id of (runs ?? '').split(/\r?\n/).filter(Boolean)) {
      tryGh(realGh, ['run', 'download', id, '--repo', fork, '--pattern', 'replay-result-witness-*', '--dir', join(dir, id)]);
    }
    const files = [];
    const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === 'replay-result.json') files.push(p); } };
    walk(dir);
    return files;
  };
  const commitInUpstream = (sha) => {
    try { execFileSync('git', ['-C', REPO, 'merge-base', '--is-ancestor', sha, 'origin/main'], { stdio: 'ignore', env: gitEnv() }); return true; } catch { return false; }
  };
  return { gh: realGh, verify, download, commitInUpstream, agreedFile };
}

async function main() {
  const live = process.argv.includes('--collect');
  const write = process.argv.includes('--write') || live;
  const rollPath = join(REPO, ROLL_REL);
  const prior = readPrior(rollPath);
  const replay = await replayCorpus({ kernelsDir: join(REPO, 'chaingraph', 'kernels'), rulesPath: join(REPO, 'data', 'replay-exclusion-rules.json') });
  const housePath = join(REPO, 'data', 'replay-house-line.json');
  const house = existsSync(housePath) ? JSON.parse(readFileSync(housePath, 'utf8')) : null;
  const haveToken = Boolean(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);

  let witnesses = (prior?.witnesses ?? []);
  let disagreements = (prior?.disagreements ?? []);
  if ((live || (write && haveToken)) && haveToken) {
    const tmp = mkdtempSync(join(tmpdir(), 'agreed-'));
    const agreedFile = join(tmp, 'replay-result.json');
    writeFileSync(agreedFile, serializeResult(replay.result));
    const got = await collectLive({ replay, deps: liveDeps(agreedFile), prior });
    witnesses = got.witnesses; disagreements = got.disagreements;
    console.log(`collect-replay-witnesses: ${got.forks} forks, ${witnesses.length} witness records, ${disagreements.length} disagreements, ${got.rejected.length} rejected`);
    for (const r of got.rejected) console.log(`REJECTED ${r.fork} ${r.reason}`);
    if (live && disagreements.length) for (const a of reportDisagreements({ disagreements, gh: realGh })) console.log(`ISSUE ${a.action} ${a.corpus.slice(0, 12)}`);
  } else if (write) {
    console.log('collect-replay-witnesses: no GH_TOKEN, holding the witnesses already in the roll');
  }
  const body = serializeRoll(buildRoll({ replay, house, witnesses, disagreements }));
  const out = arg('--out', null);
  if (out) { mkdirSync(out, { recursive: true }); writeFileSync(join(out, 'replay-witness-roll.json'), body); }
  if (process.argv.includes('--check')) {
    if (!existsSync(rollPath)) { console.error(`collect-replay-witnesses --check: ${ROLL_REL} is ABSENT (expected on a PR checkout; main's regen writes it)`); return 1; }
    if (readFileSync(rollPath, 'utf8') === body) { console.log('collect-replay-witnesses --check: byte-exact'); return 0; }
    console.error(`collect-replay-witnesses --check: ${ROLL_REL} is STALE; main's regen owns it`);
    return 1;
  }
  if (write && !live) { writeFileSync(rollPath, body); console.log(`collect-replay-witnesses: wrote ${ROLL_REL}`); }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // The scheduled workflow is never red: a collector failure is logged, the exit stays 0 in --collect mode.
  main().then((c) => process.exit(c), (e) => { console.error(`collect-replay-witnesses: ${e.message}`); process.exit(process.argv.includes('--collect') ? 0 : 1); });
}
